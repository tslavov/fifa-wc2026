import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import {
  RecentFormOutputSchema,
  TeamStrengthOutputSchema,
  type OutputFile,
  type RecentFormRow,
  type TeamStrengthRow,
} from "../schemas.js";
import { normalizeTeamName, teamKey } from "../normalize/teams.js";
import { calculateScoreDistributionMetrics, type ScoreDistributionMetrics } from "./scoreDistributionMetrics.js";

const FIFA_COMPETITION_ID = "17";
const FIFA_SEASON_ID_2026 = "285023";
const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";
const FIFA_MATCH_CALENDAR_API_URL =
  `https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=${FIFA_COMPETITION_ID}&idSeason=${FIFA_SEASON_ID_2026}`;

const GROUPS_PATH = "fifa-world-cup-2026-groups.md";
const TEAM_STRENGTH_PATH = join("data", "model-input", "team-strength.json");
const RECENT_FORM_PATH = join("data", "model-input", "recent-form.json");
const RULES_PATH = join("data", "rules", "world-cup-2026-rules.json");
const PREVIOUS_MARKOV_PATH = join("data", "predictions", "group-stage-markov-chain-v1.json");
const PREVIOUS_SCORE_REPORT_PATH = join("reports", "world-cup-2026-first-round-score-predictions.md");

const RAW_FIFA_SNAPSHOT_PATH = join("data", "raw", "fifa-world-cup-2026-match-calendar-v1.json");
const RESULTS_OUTPUT_PATH = join("data", "results", "group-stage-matchday-1-results-v1.json");
const EVALUATION_OUTPUT_PATH = join("data", "evaluation", "matchday-1-prediction-evaluation-v1.json");
const EVALUATION_REPORT_PATH = join("reports", "matchday-1-prediction-evaluation.md");
const COEFFICIENTS_OUTPUT_PATH = join("data", "model", "coefficients-v2-after-matchday-1.json");
const REMAINING_PREDICTIONS_PATH = join("data", "predictions", "group-stage-remaining-score-predictions-v2-after-matchday-1.json");
const MATCHDAY_2_PREDICTIONS_PATH = join("data", "predictions", "matchday-2-score-predictions-v2-after-matchday-1.json");
const MATCHDAY_3_PREDICTIONS_PATH = join("data", "predictions", "matchday-3-score-predictions-v2-after-matchday-1.json");
const UPDATED_MONTE_CARLO_PATH = join("data", "predictions", "group-stage-monte-carlo-v2-after-matchday-1.json");
const UPDATED_MARKOV_PATH = join("data", "predictions", "group-stage-markov-chain-v2-after-matchday-1.json");
const MODEL_UPDATE_REPORT_PATH = join("reports", "model-update-after-matchday-1.md");

const PREDICTIONS_DIR = normalize(join("data", "predictions"));
const DEFAULT_ITERATIONS = 20_000;
const DEFAULT_SEED = 20260617;
const STEPS_PER_MATCH = 90;
const PRUNE_PROBABILITY_BELOW = 1e-14;
const EVIDENCE_WEIGHT_CAP = 0.15;
const RELATIVE_COEFFICIENT_MOVE_CAP = 0.05;

const PREVIOUS_COEFFICIENTS = {
  deterministicFeatureWeights: {
    fifaPoints: 0.35,
    fifaRank: 0.2,
    eloRating: 0.3,
    recentFormPointsRate: 0.1,
    recentGoalDifferencePerMatch: 0.05,
  },
  markovMonteCarlo: {
    qualityWeights: {
      fifaPoints: 0.35,
      fifaRank: 0.2,
      eloRating: 0.3,
      recentFormPointsRate: 0.15,
    },
    modelParameters: {
      baseGoalRateMultiplier: 1,
      qualityMultiplierScale: 0.65,
      lambdaMin: 0.15,
      lambdaMax: 4.25,
      stepsPerMatch: STEPS_PER_MATCH,
      pruneProbabilityBelow: PRUNE_PROBABILITY_BELOW,
    },
  },
  scoreSelection: {
    nearEqualRelativeBand: 0.05,
    nearEqualAbsoluteProbabilityBand: 0.03,
    higherScoreTiebreak: true,
    strongerTeamTiebreak: true,
    saferDrawFallback: true,
  },
  qualitativeOverlay: {
    llmWeight: 0,
    notes: "LLM reasoning explains and sanity-checks outputs only; it is not a numeric model input in the existing pipeline.",
  },
} as const;

type GroupDefinition = { group: string; teams: string[] };
type Rules = {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  topTeamsPerGroup: number;
  bestThirdPlaceTeams: number;
  groupCount: number;
  teamsPerGroup: number;
  groupMatchesPerTeam: number;
  sources: Array<{ sourceName?: string; sourceUrl?: string }>;
};
type Localized = Array<{ Locale?: string; Description?: string }>;
type FifaTeam = {
  Score?: number | null;
  IdTeam?: string;
  IdCountry?: string;
  TeamName?: Localized;
  Abbreviation?: string;
  ShortClubName?: string;
};
type FifaStadium = {
  Name?: Localized;
  CityName?: Localized;
  IdCountry?: string;
};
type FifaMatch = {
  IdMatch: string;
  IdCompetition?: string;
  IdSeason?: string;
  IdStage?: string;
  IdGroup?: string | null;
  MatchNumber: number;
  MatchDay?: string | number | null;
  StageName?: Localized;
  GroupName?: Localized;
  CompetitionName?: Localized;
  SeasonName?: Localized;
  Date: string;
  LocalDate: string;
  Home: FifaTeam;
  Away: FifaTeam;
  HomeTeamScore?: number | null;
  AwayTeamScore?: number | null;
  HomeTeamPenaltyScore?: number | null;
  AwayTeamPenaltyScore?: number | null;
  Winner?: string | null;
  MatchTime?: string | null;
  MatchStatus: number;
  ResultType: number;
  OfficialityStatus: number;
  Stadium?: FifaStadium;
  PlaceHolderA?: string;
  PlaceHolderB?: string;
};
type FifaCalendarResponse = {
  ContinuationToken?: string | null;
  ContinuationHash?: string | null;
  Results: FifaMatch[];
};
type ResultStatus = "final" | "provisional_result" | "in_progress" | "scheduled" | "unknown";
type MatchdayResultRow = {
  matchId: string;
  matchNumber: number;
  group: string;
  round: "group_stage";
  matchday: number;
  date: string;
  utcDateTime: string;
  localDateTime: string;
  venue: string;
  city?: string;
  country?: string;
  homeTeam: string;
  awayTeam: string;
  teamA: string;
  teamB: string;
  finalScore: { home: number; away: number; teamA: number; teamB: number };
  outcome: "home_win" | "draw" | "away_win";
  goalDifference: number;
  sourceUrl: string;
  sourceApiUrl: string;
  fetchedAt: string;
  officialStatus: {
    matchStatus: number;
    resultType: number;
    officialityStatus: number;
    statusLabel: ResultStatus;
  };
};
type IncompleteFixtureRow = {
  matchId: string;
  matchNumber: number;
  group: string;
  round: "group_stage";
  matchday: number;
  date: string;
  utcDateTime: string;
  localDateTime: string;
  venue: string;
  city?: string;
  country?: string;
  homeTeam: string;
  awayTeam: string;
  teamA: string;
  teamB: string;
  status: ResultStatus;
  scoreAtFetch?: { home: number; away: number; teamA: number; teamB: number };
  sourceUrl: string;
  sourceApiUrl: string;
  fetchedAt: string;
  officialStatus: {
    matchStatus: number;
    resultType: number;
    officialityStatus: number;
    statusLabel: ResultStatus;
  };
};
type MatchdayResultsOutput = {
  datasetId: string;
  artifactKind: "collected_results";
  generatedAt: string;
  source: {
    sourceName: string;
    sourceUrl: string;
    sourceApiUrl: string;
    fetchedAt: string;
    notes: string;
  };
  matchdayDefinition: {
    round: "group_stage";
    matchday: 1;
    expectedFixtureCount: 24;
    fixtureSelector: string;
  };
  completionStatus: {
    expectedFixtures: number;
    completedFixtures: number;
    incompleteFixtures: number;
    allMatchday1FixturesFinal: boolean;
  };
  results: MatchdayResultRow[];
  incompleteFixtures: IncompleteFixtureRow[];
  warnings?: string[];
};
type ScoreSample = {
  goalsA: number;
  goalsB: number;
  probability: number;
  cumulativeProbability?: number;
};
type FixtureDistribution = {
  group: string;
  teamA: string;
  teamB: string;
  lambdaA: number;
  lambdaB: number;
  scoreDistribution: ScoreSample[];
  mostLikelyScores: Array<{ goalsA: number; goalsB: number; probability: number }>;
};
type PreviousMarkovArtifact = {
  generatedAt?: string;
  predictionId?: string;
  fixtureDistributions?: FixtureDistribution[];
};
type SelectedPrediction = {
  group: string;
  teamA: string;
  teamB: string;
  goalsA: number;
  goalsB: number;
  confidence: string;
  sourcePath: string;
};
type OrientedScore = { homeGoals: number; awayGoals: number; probability: number };
type EvaluationRow = {
  matchId: string;
  matchNumber: number;
  group: string;
  homeTeam: string;
  awayTeam: string;
  predictedScore: { home: number; away: number };
  actualScore: { home: number; away: number };
  mostProbableScore: { home: number; away: number };
  selectedScoreProbability?: number;
  mostProbableScoreProbability?: number;
  probabilityGap?: number;
  selectedScoreDifferedFromMostProbable: boolean;
  exactScoreHit: boolean;
  outcomeHit: boolean;
  predictedOutcome: "home_win" | "draw" | "away_win";
  actualOutcome: "home_win" | "draw" | "away_win";
  goalDifferenceError: number;
  totalGoalsError: number;
  teamAGoalsError: number;
  teamBGoalsError: number;
  expectedGoals?: { home: number; away: number };
  oldPredictionSources: {
    selectedScoreReport: string;
    mostProbableScoreSource: string;
  };
};
type EvaluationOutput = {
  datasetId: string;
  artifactKind: "evaluation";
  generatedAt: string;
  sourceResultFile: string;
  predictionSources: {
    selectedScoreReport: string;
    markovChainPrediction: string;
  };
  evaluatedFixtureCount: number;
  incompleteMatchday1FixtureCount: number;
  summary: EvaluationSummary;
  matches: EvaluationRow[];
  incompleteMatchday1Fixtures: IncompleteFixtureRow[];
};
type EvaluationSummary = {
  completedFixtures: number;
  exactScoreHits: number;
  exactScoreHitRate: number;
  outcomeHits: number;
  outcomeHitRate: number;
  averageGoalDifferenceError: number;
  averageTotalGoalsError: number;
  averageTeamAGoalsError: number;
  averageTeamBGoalsError: number;
  selectedDifferedFromMostProbableCount: number;
  actualGoalsPerMatch: number;
  predictedExpectedGoalsPerMatch: number;
  actualDrawRate: number;
  averagePredictedDrawProbability: number;
  favoriteWinRate: number;
  averageFavoriteWinProbability: number;
};
type CoefficientOutput = {
  datasetId: string;
  artifactKind: "model_coefficients";
  generatedAt: string;
  based_on: string[];
  update_date: string;
  source_result_file: string;
  previous_coefficient_file: string;
  update_method: string;
  caps_applied: {
    evidenceWeight: number;
    relativeCoefficientMoveCap: number;
    notes: string;
  };
  previousCoefficients: typeof PREVIOUS_COEFFICIENTS;
  coefficients: {
    deterministicFeatureWeights: typeof PREVIOUS_COEFFICIENTS.deterministicFeatureWeights;
    markovMonteCarlo: {
      qualityWeights: typeof PREVIOUS_COEFFICIENTS.markovMonteCarlo.qualityWeights;
      modelParameters: {
        baseGoalRateMultiplier: number;
        qualityMultiplierScale: number;
        lambdaMin: number;
        lambdaMax: number;
        stepsPerMatch: number;
        pruneProbabilityBelow: number;
      };
    };
    scoreSelection: typeof PREVIOUS_COEFFICIENTS.scoreSelection;
    qualitativeOverlay: typeof PREVIOUS_COEFFICIENTS.qualitativeOverlay;
  };
  evidence: EvaluationSummary;
  changes: CoefficientChange[];
  notes: string[];
};
type CoefficientChange = {
  coefficient: string;
  previous: number | string;
  updated: number | string;
  relativeChange?: number;
  status: "updated" | "unchanged" | "not_available";
  rationale: string;
};
type TeamInput = {
  team: string;
  countryCode: string;
  group: string;
  fifaRank: number;
  fifaPoints: number;
  eloRank?: number;
  eloRating?: number;
  goalsForPerMatch: number;
  goalsAgainstPerMatch: number;
  formPointsRate: number;
  attackIndex: number;
  defensiveVulnerabilityIndex: number;
  qualityScore: number;
};
type OfficialFixture = {
  matchId: string;
  matchNumber: number;
  group: string;
  matchday: 1 | 2 | 3;
  date: string;
  utcDateTime: string;
  localDateTime: string;
  venue: string;
  city?: string;
  country?: string;
  homeTeam: string;
  awayTeam: string;
  teamA: string;
  teamB: string;
  isFinal: boolean;
  status: ResultStatus;
  sourceUrl: string;
  sourceApiUrl: string;
};
type ScorePredictionRow = {
  matchId: string;
  matchNumber: number;
  group: string;
  matchday: 1 | 2 | 3;
  date: string;
  utcDateTime: string;
  localDateTime: string;
  venue: string;
  city?: string;
  country?: string;
  homeTeam: string;
  awayTeam: string;
  selectedPredictedScore: { home: number; away: number };
  mostProbableScore: { home: number; away: number };
  selectedScoreProbability: number;
  mostProbableScoreProbability: number;
  probabilityDifferenceFromMostProbable: number;
  selectedScoreDifferedFromMostProbable: boolean;
  outcomeProbabilities: { homeWin: number; draw: number; awayWin: number };
  expectedGoals: { home: number; away: number };
  topScorelines: OrientedScore[];
  previousPrediction?: {
    selectedScore?: { home: number; away: number };
    mostProbableScore?: { home: number; away: number };
  };
  actualMatchday1Result?: { home: number; away: number; outcome: "home_win" | "draw" | "away_win" };
  updatedModelAdjustment: {
    baseGoalRateMultiplier: number;
    qualityMultiplierScale: number;
  };
  reasoningNote: string;
};
type PredictionOutput = {
  artifactKind: "prediction";
  predictionId: string;
  predictionType: string;
  generatedAt: string;
  excludeFromFuturePredictionInputs: true;
  doNotUseAsTrainingData: true;
  doNotUseAsCollectedData: true;
  contaminationControl: {
    outputDirectory: string;
    builderInputPaths: string[];
    predictionDirectoryReadAsInput: boolean;
    notes: string;
  };
  basedOnData: {
    results: { path: string };
    coefficients: { path: string };
    teamStrength: { path: string; generatedAt?: string };
    recentForm: { path: string; generatedAt?: string };
    officialFixtureApi: string;
  };
  method: {
    type: string;
    modelParameters: CoefficientOutput["coefficients"]["markovMonteCarlo"]["modelParameters"];
    scoreSelection: typeof PREVIOUS_COEFFICIENTS.scoreSelection;
    noInventedInputs: true;
    unavailableInputsOmitted: string[];
  };
  scope: {
    includedMatchdays: number[];
    includesIncompleteMatchday1Fixtures: boolean;
    completedMatchday1FixturesExcluded: boolean;
  };
  matches: ScorePredictionRow[];
};
type TableRow = {
  team: string;
  countryCode: string;
  group: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  fifaRank: number;
  eloRank?: number;
};
type MatchResult = { teamA: string; teamB: string; goalsA: number; goalsB: number };
type Accumulator = {
  team: string;
  countryCode: string;
  group: string;
  positionCounts: number[];
  topTwoAdvances: number;
  thirdPlaceAdvances: number;
  advances: number;
  thirdPlaceFinishes: number;
  pointsTotal: number;
  goalsForTotal: number;
  goalsAgainstTotal: number;
  goalDifferenceTotal: number;
};

export async function updateAfterMatchday1(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const options = parseOptions(process.argv.slice(2));
  assertNoPredictionInputs([GROUPS_PATH, TEAM_STRENGTH_PATH, RECENT_FORM_PATH, RULES_PATH, RESULTS_OUTPUT_PATH, COEFFICIENTS_OUTPUT_PATH]);

  const groups = parseGroups(await readFile(GROUPS_PATH, "utf8"));
  const rules = parseRules(await readJson(RULES_PATH));
  const teamStrength = TeamStrengthOutputSchema.parse(await readJson(TEAM_STRENGTH_PATH)) as OutputFile<TeamStrengthRow>;
  const recentForm = RecentFormOutputSchema.parse(await readJson(RECENT_FORM_PATH)) as OutputFile<RecentFormRow>;
  const previousMarkov = (await readJson(PREVIOUS_MARKOV_PATH)) as PreviousMarkovArtifact;
  const previousScoreReport = await readFile(PREVIOUS_SCORE_REPORT_PATH, "utf8");
  const selectedPredictions = parseSelectedPredictions(previousScoreReport);

  const fifaCalendar = await fetchFifaCalendar();
  await writeJson(RAW_FIFA_SNAPSHOT_PATH, {
    datasetId: "fifa-world-cup-2026-match-calendar-v1",
    generatedAt,
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_MATCH_CALENDAR_API_URL,
    raw: fifaCalendar,
  });

  const matchday1Output = buildMatchday1Results(fifaCalendar.Results, generatedAt);
  await writeJson(RESULTS_OUTPUT_PATH, matchday1Output);

  const evaluation = buildEvaluation(matchday1Output, previousMarkov, selectedPredictions, generatedAt);
  await writeJson(EVALUATION_OUTPUT_PATH, evaluation);
  await writeText(EVALUATION_REPORT_PATH, buildEvaluationReport(evaluation));

  const coefficients = buildUpdatedCoefficients(evaluation.summary, generatedAt);
  await writeJson(COEFFICIENTS_OUTPUT_PATH, coefficients);

  const officialFixtures = buildOfficialFixtures(fifaCalendar.Results);
  const teamInputs = buildTeamInputs(groups, teamStrength.rows, recentForm.rows, coefficients);
  const fixtureDistributions = buildFixtureDistributions(officialFixtures, teamInputs, coefficients);
  const remainingPredictions = buildScorePredictions(officialFixtures, fixtureDistributions, matchday1Output, selectedPredictions, previousMarkov, coefficients, generatedAt, [1, 2, 3]);
  const matchday2Predictions = buildScorePredictions(officialFixtures, fixtureDistributions, matchday1Output, selectedPredictions, previousMarkov, coefficients, generatedAt, [2]);
  const matchday3Predictions = buildScorePredictions(officialFixtures, fixtureDistributions, matchday1Output, selectedPredictions, previousMarkov, coefficients, generatedAt, [3]);

  await writeJson(REMAINING_PREDICTIONS_PATH, remainingPredictions);
  await writeJson(MATCHDAY_2_PREDICTIONS_PATH, matchday2Predictions);
  await writeJson(MATCHDAY_3_PREDICTIONS_PATH, matchday3Predictions);

  const updatedMonteCarlo = runConditionedMonteCarlo(officialFixtures, fixtureDistributions, matchday1Output, teamInputs, groups, rules, coefficients, options, generatedAt);
  await writeJson(UPDATED_MONTE_CARLO_PATH, updatedMonteCarlo);
  await writeJson(UPDATED_MARKOV_PATH, buildUpdatedMarkovArtifact(fixtureDistributions, updatedMonteCarlo, coefficients, generatedAt));
  await writeText(MODEL_UPDATE_REPORT_PATH, buildModelUpdateReport(matchday1Output, evaluation, coefficients, remainingPredictions, matchday2Predictions, matchday3Predictions));

  console.log(`Matchday 1 results: wrote ${RESULTS_OUTPUT_PATH}`);
  console.log(`Prediction evaluation: wrote ${EVALUATION_OUTPUT_PATH} and ${EVALUATION_REPORT_PATH}`);
  console.log(`Updated coefficients: wrote ${COEFFICIENTS_OUTPUT_PATH}`);
  console.log(`Updated predictions: wrote ${REMAINING_PREDICTIONS_PATH}, ${MATCHDAY_2_PREDICTIONS_PATH}, ${MATCHDAY_3_PREDICTIONS_PATH}`);
  console.log(`Updated simulations: wrote ${UPDATED_MONTE_CARLO_PATH} and ${UPDATED_MARKOV_PATH}`);
  console.log(`Model update report: wrote ${MODEL_UPDATE_REPORT_PATH}`);
  for (const warning of matchday1Output.warnings ?? []) console.warn(`Warning: ${warning}`);
}

async function fetchFifaCalendar(): Promise<FifaCalendarResponse> {
  const response = await fetch(FIFA_MATCH_CALENDAR_API_URL, {
    headers: {
      "user-agent": "fifa-wc2026-data-pipeline/0.1 (+public-source-verification)",
    },
  });
  if (!response.ok) throw new Error(`${FIFA_MATCH_CALENDAR_API_URL} failed: ${response.status} ${response.statusText}`);
  return (await response.json()) as FifaCalendarResponse;
}

function buildMatchday1Results(matches: FifaMatch[], generatedAt: string): MatchdayResultsOutput {
  const matchday1 = matches.filter((match) => match.MatchNumber >= 1 && match.MatchNumber <= 24).sort((a, b) => a.MatchNumber - b.MatchNumber);
  const results: MatchdayResultRow[] = [];
  const incompleteFixtures: IncompleteFixtureRow[] = [];

  for (const match of matchday1) {
    const base = normalizeFifaFixture(match, generatedAt);
    if (isOfficialFinal(match)) {
      const homeScore = requireScore(match.HomeTeamScore ?? match.Home.Score, match.MatchNumber, "home");
      const awayScore = requireScore(match.AwayTeamScore ?? match.Away.Score, match.MatchNumber, "away");
      results.push({
        ...base,
        finalScore: { home: homeScore, away: awayScore, teamA: homeScore, teamB: awayScore },
        outcome: outcome(homeScore, awayScore),
        goalDifference: homeScore - awayScore,
      });
    } else {
      const scoreAtFetch = isValidGoal(match.HomeTeamScore) && isValidGoal(match.AwayTeamScore)
        ? { home: match.HomeTeamScore, away: match.AwayTeamScore, teamA: match.HomeTeamScore, teamB: match.AwayTeamScore }
        : undefined;
      incompleteFixtures.push({
        ...base,
        status: base.officialStatus.statusLabel,
        ...(scoreAtFetch ? { scoreAtFetch } : {}),
      });
    }
  }

  const warnings = incompleteFixtures.length > 0
    ? [`FIFA official feed had ${incompleteFixtures.length} Matchday 1 fixtures not final at fetch time; coefficient updates use only ${results.length} completed finals.`]
    : undefined;

  return {
    datasetId: "group-stage-matchday-1-results-v1",
    artifactKind: "collected_results",
    generatedAt,
    source: {
      sourceName: "FIFA World Cup 2026 scores and fixtures",
      sourceUrl: FIFA_SCORES_URL,
      sourceApiUrl: FIFA_MATCH_CALENDAR_API_URL,
      fetchedAt: generatedAt,
      notes: "Official FIFA match calendar API. Matchday 1 selected by official match numbers 1-24.",
    },
    matchdayDefinition: {
      round: "group_stage",
      matchday: 1,
      expectedFixtureCount: 24,
      fixtureSelector: "FIFA match numbers 1-24",
    },
    completionStatus: {
      expectedFixtures: 24,
      completedFixtures: results.length,
      incompleteFixtures: incompleteFixtures.length,
      allMatchday1FixturesFinal: incompleteFixtures.length === 0,
    },
    results,
    incompleteFixtures,
    ...(warnings ? { warnings } : {}),
  };
}

function normalizeFifaFixture(match: FifaMatch, generatedAt: string) {
  const group = groupLetter(description(match.GroupName));
  const homeTeam = normalizeTeamName(description(match.Home.TeamName));
  const awayTeam = normalizeTeamName(description(match.Away.TeamName));
  const venue = description(match.Stadium?.Name);
  const city = optionalDescription(match.Stadium?.CityName);
  const country = match.Stadium?.IdCountry;
  const statusLabel = statusLabelFor(match);
  return {
    matchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    group,
    round: "group_stage" as const,
    matchday: matchdayFromMatchNumber(match.MatchNumber),
    date: datePart(match.LocalDate),
    utcDateTime: match.Date,
    localDateTime: match.LocalDate,
    venue,
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
    homeTeam,
    awayTeam,
    teamA: homeTeam,
    teamB: awayTeam,
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_MATCH_CALENDAR_API_URL,
    fetchedAt: generatedAt,
    officialStatus: {
      matchStatus: match.MatchStatus,
      resultType: match.ResultType,
      officialityStatus: match.OfficialityStatus,
      statusLabel,
    },
  };
}

function buildOfficialFixtures(matches: FifaMatch[]): OfficialFixture[] {
  return matches
    .filter((match) => match.MatchNumber >= 1 && match.MatchNumber <= 72)
    .sort((a, b) => a.MatchNumber - b.MatchNumber)
    .map((match) => {
      const base = normalizeFifaFixture(match, new Date(0).toISOString());
      return {
        matchId: base.matchId,
        matchNumber: base.matchNumber,
        group: base.group,
        matchday: base.matchday,
        date: base.date,
        utcDateTime: base.utcDateTime,
        localDateTime: base.localDateTime,
        venue: base.venue,
        ...(base.city ? { city: base.city } : {}),
        ...(base.country ? { country: base.country } : {}),
        homeTeam: base.homeTeam,
        awayTeam: base.awayTeam,
        teamA: base.teamA,
        teamB: base.teamB,
        isFinal: isOfficialFinal(match),
        status: base.officialStatus.statusLabel,
        sourceUrl: FIFA_SCORES_URL,
        sourceApiUrl: FIFA_MATCH_CALENDAR_API_URL,
      };
    });
}

function isOfficialFinal(match: FifaMatch): boolean {
  return match.MatchStatus === 0 && match.ResultType === 1 && match.OfficialityStatus === 1 && isValidGoal(match.HomeTeamScore ?? match.Home.Score) && isValidGoal(match.AwayTeamScore ?? match.Away.Score);
}

function statusLabelFor(match: FifaMatch): ResultStatus {
  if (isOfficialFinal(match)) return "final";
  if (match.MatchStatus === 0 && match.ResultType === 1 && isValidGoal(match.HomeTeamScore ?? match.Home.Score) && isValidGoal(match.AwayTeamScore ?? match.Away.Score)) return "provisional_result";
  if (match.MatchStatus === 3) return "in_progress";
  if (match.MatchStatus === 1) return "scheduled";
  return "unknown";
}

function buildEvaluation(
  resultsOutput: MatchdayResultsOutput,
  previousMarkov: PreviousMarkovArtifact,
  selectedPredictions: SelectedPrediction[],
  generatedAt: string,
): EvaluationOutput {
  const rows = resultsOutput.results.map((result) => evaluateResult(result, previousMarkov, selectedPredictions));
  const summary = summarizeEvaluation(rows);
  return {
    datasetId: "matchday-1-prediction-evaluation-v1",
    artifactKind: "evaluation",
    generatedAt,
    sourceResultFile: RESULTS_OUTPUT_PATH,
    predictionSources: {
      selectedScoreReport: PREVIOUS_SCORE_REPORT_PATH,
      markovChainPrediction: PREVIOUS_MARKOV_PATH,
    },
    evaluatedFixtureCount: rows.length,
    incompleteMatchday1FixtureCount: resultsOutput.incompleteFixtures.length,
    summary,
    matches: rows,
    incompleteMatchday1Fixtures: resultsOutput.incompleteFixtures,
  };
}

function evaluateResult(result: MatchdayResultRow, previousMarkov: PreviousMarkovArtifact, selectedPredictions: SelectedPrediction[]): EvaluationRow {
  const selected = findSelectedPrediction(selectedPredictions, result.group, result.homeTeam, result.awayTeam);
  if (!selected) throw new Error(`Missing previous selected prediction for ${result.group} ${result.homeTeam} vs ${result.awayTeam}.`);
  const predictedScore = orientSelectedPrediction(selected, result.homeTeam, result.awayTeam);
  const distribution = orientPreviousDistribution(previousMarkov, result.group, result.homeTeam, result.awayTeam);
  const metrics = calculateScoreDistributionMetrics(distribution);
  if (!metrics) throw new Error(`Missing previous score distribution metrics for ${result.group} ${result.homeTeam} vs ${result.awayTeam}.`);
  const mostProbable = metrics.topScorelines[0];
  const selectedProbability = findScoreProbability(distribution, predictedScore.home, predictedScore.away);
  const actual = result.finalScore;
  const predictedOutcome = outcome(predictedScore.home, predictedScore.away);
  const actualOutcome = outcome(actual.home, actual.away);
  const selectedScoreDifferedFromMostProbable = predictedScore.home !== mostProbable.homeGoals || predictedScore.away !== mostProbable.awayGoals;

  return {
    matchId: result.matchId,
    matchNumber: result.matchNumber,
    group: result.group,
    homeTeam: result.homeTeam,
    awayTeam: result.awayTeam,
    predictedScore,
    actualScore: { home: actual.home, away: actual.away },
    mostProbableScore: { home: mostProbable.homeGoals, away: mostProbable.awayGoals },
    ...(selectedProbability === undefined ? {} : { selectedScoreProbability: round(selectedProbability) }),
    mostProbableScoreProbability: mostProbable.probability,
    ...(selectedProbability === undefined ? {} : { probabilityGap: round(mostProbable.probability - selectedProbability) }),
    selectedScoreDifferedFromMostProbable,
    exactScoreHit: predictedScore.home === actual.home && predictedScore.away === actual.away,
    outcomeHit: predictedOutcome === actualOutcome,
    predictedOutcome,
    actualOutcome,
    goalDifferenceError: Math.abs(predictedScore.home - predictedScore.away - (actual.home - actual.away)),
    totalGoalsError: Math.abs(predictedScore.home + predictedScore.away - (actual.home + actual.away)),
    teamAGoalsError: Math.abs(predictedScore.home - actual.home),
    teamBGoalsError: Math.abs(predictedScore.away - actual.away),
    expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
    oldPredictionSources: {
      selectedScoreReport: PREVIOUS_SCORE_REPORT_PATH,
      mostProbableScoreSource: PREVIOUS_MARKOV_PATH,
    },
  };
}

function summarizeEvaluation(rows: EvaluationRow[]): EvaluationSummary {
  const exactScoreHits = rows.filter((row) => row.exactScoreHit).length;
  const outcomeHits = rows.filter((row) => row.outcomeHit).length;
  const selectedDiffered = rows.filter((row) => row.selectedScoreDifferedFromMostProbable).length;
  const actualGoals = rows.reduce((sum, row) => sum + row.actualScore.home + row.actualScore.away, 0);
  const expectedGoals = rows.reduce((sum, row) => sum + (row.expectedGoals?.home ?? 0) + (row.expectedGoals?.away ?? 0), 0);
  const actualDraws = rows.filter((row) => row.actualOutcome === "draw").length;
  const drawProbabilities = rows.map((row) => {
    const distribution = row as EvaluationRow & { _drawProbability?: number };
    return distribution._drawProbability ?? undefined;
  });
  void drawProbabilities;

  return {
    completedFixtures: rows.length,
    exactScoreHits,
    exactScoreHitRate: ratio(exactScoreHits, rows.length),
    outcomeHits,
    outcomeHitRate: ratio(outcomeHits, rows.length),
    averageGoalDifferenceError: average(rows.map((row) => row.goalDifferenceError)),
    averageTotalGoalsError: average(rows.map((row) => row.totalGoalsError)),
    averageTeamAGoalsError: average(rows.map((row) => row.teamAGoalsError)),
    averageTeamBGoalsError: average(rows.map((row) => row.teamBGoalsError)),
    selectedDifferedFromMostProbableCount: selectedDiffered,
    actualGoalsPerMatch: round(actualGoals / rows.length),
    predictedExpectedGoalsPerMatch: round(expectedGoals / rows.length),
    actualDrawRate: ratio(actualDraws, rows.length),
    averagePredictedDrawProbability: round(average(rows.map((row) => probabilityForOutcome(row, "draw")))),
    favoriteWinRate: round(average(rows.map((row) => actualFavoriteWon(row) ? 1 : 0))),
    averageFavoriteWinProbability: round(average(rows.map((row) => favoriteProbability(row)))),
  };
}

function probabilityForOutcome(row: EvaluationRow, wanted: "home_win" | "draw" | "away_win"): number {
  if (!row.expectedGoals) return 0;
  const lambdaHome = Math.max(row.expectedGoals.home, 0.01);
  const lambdaAway = Math.max(row.expectedGoals.away, 0.01);
  const distribution = poissonDistribution(lambdaHome, lambdaAway, 10);
  const metric = calculateScoreDistributionMetrics(distribution);
  if (!metric) return 0;
  if (wanted === "home_win") return metric.homeWinProbability;
  if (wanted === "away_win") return metric.awayWinProbability;
  return metric.drawProbability;
}

function favoriteProbability(row: EvaluationRow): number {
  const homeWinProbability = probabilityForOutcome(row, "home_win");
  const awayWinProbability = probabilityForOutcome(row, "away_win");
  return Math.max(homeWinProbability, awayWinProbability);
}

function actualFavoriteWon(row: EvaluationRow): boolean {
  const homeWinProbability = probabilityForOutcome(row, "home_win");
  const awayWinProbability = probabilityForOutcome(row, "away_win");
  return homeWinProbability >= awayWinProbability ? row.actualOutcome === "home_win" : row.actualOutcome === "away_win";
}

function buildUpdatedCoefficients(summary: EvaluationSummary, generatedAt: string): CoefficientOutput {
  const evidenceWeight = round(Math.min(EVIDENCE_WEIGHT_CAP, summary.completedFixtures / 144));
  const goalRateRatio = summary.predictedExpectedGoalsPerMatch === 0 ? 1 : summary.actualGoalsPerMatch / summary.predictedExpectedGoalsPerMatch;
  const goalRateMultiplier = round(clampRelative(1 + evidenceWeight * (goalRateRatio - 1), 1, RELATIVE_COEFFICIENT_MOVE_CAP));

  const favoriteCalibrationRatio = summary.averageFavoriteWinProbability === 0 ? 1 : summary.favoriteWinRate / summary.averageFavoriteWinProbability;
  const qualityScaleMultiplier = clampRelative(1 + evidenceWeight * (favoriteCalibrationRatio - 1), 1, RELATIVE_COEFFICIENT_MOVE_CAP);
  const updatedQualityMultiplierScale = round(PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.qualityMultiplierScale * qualityScaleMultiplier);

  const updated = {
    deterministicFeatureWeights: PREVIOUS_COEFFICIENTS.deterministicFeatureWeights,
    markovMonteCarlo: {
      qualityWeights: PREVIOUS_COEFFICIENTS.markovMonteCarlo.qualityWeights,
      modelParameters: {
        baseGoalRateMultiplier: goalRateMultiplier,
        qualityMultiplierScale: updatedQualityMultiplierScale,
        lambdaMin: PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.lambdaMin,
        lambdaMax: PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.lambdaMax,
        stepsPerMatch: PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.stepsPerMatch,
        pruneProbabilityBelow: PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.pruneProbabilityBelow,
      },
    },
    scoreSelection: PREVIOUS_COEFFICIENTS.scoreSelection,
    qualitativeOverlay: PREVIOUS_COEFFICIENTS.qualitativeOverlay,
  };

  const changes: CoefficientChange[] = [
    {
      coefficient: "markovMonteCarlo.modelParameters.baseGoalRateMultiplier",
      previous: PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.baseGoalRateMultiplier,
      updated: goalRateMultiplier,
      relativeChange: round(goalRateMultiplier - 1),
      status: goalRateMultiplier === 1 ? "unchanged" : "updated",
      rationale: `Completed Matchday 1 finals averaged ${summary.actualGoalsPerMatch} actual goals per match versus ${summary.predictedExpectedGoalsPerMatch} expected by the v1 Markov distributions. The correction is shrunk by evidence weight ${evidenceWeight} and capped at +/-5%.`,
    },
    {
      coefficient: "markovMonteCarlo.modelParameters.qualityMultiplierScale",
      previous: PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.qualityMultiplierScale,
      updated: updatedQualityMultiplierScale,
      relativeChange: round(updatedQualityMultiplierScale / PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.qualityMultiplierScale - 1),
      status: updatedQualityMultiplierScale === PREVIOUS_COEFFICIENTS.markovMonteCarlo.modelParameters.qualityMultiplierScale ? "unchanged" : "updated",
      rationale: `Favorites won ${percent(summary.favoriteWinRate)} of completed fixtures against an average favorite win probability of ${percent(summary.averageFavoriteWinProbability)}. The quality-spread correction is shrunk and capped to avoid overfitting.`,
    },
    {
      coefficient: "markovMonteCarlo.qualityWeights",
      previous: "v1 weights",
      updated: "unchanged",
      status: "unchanged",
      rationale: "Nineteen finals are not enough to identify separate FIFA-rank, FIFA-points, Elo, and form coefficients without fake precision.",
    },
    {
      coefficient: "deterministicFeatureWeights",
      previous: "v1 weights",
      updated: "unchanged",
      status: "unchanged",
      rationale: "The deterministic rank-order model is not fixture-level calibrated; Matchday 1 evidence is applied to the score model instead.",
    },
    {
      coefficient: "squadQuality",
      previous: "not collected",
      updated: "not collected",
      status: "not_available",
      rationale: "The repository's squad-quality file is a placeholder with no sourced squad rows, so no squad coefficient is introduced.",
    },
    {
      coefficient: "venueHostAdvantage",
      previous: "not used",
      updated: "unchanged",
      status: "unchanged",
      rationale: "Venue/host effects are not in the Phase 1 model input. Host evidence is only three teams and is not enough for a sourced coefficient.",
    },
    {
      coefficient: "marketImpliedProbability",
      previous: "not collected",
      updated: "not collected",
      status: "not_available",
      rationale: "No market/implied-probability source exists in the repository.",
    },
    {
      coefficient: "qualitativeOverlay.llmWeight",
      previous: PREVIOUS_COEFFICIENTS.qualitativeOverlay.llmWeight,
      updated: PREVIOUS_COEFFICIENTS.qualitativeOverlay.llmWeight,
      relativeChange: 0,
      status: "unchanged",
      rationale: "The existing methodology uses LLM text as explanation only, not a numeric input.",
    },
  ];

  return {
    datasetId: "coefficients-v2-after-matchday-1",
    artifactKind: "model_coefficients",
    generatedAt,
    based_on: [PREVIOUS_MARKOV_PATH, PREVIOUS_SCORE_REPORT_PATH, EVALUATION_OUTPUT_PATH],
    update_date: datePart(generatedAt),
    source_result_file: RESULTS_OUTPUT_PATH,
    previous_coefficient_file: "embedded in src/predict/groupStandings.ts, src/predict/monteCarloGroupStage.ts, and src/predict/markovChainGroupStage.ts",
    update_method:
      "Conservative calibration update. The v1 coefficients remain dominant; completed Matchday 1 finals supply global goal-rate and favorite-spread correction signals with shrinkage and +/-5% movement caps. Sparse or unavailable dimensions remain unchanged.",
    caps_applied: {
      evidenceWeight,
      relativeCoefficientMoveCap: RELATIVE_COEFFICIENT_MOVE_CAP,
      notes: "Evidence weight is min(0.15, completed_fixtures / 144); each numeric movement is capped at +/-5% relative to its v1 value.",
    },
    previousCoefficients: PREVIOUS_COEFFICIENTS,
    coefficients: updated,
    evidence: summary,
    changes,
    notes: [
      "Only FIFA-official final Matchday 1 fixtures are used as observations.",
      "In-progress and scheduled Matchday 1 fixtures are stored but excluded from coefficient updates.",
      "No team-level ratings are rewritten from one match; changes are global calibration terms only.",
    ],
  };
}

function buildTeamInputs(
  groups: GroupDefinition[],
  teamStrength: TeamStrengthRow[],
  recentForm: RecentFormRow[],
  coefficients: CoefficientOutput,
): TeamInput[] {
  const strengthByTeam = new Map(teamStrength.map((row) => [teamKey(row.team), row]));
  const formByTeam = new Map(recentForm.map((row) => [teamKey(row.team), row]));
  const stats = buildInputStats(teamStrength, recentForm);
  const qualityWeights = coefficients.coefficients.markovMonteCarlo.qualityWeights;
  const inputs: TeamInput[] = [];

  for (const group of groups) {
    for (const rawTeam of group.teams) {
      const team = normalizeTeamName(rawTeam);
      const strength = required(strengthByTeam.get(teamKey(team)), `Missing team-strength row for ${team}.`);
      const form = required(formByTeam.get(teamKey(team)), `Missing recent-form row for ${team}.`);
      const fifaPointsScore = normalizeRange(strength.fifaPoints, stats.fifaPointsMin, stats.fifaPointsMax);
      const fifaRankScore = normalizeInverseRange(strength.fifaRank, stats.fifaRankMin, stats.fifaRankMax);
      const eloScore = strength.eloRating === undefined ? undefined : normalizeRange(strength.eloRating, stats.eloRatingMin, stats.eloRatingMax);
      const formPointsRate = form.formPoints / (form.matchesPlayed * 3);
      const qualityParts = [
        { value: fifaPointsScore, weight: qualityWeights.fifaPoints },
        { value: fifaRankScore, weight: qualityWeights.fifaRank },
        ...(eloScore === undefined ? [] : [{ value: eloScore, weight: qualityWeights.eloRating }]),
        { value: formPointsRate, weight: qualityWeights.recentFormPointsRate },
      ];
      const qualityWeight = qualityParts.reduce((sum, part) => sum + part.weight, 0);

      inputs.push({
        team: strength.team,
        countryCode: strength.countryCode,
        group: group.group,
        fifaRank: strength.fifaRank,
        fifaPoints: strength.fifaPoints,
        ...(strength.eloRank === undefined ? {} : { eloRank: strength.eloRank }),
        ...(strength.eloRating === undefined ? {} : { eloRating: strength.eloRating }),
        goalsForPerMatch: form.goalsForPerMatch,
        goalsAgainstPerMatch: form.goalsAgainstPerMatch,
        formPointsRate,
        attackIndex: clamp(form.goalsForPerMatch / stats.averageGoalsForPerMatch, 0.25, 2.75),
        defensiveVulnerabilityIndex: clamp(form.goalsAgainstPerMatch / stats.averageGoalsAgainstPerMatch, 0.2, 3.2),
        qualityScore: qualityParts.reduce((sum, part) => sum + part.value * part.weight, 0) / qualityWeight,
      });
    }
  }

  return inputs;
}

function buildFixtureDistributions(
  fixtures: OfficialFixture[],
  teamInputs: TeamInput[],
  coefficients: CoefficientOutput,
): FixtureDistribution[] {
  const byTeam = new Map(teamInputs.map((team) => [teamKey(team.team), team]));
  const baseGoalsPerTeamMatch = average(teamInputs.map((team) => team.goalsForPerMatch));
  return fixtures.map((fixture) => {
    const teamA = required(byTeam.get(teamKey(fixture.homeTeam)), `Missing input for ${fixture.homeTeam}.`);
    const teamB = required(byTeam.get(teamKey(fixture.awayTeam)), `Missing input for ${fixture.awayTeam}.`);
    const lambdaA = expectedGoals(teamA, teamB, coefficients, baseGoalsPerTeamMatch);
    const lambdaB = expectedGoals(teamB, teamA, coefficients, baseGoalsPerTeamMatch);
    const scoreDistribution = buildScoreDistribution(lambdaA, lambdaB, coefficients);
    return {
      group: fixture.group,
      teamA: teamA.team,
      teamB: teamB.team,
      lambdaA,
      lambdaB,
      scoreDistribution,
      mostLikelyScores: [...scoreDistribution]
        .sort((a, b) => b.probability - a.probability || a.goalsA - b.goalsA || a.goalsB - b.goalsB)
        .slice(0, 5)
        .map(({ goalsA, goalsB, probability }) => ({ goalsA, goalsB, probability })),
    };
  });
}

function buildScorePredictions(
  fixtures: OfficialFixture[],
  distributions: FixtureDistribution[],
  resultsOutput: MatchdayResultsOutput,
  selectedPredictions: SelectedPrediction[],
  previousMarkov: PreviousMarkovArtifact,
  coefficients: CoefficientOutput,
  generatedAt: string,
  includedMatchdays: number[],
): PredictionOutput {
  const finalMatchIds = new Set(resultsOutput.results.map((result) => result.matchId));
  const completedByMatchId = new Map(resultsOutput.results.map((result) => [result.matchId, result]));
  const distributionByMatchNumber = new Map(distributions.map((distribution, index) => [fixtures[index].matchNumber, distribution]));
  const matches = fixtures
    .filter((fixture) => includedMatchdays.includes(fixture.matchday))
    .filter((fixture) => !finalMatchIds.has(fixture.matchId))
    .map((fixture) => {
      const distribution = required(distributionByMatchNumber.get(fixture.matchNumber), `Missing distribution for match ${fixture.matchNumber}.`);
      return buildScorePredictionRow(fixture, distribution, completedByMatchId.get(fixture.matchId), selectedPredictions, previousMarkov, coefficients);
    });

  const predictionId = includedMatchdays.length === 1
    ? `matchday-${includedMatchdays[0]}-score-predictions-v2-after-matchday-1`
    : "group-stage-remaining-score-predictions-v2-after-matchday-1";

  return {
    artifactKind: "prediction",
    predictionId,
    predictionType: includedMatchdays.length === 1 ? "matchday_score_predictions" : "remaining_group_stage_score_predictions",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: {
      outputDirectory: PREDICTIONS_DIR,
      builderInputPaths: [TEAM_STRENGTH_PATH, RECENT_FORM_PATH, GROUPS_PATH, RULES_PATH, RESULTS_OUTPUT_PATH, COEFFICIENTS_OUTPUT_PATH],
      predictionDirectoryReadAsInput: false,
      notes: "Previous prediction artifacts are read only for evaluation/report comparison, not as future model inputs.",
    },
    basedOnData: {
      results: { path: RESULTS_OUTPUT_PATH },
      coefficients: { path: COEFFICIENTS_OUTPUT_PATH },
      teamStrength: { path: TEAM_STRENGTH_PATH },
      recentForm: { path: RECENT_FORM_PATH },
      officialFixtureApi: FIFA_MATCH_CALENDAR_API_URL,
    },
    method: {
      type: "v2_markov_score_distribution_with_matchday_1_calibration",
      modelParameters: coefficients.coefficients.markovMonteCarlo.modelParameters,
      scoreSelection: coefficients.coefficients.scoreSelection,
      noInventedInputs: true,
      unavailableInputsOmitted: ["injuries", "lineups", "weather forecast", "xG", "market probabilities", "squad quality", "venue/travel/rest model"],
    },
    scope: {
      includedMatchdays,
      includesIncompleteMatchday1Fixtures: matches.some((match) => match.matchday === 1),
      completedMatchday1FixturesExcluded: true,
    },
    matches,
  };
}

function buildScorePredictionRow(
  fixture: OfficialFixture,
  distribution: FixtureDistribution,
  actualResult: MatchdayResultRow | undefined,
  selectedPredictions: SelectedPrediction[],
  previousMarkov: PreviousMarkovArtifact,
  coefficients: CoefficientOutput,
): ScorePredictionRow {
  const oriented = distribution.scoreDistribution.map((score) => ({
    homeGoals: score.goalsA,
    awayGoals: score.goalsB,
    probability: score.probability,
  }));
  const metrics = required(calculateScoreDistributionMetrics(oriented), `Missing metrics for match ${fixture.matchNumber}.`);
  const mostProbable = metrics.topScorelines[0];
  const selected = selectScoreline(oriented, fixture.homeTeam, fixture.awayTeam, distribution, coefficients);
  const previousSelected = findSelectedPrediction(selectedPredictions, fixture.group, fixture.homeTeam, fixture.awayTeam);
  const previousSelectedScore = previousSelected ? orientSelectedPrediction(previousSelected, fixture.homeTeam, fixture.awayTeam) : undefined;
  const previousMostProbable = safePreviousMostProbable(previousMarkov, fixture.group, fixture.homeTeam, fixture.awayTeam);
  const selectedDiffers = selected.homeGoals !== mostProbable.homeGoals || selected.awayGoals !== mostProbable.awayGoals;

  return {
    matchId: fixture.matchId,
    matchNumber: fixture.matchNumber,
    group: fixture.group,
    matchday: fixture.matchday,
    date: fixture.date,
    utcDateTime: fixture.utcDateTime,
    localDateTime: fixture.localDateTime,
    venue: fixture.venue,
    ...(fixture.city ? { city: fixture.city } : {}),
    ...(fixture.country ? { country: fixture.country } : {}),
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    selectedPredictedScore: { home: selected.homeGoals, away: selected.awayGoals },
    mostProbableScore: { home: mostProbable.homeGoals, away: mostProbable.awayGoals },
    selectedScoreProbability: round(selected.probability),
    mostProbableScoreProbability: mostProbable.probability,
    probabilityDifferenceFromMostProbable: round(mostProbable.probability - selected.probability),
    selectedScoreDifferedFromMostProbable: selectedDiffers,
    outcomeProbabilities: { homeWin: metrics.homeWinProbability, draw: metrics.drawProbability, awayWin: metrics.awayWinProbability },
    expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
    topScorelines: metrics.topScorelines.map((score) => ({ homeGoals: score.homeGoals, awayGoals: score.awayGoals, probability: score.probability })),
    ...(previousSelectedScore || previousMostProbable
      ? {
          previousPrediction: {
            ...(previousSelectedScore ? { selectedScore: previousSelectedScore } : {}),
            ...(previousMostProbable ? { mostProbableScore: previousMostProbable } : {}),
          },
        }
      : {}),
    ...(actualResult
      ? { actualMatchday1Result: { home: actualResult.finalScore.home, away: actualResult.finalScore.away, outcome: actualResult.outcome } }
      : {}),
    updatedModelAdjustment: {
      baseGoalRateMultiplier: coefficients.coefficients.markovMonteCarlo.modelParameters.baseGoalRateMultiplier,
      qualityMultiplierScale: coefficients.coefficients.markovMonteCarlo.modelParameters.qualityMultiplierScale,
    },
    reasoningNote: selectedDiffers
      ? `Most probable score is ${mostProbable.homeGoals}-${mostProbable.awayGoals}; selected ${selected.homeGoals}-${selected.awayGoals} remains in the near-equal band after the v2 goal-rate and quality-spread calibration.`
      : `Selected score is the most probable v2 Markov bucket after Matchday 1 calibration.`,
  };
}

function selectScoreline(
  distribution: OrientedScore[],
  homeTeam: string,
  awayTeam: string,
  fixtureDistribution: FixtureDistribution,
  coefficients: CoefficientOutput,
): OrientedScore {
  const sorted = [...distribution].sort((a, b) => b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals);
  const top = sorted[0];
  const selection = coefficients.coefficients.scoreSelection;
  const nearEqual = sorted.filter(
    (score) =>
      score.probability >= top.probability * (1 - selection.nearEqualRelativeBand) ||
      top.probability - score.probability <= selection.nearEqualAbsoluteProbabilityBand,
  );
  const homeStronger = fixtureDistribution.lambdaA >= fixtureDistribution.lambdaB;
  return nearEqual.sort((a, b) => {
    const totalGap = b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals);
    if (selection.higherScoreTiebreak && totalGap !== 0) return totalGap;
    const aStrongerWins = strongerTeamWins(a, homeStronger);
    const bStrongerWins = strongerTeamWins(b, homeStronger);
    if (selection.strongerTeamTiebreak && aStrongerWins !== bStrongerWins) return bStrongerWins - aStrongerWins;
    const aDraw = a.homeGoals === a.awayGoals ? 1 : 0;
    const bDraw = b.homeGoals === b.awayGoals ? 1 : 0;
    if (selection.saferDrawFallback && aDraw !== bDraw) return bDraw - aDraw;
    return b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals;
  })[0] ?? top;
}

function strongerTeamWins(score: OrientedScore, homeStronger: boolean): number {
  if (homeStronger && score.homeGoals > score.awayGoals) return 1;
  if (!homeStronger && score.awayGoals > score.homeGoals) return 1;
  return 0;
}

function runConditionedMonteCarlo(
  fixtures: OfficialFixture[],
  distributions: FixtureDistribution[],
  resultsOutput: MatchdayResultsOutput,
  teamInputs: TeamInput[],
  groups: GroupDefinition[],
  rules: Rules,
  coefficients: CoefficientOutput,
  options: { iterations: number; seed: number },
  generatedAt: string,
) {
  const byTeam = new Map(teamInputs.map((team) => [teamKey(team.team), team]));
  const byMatchNumber = new Map(distributions.map((distribution, index) => [fixtures[index].matchNumber, distribution]));
  const finalResults = new Map(resultsOutput.results.map((result) => [result.matchNumber, result]));
  const rng = createMulberry32(options.seed);
  const accumulators = new Map(teamInputs.map((team) => [teamKey(team.team), createAccumulator(team)]));

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const groupResults = groups.map((group) => {
      const rows = new Map<string, TableRow>();
      for (const teamName of group.teams) rows.set(teamKey(teamName), createTableRow(required(byTeam.get(teamKey(teamName)), `Missing ${teamName}`)));
      const groupMatches: MatchResult[] = [];
      for (const fixture of fixtures.filter((item) => item.group === group.group)) {
        const final = finalResults.get(fixture.matchNumber);
        const match = final
          ? { teamA: final.homeTeam, teamB: final.awayTeam, goalsA: final.finalScore.home, goalsB: final.finalScore.away }
          : sampleFixture(fixture, required(byMatchNumber.get(fixture.matchNumber), `Missing distribution for ${fixture.matchNumber}`), rng);
        groupMatches.push(match);
        updateRows(rows, match, rules);
      }
      return { group: group.group, rankedRows: rankGroupRows([...rows.values()], groupMatches, rules), matches: groupMatches };
    });
    const qualifiedThirds = new Set(rankThirdPlaceRows(groupResults.map((groupResult) => groupResult.rankedRows[2])).slice(0, rules.bestThirdPlaceTeams).map((row) => teamKey(row.team)));
    for (const groupResult of groupResults) {
      for (const [index, row] of groupResult.rankedRows.entries()) {
        const accumulator = required(accumulators.get(teamKey(row.team)), `Missing accumulator for ${row.team}.`);
        const position = index + 1;
        accumulator.positionCounts[position] += 1;
        accumulator.pointsTotal += row.points;
        accumulator.goalsForTotal += row.goalsFor;
        accumulator.goalsAgainstTotal += row.goalsAgainst;
        accumulator.goalDifferenceTotal += row.goalDifference;
        if (position <= rules.topTeamsPerGroup) {
          accumulator.topTwoAdvances += 1;
          accumulator.advances += 1;
        } else if (position === 3) {
          accumulator.thirdPlaceFinishes += 1;
          if (qualifiedThirds.has(teamKey(row.team))) {
            accumulator.thirdPlaceAdvances += 1;
            accumulator.advances += 1;
          }
        }
      }
    }
  }

  const teamSummaries = [...accumulators.values()].map((accumulator) => summarizeAccumulator(accumulator, options.iterations));
  const summaryByTeam = new Map(teamSummaries.map((summary) => [teamKey(summary.team), summary]));
  const groupSummaries = groups.map((group) => ({
    group: group.group,
    predictedStandings: group.teams
      .map((team) => summaryByTeam.get(teamKey(team)))
      .filter((team): team is ReturnType<typeof summarizeAccumulator> => team !== undefined)
      .sort((a, b) => a.averagePosition - b.averagePosition || b.advanceProbability - a.advanceProbability || a.team.localeCompare(b.team))
      .map((team, index) => ({ predictedPosition: index + 1, ...team })),
  }));
  const thirdPlaceSummaries = teamSummaries
    .filter((team) => team.thirdPlaceFinishProbability > 0)
    .sort((a, b) => b.thirdPlaceAdvanceProbability - a.thirdPlaceAdvanceProbability || b.advanceProbability - a.advanceProbability || a.team.localeCompare(b.team));

  return {
    artifactKind: "prediction",
    predictionId: "group-stage-monte-carlo-v2-after-matchday-1",
    predictionType: "conditioned_group_stage_monte_carlo_after_matchday_1",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: {
      outputDirectory: PREDICTIONS_DIR,
      builderInputPaths: [TEAM_STRENGTH_PATH, RECENT_FORM_PATH, GROUPS_PATH, RULES_PATH, RESULTS_OUTPUT_PATH, COEFFICIENTS_OUTPUT_PATH],
      predictionDirectoryReadAsInput: false,
      notes: "Conditioned simulation uses official completed results and v2 coefficients; previous predictions are not used as inputs.",
    },
    simulation: {
      iterations: options.iterations,
      seed: options.seed,
      randomGenerator: "mulberry32",
      completedMatchday1FixturesConditioned: resultsOutput.results.length,
      incompleteMatchday1FixturesSimulated: resultsOutput.incompleteFixtures.length,
    },
    method: {
      type: "monte_carlo_group_stage_conditioned_on_completed_matchday_1_results",
      modelParameters: coefficients.coefficients.markovMonteCarlo.modelParameters,
      noInventedInputs: true,
      unavailableInputsOmitted: ["fair play/team conduct", "venue/host advantage", "injuries", "squad quality", "xG", "coach/tactics"],
    },
    basedOnData: {
      results: { path: RESULTS_OUTPUT_PATH },
      coefficients: { path: COEFFICIENTS_OUTPUT_PATH },
      teamStrength: { path: TEAM_STRENGTH_PATH },
      recentForm: { path: RECENT_FORM_PATH },
      officialFixtureApi: FIFA_MATCH_CALENDAR_API_URL,
    },
    groups: groupSummaries,
    thirdPlace: {
      predictedBestThirdPlaceTeams: thirdPlaceSummaries.slice(0, rules.bestThirdPlaceTeams),
      allThirdPlaceProbabilities: thirdPlaceSummaries,
    },
    teams: teamSummaries.sort((a, b) => b.advanceProbability - a.advanceProbability || a.averagePosition - b.averagePosition || a.team.localeCompare(b.team)),
  };
}

function buildUpdatedMarkovArtifact(
  fixtureDistributions: FixtureDistribution[],
  monteCarlo: ReturnType<typeof runConditionedMonteCarlo>,
  coefficients: CoefficientOutput,
  generatedAt: string,
) {
  return {
    artifactKind: "prediction",
    predictionId: "group-stage-markov-chain-v2-after-matchday-1",
    predictionType: "markov_chain_fixture_distributions_after_matchday_1",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: monteCarlo.contaminationControl,
    method: {
      type: "discrete_time_markov_chain_score_distribution_with_matchday_1_calibration",
      modelParameters: coefficients.coefficients.markovMonteCarlo.modelParameters,
      noInventedInputs: true,
      unavailableInputsOmitted: ["fair play/team conduct", "venue/host advantage", "injuries", "squad quality", "xG", "coach/tactics"],
    },
    basedOnData: monteCarlo.basedOnData,
    groups: monteCarlo.groups,
    thirdPlace: monteCarlo.thirdPlace,
    fixtureDistributions: fixtureDistributions.map((fixture) => ({
      group: fixture.group,
      teamA: fixture.teamA,
      teamB: fixture.teamB,
      lambdaA: fixture.lambdaA,
      lambdaB: fixture.lambdaB,
      mostLikelyScores: fixture.mostLikelyScores,
    })),
    teams: monteCarlo.teams,
  };
}

function sampleFixture(fixture: OfficialFixture, distribution: FixtureDistribution, rng: () => number): MatchResult {
  const score = sampleScore(distribution.scoreDistribution, rng);
  return { teamA: fixture.homeTeam, teamB: fixture.awayTeam, goalsA: score.goalsA, goalsB: score.goalsB };
}

function sampleScore(distribution: ScoreSample[], rng: () => number): ScoreSample {
  const value = rng();
  let cumulative = 0;
  for (const score of distribution) {
    cumulative += score.probability;
    if (value <= cumulative) return score;
  }
  return distribution[distribution.length - 1];
}

function createAccumulator(team: TeamInput): Accumulator {
  return {
    team: team.team,
    countryCode: team.countryCode,
    group: team.group,
    positionCounts: [0, 0, 0, 0, 0],
    topTwoAdvances: 0,
    thirdPlaceAdvances: 0,
    advances: 0,
    thirdPlaceFinishes: 0,
    pointsTotal: 0,
    goalsForTotal: 0,
    goalsAgainstTotal: 0,
    goalDifferenceTotal: 0,
  };
}

function summarizeAccumulator(accumulator: Accumulator, iterations: number) {
  const probability = (count: number) => round(count / iterations);
  return {
    team: accumulator.team,
    countryCode: accumulator.countryCode,
    group: accumulator.group,
    averagePosition: round((accumulator.positionCounts[1] + accumulator.positionCounts[2] * 2 + accumulator.positionCounts[3] * 3 + accumulator.positionCounts[4] * 4) / iterations),
    averagePoints: round(accumulator.pointsTotal / iterations),
    averageGoalsFor: round(accumulator.goalsForTotal / iterations),
    averageGoalsAgainst: round(accumulator.goalsAgainstTotal / iterations),
    averageGoalDifference: round(accumulator.goalDifferenceTotal / iterations),
    firstPlaceProbability: probability(accumulator.positionCounts[1]),
    secondPlaceProbability: probability(accumulator.positionCounts[2]),
    thirdPlaceProbability: probability(accumulator.positionCounts[3]),
    fourthPlaceProbability: probability(accumulator.positionCounts[4]),
    topTwoAdvanceProbability: probability(accumulator.topTwoAdvances),
    thirdPlaceFinishProbability: probability(accumulator.thirdPlaceFinishes),
    thirdPlaceAdvanceProbability: probability(accumulator.thirdPlaceAdvances),
    advanceProbability: probability(accumulator.advances),
    predictionFlags: {
      isPrediction: true,
      excludeFromFuturePredictionInputs: true,
      doNotUseAsTrainingData: true,
    },
  };
}

function createTableRow(team: TeamInput): TableRow {
  return {
    team: team.team,
    countryCode: team.countryCode,
    group: team.group,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    fifaRank: team.fifaRank,
    ...(team.eloRank === undefined ? {} : { eloRank: team.eloRank }),
  };
}

function updateRows(rows: Map<string, TableRow>, match: MatchResult, rules: Rules): void {
  const rowA = required(rows.get(teamKey(match.teamA)), `Missing table row for ${match.teamA}`);
  const rowB = required(rows.get(teamKey(match.teamB)), `Missing table row for ${match.teamB}`);
  rowA.played += 1;
  rowB.played += 1;
  rowA.goalsFor += match.goalsA;
  rowA.goalsAgainst += match.goalsB;
  rowB.goalsFor += match.goalsB;
  rowB.goalsAgainst += match.goalsA;
  rowA.goalDifference = rowA.goalsFor - rowA.goalsAgainst;
  rowB.goalDifference = rowB.goalsFor - rowB.goalsAgainst;
  if (match.goalsA > match.goalsB) {
    rowA.wins += 1;
    rowB.losses += 1;
    rowA.points += rules.winPoints;
  } else if (match.goalsA < match.goalsB) {
    rowB.wins += 1;
    rowA.losses += 1;
    rowB.points += rules.winPoints;
  } else {
    rowA.draws += 1;
    rowB.draws += 1;
    rowA.points += rules.drawPoints;
    rowB.points += rules.drawPoints;
  }
}

function rankGroupRows(rows: TableRow[], matches: MatchResult[], rules: Rules): TableRow[] {
  return breakTies(rows, [
    { direction: "desc" as const, score: (row: TableRow) => row.points },
    { direction: "desc" as const, score: (row: TableRow, tiedRows: TableRow[]) => headToHead(row, tiedRows, matches, rules).points },
    { direction: "desc" as const, score: (row: TableRow, tiedRows: TableRow[]) => headToHead(row, tiedRows, matches, rules).goalDifference },
    { direction: "desc" as const, score: (row: TableRow, tiedRows: TableRow[]) => headToHead(row, tiedRows, matches, rules).goalsFor },
    { direction: "desc" as const, score: (row: TableRow) => row.goalDifference },
    { direction: "desc" as const, score: (row: TableRow) => row.goalsFor },
    { direction: "asc" as const, score: (row: TableRow) => row.fifaRank },
  ]);
}

type TieCriterion = { direction: "asc" | "desc"; score: (row: TableRow, tiedRows: TableRow[]) => number };

function breakTies(rows: TableRow[], criteria: TieCriterion[], criterionIndex = 0): TableRow[] {
  if (rows.length <= 1 || criterionIndex >= criteria.length) {
    return [...rows].sort((a, b) => a.fifaRank - b.fifaRank || a.team.localeCompare(b.team));
  }
  const criterion = criteria[criterionIndex];
  const groups = new Map<number, TableRow[]>();
  for (const row of rows) {
    const score = criterion.score(row, rows);
    groups.set(score, [...(groups.get(score) ?? []), row]);
  }
  return [...groups.keys()]
    .sort((a, b) => (criterion.direction === "desc" ? b - a : a - b))
    .flatMap((score) => breakTies(groups.get(score) ?? [], criteria, criterionIndex + 1));
}

function headToHead(row: TableRow, tiedRows: TableRow[], matches: MatchResult[], rules: Rules) {
  const tiedKeys = new Set(tiedRows.map((tiedRow) => teamKey(tiedRow.team)));
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const match of matches) {
    const keyA = teamKey(match.teamA);
    const keyB = teamKey(match.teamB);
    if (!tiedKeys.has(keyA) || !tiedKeys.has(keyB)) continue;
    if (teamKey(row.team) === keyA) {
      goalsFor += match.goalsA;
      goalsAgainst += match.goalsB;
      if (match.goalsA > match.goalsB) points += rules.winPoints;
      else if (match.goalsA === match.goalsB) points += rules.drawPoints;
    } else if (teamKey(row.team) === keyB) {
      goalsFor += match.goalsB;
      goalsAgainst += match.goalsA;
      if (match.goalsB > match.goalsA) points += rules.winPoints;
      else if (match.goalsA === match.goalsB) points += rules.drawPoints;
    }
  }
  return { points, goalsFor, goalDifference: goalsFor - goalsAgainst };
}

function rankThirdPlaceRows(rows: TableRow[]): TableRow[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.fifaRank - b.fifaRank ||
      a.team.localeCompare(b.team),
  );
}

function expectedGoals(team: TeamInput, opponent: TeamInput, coefficients: CoefficientOutput, baseGoalsPerTeamMatch: number): number {
  const params = coefficients.coefficients.markovMonteCarlo.modelParameters;
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * params.qualityMultiplierScale);
  return round(
    clamp(
      baseGoalsPerTeamMatch * params.baseGoalRateMultiplier * Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex) * qualityMultiplier,
      params.lambdaMin,
      params.lambdaMax,
    ),
  );
}

function buildScoreDistribution(lambdaA: number, lambdaB: number, coefficients: CoefficientOutput): ScoreSample[] {
  const params = coefficients.coefficients.markovMonteCarlo.modelParameters;
  const pA = clamp(lambdaA / params.stepsPerMatch, 0, 0.25);
  const pB = clamp(lambdaB / params.stepsPerMatch, 0, 0.25);
  const pNoGoal = (1 - pA) * (1 - pB);
  const pAGoal = pA * (1 - pB);
  const pBGoal = (1 - pA) * pB;
  const pBothGoal = pA * pB;
  let states = new Map<string, number>([[scoreKey(0, 0), 1]]);

  for (let step = 0; step < params.stepsPerMatch; step += 1) {
    const nextStates = new Map<string, number>();
    for (const [key, probability] of states) {
      const [goalsA, goalsB] = parseScoreKey(key);
      addProbability(nextStates, goalsA, goalsB, probability * pNoGoal, params.pruneProbabilityBelow);
      addProbability(nextStates, goalsA + 1, goalsB, probability * pAGoal, params.pruneProbabilityBelow);
      addProbability(nextStates, goalsA, goalsB + 1, probability * pBGoal, params.pruneProbabilityBelow);
      addProbability(nextStates, goalsA + 1, goalsB + 1, probability * pBothGoal, params.pruneProbabilityBelow);
    }
    states = nextStates;
  }

  const totalProbability = [...states.values()].reduce((sum, probability) => sum + probability, 0);
  let cumulative = 0;
  return [...states.entries()]
    .map(([key, probability]) => {
      const [goalsA, goalsB] = parseScoreKey(key);
      const normalized = probability / totalProbability;
      cumulative += normalized;
      return { goalsA, goalsB, probability: round(normalized), cumulativeProbability: cumulative };
    })
    .sort((a, b) => (a.cumulativeProbability ?? 0) - (b.cumulativeProbability ?? 0));
}

function addProbability(states: Map<string, number>, goalsA: number, goalsB: number, probability: number, threshold: number): void {
  if (probability < threshold) return;
  const key = scoreKey(goalsA, goalsB);
  states.set(key, (states.get(key) ?? 0) + probability);
}

function poissonDistribution(lambdaHome: number, lambdaAway: number, maxGoals: number): OrientedScore[] {
  const scores: OrientedScore[] = [];
  for (let home = 0; home <= maxGoals; home += 1) {
    for (let away = 0; away <= maxGoals; away += 1) {
      scores.push({ homeGoals: home, awayGoals: away, probability: poissonProbability(home, lambdaHome) * poissonProbability(away, lambdaAway) });
    }
  }
  return scores;
}

function poissonProbability(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function factorial(value: number): number {
  let result = 1;
  for (let i = 2; i <= value; i += 1) result *= i;
  return result;
}

function parseSelectedPredictions(markdown: string): SelectedPrediction[] {
  const rows: SelectedPrediction[] = [];
  const rowPattern = /^\| Group ([A-L]): (.+?) vs (.+?) \| (.+?) (\d+)-(\d+) (.+?) \| (High|Medium|Low) \|/gm;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(markdown)) !== null) {
    rows.push({
      group: match[1],
      teamA: normalizeTeamName(match[2]),
      teamB: normalizeTeamName(match[3]),
      goalsA: Number(match[5]),
      goalsB: Number(match[6]),
      confidence: match[8],
      sourcePath: PREVIOUS_SCORE_REPORT_PATH,
    });
  }
  return rows;
}

function findSelectedPrediction(predictions: SelectedPrediction[], group: string, homeTeam: string, awayTeam: string): SelectedPrediction | undefined {
  const homeKey = teamKey(homeTeam);
  const awayKey = teamKey(awayTeam);
  return predictions.find((prediction) => {
    if (prediction.group !== group) return false;
    const aKey = teamKey(prediction.teamA);
    const bKey = teamKey(prediction.teamB);
    return (aKey === homeKey && bKey === awayKey) || (aKey === awayKey && bKey === homeKey);
  });
}

function orientSelectedPrediction(prediction: SelectedPrediction, homeTeam: string, awayTeam: string): { home: number; away: number } {
  if (teamKey(prediction.teamA) === teamKey(homeTeam) && teamKey(prediction.teamB) === teamKey(awayTeam)) {
    return { home: prediction.goalsA, away: prediction.goalsB };
  }
  if (teamKey(prediction.teamA) === teamKey(awayTeam) && teamKey(prediction.teamB) === teamKey(homeTeam)) {
    return { home: prediction.goalsB, away: prediction.goalsA };
  }
  throw new Error(`Prediction orientation mismatch for ${homeTeam} vs ${awayTeam}.`);
}

function orientPreviousDistribution(markov: PreviousMarkovArtifact, group: string, homeTeam: string, awayTeam: string): OrientedScore[] {
  const distribution = markov.fixtureDistributions?.find((fixture) => {
    if (fixture.group !== group) return false;
    const a = teamKey(fixture.teamA);
    const b = teamKey(fixture.teamB);
    return (a === teamKey(homeTeam) && b === teamKey(awayTeam)) || (a === teamKey(awayTeam) && b === teamKey(homeTeam));
  });
  if (!distribution) throw new Error(`Missing Markov distribution for ${group} ${homeTeam} vs ${awayTeam}.`);
  const sameDirection = teamKey(distribution.teamA) === teamKey(homeTeam);
  const samples = distribution.scoreDistribution ?? distribution.mostLikelyScores;
  return samples.map((sample) =>
    sameDirection
      ? { homeGoals: sample.goalsA, awayGoals: sample.goalsB, probability: sample.probability }
      : { homeGoals: sample.goalsB, awayGoals: sample.goalsA, probability: sample.probability },
  );
}

function safePreviousMostProbable(markov: PreviousMarkovArtifact, group: string, homeTeam: string, awayTeam: string): { home: number; away: number } | undefined {
  try {
    const metrics = calculateScoreDistributionMetrics(orientPreviousDistribution(markov, group, homeTeam, awayTeam));
    const top = metrics?.topScorelines[0];
    return top ? { home: top.homeGoals, away: top.awayGoals } : undefined;
  } catch {
    return undefined;
  }
}

function findScoreProbability(distribution: OrientedScore[], homeGoals: number, awayGoals: number): number | undefined {
  return distribution.find((score) => score.homeGoals === homeGoals && score.awayGoals === awayGoals)?.probability;
}

function buildEvaluationReport(evaluation: EvaluationOutput): string {
  const biggestMisses = [...evaluation.matches]
    .sort((a, b) => b.totalGoalsError + b.goalDifferenceError - (a.totalGoalsError + a.goalDifferenceError) || a.matchNumber - b.matchNumber)
    .slice(0, 8);
  const lines = [
    "# Matchday 1 Prediction Evaluation",
    "",
    `Generated: ${evaluation.generatedAt}`,
    "",
    `Official result file: \`${evaluation.sourceResultFile}\``,
    `Previous selected-score report: \`${evaluation.predictionSources.selectedScoreReport}\``,
    `Previous most-probable score source: \`${evaluation.predictionSources.markovChainPrediction}\``,
    "",
    "## Summary",
    "",
    `- Completed FIFA-official Matchday 1 fixtures evaluated: ${evaluation.summary.completedFixtures}`,
    `- Incomplete Matchday 1 fixtures excluded: ${evaluation.incompleteMatchday1FixtureCount}`,
    `- Exact-score hits: ${evaluation.summary.exactScoreHits}/${evaluation.summary.completedFixtures} (${percent(evaluation.summary.exactScoreHitRate)})`,
    `- Outcome hits: ${evaluation.summary.outcomeHits}/${evaluation.summary.completedFixtures} (${percent(evaluation.summary.outcomeHitRate)})`,
    `- Average goal-difference error: ${evaluation.summary.averageGoalDifferenceError}`,
    `- Average total-goals error: ${evaluation.summary.averageTotalGoalsError}`,
    "",
    "## Completed Fixtures",
    "",
    "| Match | Predicted | Actual | Exact | Outcome | GD error | Total-goals error | Selected vs most probable |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...evaluation.matches.map((row) =>
      `| ${row.group}: ${row.homeTeam} vs ${row.awayTeam} | ${row.predictedScore.home}-${row.predictedScore.away} | ${row.actualScore.home}-${row.actualScore.away} | ${yesNo(row.exactScoreHit)} | ${yesNo(row.outcomeHit)} | ${row.goalDifferenceError} | ${row.totalGoalsError} | ${row.selectedScoreDifferedFromMostProbable ? "Different" : "Same"} |`,
    ),
    "",
    "## Biggest Misses",
    "",
    "| Match | Predicted | Actual | GD error | Total-goals error |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...biggestMisses.map((row) =>
      `| ${row.group}: ${row.homeTeam} vs ${row.awayTeam} | ${row.predictedScore.home}-${row.predictedScore.away} | ${row.actualScore.home}-${row.actualScore.away} | ${row.goalDifferenceError} | ${row.totalGoalsError} |`,
    ),
    "",
    "## Incomplete Matchday 1 Fixtures",
    "",
    ...formatIncompleteList(evaluation.incompleteMatchday1Fixtures),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildModelUpdateReport(
  resultsOutput: MatchdayResultsOutput,
  evaluation: EvaluationOutput,
  coefficients: CoefficientOutput,
  remaining: PredictionOutput,
  matchday2: PredictionOutput,
  matchday3: PredictionOutput,
): string {
  const exactHits = evaluation.matches.filter((row) => row.exactScoreHit);
  const outcomeHits = evaluation.matches.filter((row) => row.outcomeHit);
  const biggestMisses = [...evaluation.matches]
    .sort((a, b) => b.totalGoalsError + b.goalDifferenceError - (a.totalGoalsError + a.goalDifferenceError) || a.matchNumber - b.matchNumber)
    .slice(0, 8);
  const lines = [
    "# Model Update After Matchday 1",
    "",
    `Generated: ${coefficients.generatedAt}`,
    "",
    "## Relevant Existing Project Files",
    "",
    "- Fixtures and groups: `fifa-world-cup-2026-groups.md`, `data\\fixtures\\group-fixtures.json`, `data\\fixtures\\group-fixtures.csv`.",
    "- Teams and normalization: `data\\teams\\teams.normalized.json`, `src\\normalize\\teams.ts`.",
    "- Team strength and form: `data\\model-input\\team-strength.json`, `data\\model-input\\recent-form.json`, `data\\squads\\squad-quality.json`.",
    "- Coefficients and weights: embedded in `src\\predict\\groupStandings.ts`, `src\\predict\\monteCarloGroupStage.ts`, and `src\\predict\\markovChainGroupStage.ts`.",
    "- Monte Carlo outputs: `src\\predict\\monteCarloGroupStage.ts`, `data\\predictions\\group-stage-monte-carlo-v1.json`.",
    "- Markov-chain outputs: `src\\predict\\markovChainGroupStage.ts`, `src\\predict\\scoreDistributionMetrics.ts`, `data\\predictions\\group-stage-markov-chain-v1.json`.",
    "- Previous score reports: `reports\\world-cup-2026-first-round-score-predictions.md`, `data\\predictions\\first-round-match-score-report-v1.md`.",
    "",
    "## Data Sources Used",
    "",
    `- FIFA official scores and fixtures page: ${FIFA_SCORES_URL}`,
    `- FIFA official match calendar API snapshot: ${FIFA_MATCH_CALENDAR_API_URL}`,
    `- Existing team strength: \`${TEAM_STRENGTH_PATH}\``,
    `- Existing recent form: \`${RECENT_FORM_PATH}\``,
    `- Previous selected predictions: \`${PREVIOUS_SCORE_REPORT_PATH}\``,
    `- Previous Markov distributions: \`${PREVIOUS_MARKOV_PATH}\``,
    "",
    "## Actual Matchday 1 Results",
    "",
    `Completed official finals: ${resultsOutput.completionStatus.completedFixtures}/${resultsOutput.completionStatus.expectedFixtures}.`,
    "",
    "| Match | Venue | Final | Outcome |",
    "| --- | --- | ---: | --- |",
    ...resultsOutput.results.map((row) => `| ${row.group}: ${row.homeTeam} vs ${row.awayTeam} | ${row.venue} | ${row.finalScore.home}-${row.finalScore.away} | ${formatOutcome(row.outcome)} |`),
    "",
    "## Incomplete Matchday 1 Fixtures",
    "",
    ...formatIncompleteList(resultsOutput.incompleteFixtures),
    "",
    "## Prediction Accuracy Summary",
    "",
    `- Exact-score hits: ${evaluation.summary.exactScoreHits}/${evaluation.summary.completedFixtures} (${percent(evaluation.summary.exactScoreHitRate)})`,
    `- Outcome hits: ${evaluation.summary.outcomeHits}/${evaluation.summary.completedFixtures} (${percent(evaluation.summary.outcomeHitRate)})`,
    `- Average goal-difference error: ${evaluation.summary.averageGoalDifferenceError}`,
    `- Average total-goals error: ${evaluation.summary.averageTotalGoalsError}`,
    `- Actual goals per completed match: ${evaluation.summary.actualGoalsPerMatch}`,
    `- V1 expected goals per completed match: ${evaluation.summary.predictedExpectedGoalsPerMatch}`,
    "",
    "## Biggest Misses",
    "",
    "| Match | Old prediction | Actual | GD error | Total-goals error |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...biggestMisses.map((row) => `| ${row.group}: ${row.homeTeam} vs ${row.awayTeam} | ${row.predictedScore.home}-${row.predictedScore.away} | ${row.actualScore.home}-${row.actualScore.away} | ${row.goalDifferenceError} | ${row.totalGoalsError} |`),
    "",
    "## Exact-Score Hits",
    "",
    ...(exactHits.length === 0 ? ["None."] : exactHits.map((row) => `- ${row.group}: ${row.homeTeam} vs ${row.awayTeam} (${row.actualScore.home}-${row.actualScore.away})`)),
    "",
    "## Outcome Hits",
    "",
    ...(outcomeHits.length === 0 ? ["None."] : outcomeHits.map((row) => `- ${row.group}: ${row.homeTeam} vs ${row.awayTeam} (${formatOutcome(row.actualOutcome)})`)),
    "",
    "## Coefficient Changes",
    "",
    "| Coefficient | Previous | Updated | Status | Rationale |",
    "| --- | ---: | ---: | --- | --- |",
    ...coefficients.changes.map((change) => `| ${change.coefficient} | ${change.previous} | ${change.updated} | ${change.status} | ${change.rationale} |`),
    "",
    "## Updated Predictions",
    "",
    "### Remaining Matchday 1 Fixtures",
    "",
    ...formatPredictionTable(remaining.matches.filter((match) => match.matchday === 1)),
    "",
    "### Matchday 2",
    "",
    ...formatPredictionTable(matchday2.matches),
    "",
    "### Matchday 3",
    "",
    ...formatPredictionTable(matchday3.matches),
    "",
    "## Risks And Limitations",
    "",
    "- Matchday 1 was not fully final in FIFA's official feed at fetch time; five fixtures are held out.",
    "- Nineteen matches are useful for calibration but not enough for team-specific ratings, squad-quality coefficients, or confederation adjustments.",
    "- The model still omits injuries, lineups, weather, xG, market odds, venue effects, travel, and rest because those inputs are not sourced in this repo.",
    "- Previous first-round assumptions did not always match the official post-draw fixture order, so evaluation uses the all-match score report plus Markov distributions rather than the older first-two-pairings-only report.",
    "",
    "## Next Update Point",
    "",
    "Update again after Matchday 2 finishes and all FIFA official scores are final. That gives each team two tournament observations and a better signal for calibration without leaning too hard on one surprise.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function formatPredictionTable(matches: ScorePredictionRow[]): string[] {
  if (matches.length === 0) return ["No fixtures in this scope."];
  return [
    "| Match | Old prediction | Actual MD1 result | Updated adjustment | New selected | Most probable | Outcome probabilities |",
    "| --- | ---: | ---: | --- | ---: | ---: | --- |",
    ...matches.map((match) => {
      const old = match.previousPrediction?.selectedScore
        ? `${match.previousPrediction.selectedScore.home}-${match.previousPrediction.selectedScore.away}`
        : "n/a";
      const actual = match.actualMatchday1Result
        ? `${match.actualMatchday1Result.home}-${match.actualMatchday1Result.away}`
        : "n/a";
      const adjustment = `goal ${match.updatedModelAdjustment.baseGoalRateMultiplier}, quality ${match.updatedModelAdjustment.qualityMultiplierScale}`;
      const outcomeProbabilities = `H ${percent(match.outcomeProbabilities.homeWin)} / D ${percent(match.outcomeProbabilities.draw)} / A ${percent(match.outcomeProbabilities.awayWin)}`;
      return `| ${match.group}: ${match.homeTeam} vs ${match.awayTeam} | ${old} | ${actual} | ${adjustment} | ${match.selectedPredictedScore.home}-${match.selectedPredictedScore.away} | ${match.mostProbableScore.home}-${match.mostProbableScore.away} | ${outcomeProbabilities} |`;
    }),
  ];
}

function formatIncompleteList(fixtures: IncompleteFixtureRow[]): string[] {
  if (fixtures.length === 0) return ["None."];
  return fixtures.map((fixture) => {
    const score = fixture.scoreAtFetch ? `, score at fetch ${fixture.scoreAtFetch.home}-${fixture.scoreAtFetch.away}` : "";
    return `- ${fixture.group}: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.status}${score}; ${fixture.date}, ${fixture.venue})`;
  });
}

function parseGroups(markdown: string): GroupDefinition[] {
  const groups: GroupDefinition[] = [];
  let current: GroupDefinition | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## Group ([A-L])$/);
    if (heading) {
      current = { group: heading[1], teams: [] };
      groups.push(current);
      continue;
    }
    if (line.startsWith("## ")) current = undefined;
    const team = line.match(/^-\s+(.+)$/)?.[1];
    if (team && current) current.teams.push(normalizeTeamName(team));
  }
  return groups;
}

function parseRules(value: unknown): Rules {
  const record = value as Record<string, unknown>;
  const pointsSystem = requireRecord(record.pointsSystem, "pointsSystem");
  const qualification = requireRecord(record.qualification, "qualification");
  const format = requireRecord(record.format, "format");
  const sources = Array.isArray(record.sources) ? (record.sources as Array<{ sourceName?: string; sourceUrl?: string }>) : [];
  return {
    winPoints: requireSourcedNumber(pointsSystem.win, "pointsSystem.win"),
    drawPoints: requireSourcedNumber(pointsSystem.draw, "pointsSystem.draw"),
    lossPoints: requireSourcedNumber(pointsSystem.loss, "pointsSystem.loss"),
    topTeamsPerGroup: requireSourcedNumber(qualification.topTeamsPerGroup, "qualification.topTeamsPerGroup"),
    bestThirdPlaceTeams: requireSourcedNumber(qualification.bestThirdPlaceTeams, "qualification.bestThirdPlaceTeams"),
    groupCount: requireSourcedNumber(format.groupCount, "format.groupCount"),
    teamsPerGroup: requireSourcedNumber(format.teamsPerGroup, "format.teamsPerGroup"),
    groupMatchesPerTeam: requireSourcedNumber(format.groupMatchesPerTeam, "format.groupMatchesPerTeam"),
    sources,
  };
}

function buildInputStats(teamStrength: TeamStrengthRow[], recentForm: RecentFormRow[]) {
  const fifaRanks = teamStrength.map((row) => row.fifaRank);
  const fifaPoints = teamStrength.map((row) => row.fifaPoints);
  const eloRatings = teamStrength.flatMap((row) => (row.eloRating === undefined ? [] : [row.eloRating]));
  return {
    fifaRankMin: Math.min(...fifaRanks),
    fifaRankMax: Math.max(...fifaRanks),
    fifaPointsMin: Math.min(...fifaPoints),
    fifaPointsMax: Math.max(...fifaPoints),
    eloRatingMin: Math.min(...eloRatings),
    eloRatingMax: Math.max(...eloRatings),
    averageGoalsForPerMatch: average(recentForm.map((row) => row.goalsForPerMatch)),
    averageGoalsAgainstPerMatch: average(recentForm.map((row) => row.goalsAgainstPerMatch)),
  };
}

function parseOptions(args: string[]) {
  const iterationsArg = args.find((arg) => arg.startsWith("--iterations="));
  const seedArg = args.find((arg) => arg.startsWith("--seed="));
  const iterations = iterationsArg ? Number(iterationsArg.split("=")[1]) : DEFAULT_ITERATIONS;
  const seed = seedArg ? Number(seedArg.split("=")[1]) : DEFAULT_SEED;
  if (!Number.isInteger(iterations) || iterations <= 0) throw new Error("--iterations must be a positive integer.");
  if (!Number.isInteger(seed)) throw new Error("--seed must be an integer.");
  return { iterations, seed };
}

function description(localized: Localized | undefined): string {
  const value = localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
  if (!value) throw new Error("Missing localized description.");
  return value;
}

function optionalDescription(localized: Localized | undefined): string | undefined {
  return localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
}

function groupLetter(value: string): string {
  const match = value.match(/Group ([A-L])/);
  if (!match) throw new Error(`Cannot parse group from ${value}.`);
  return match[1];
}

function matchdayFromMatchNumber(matchNumber: number): 1 | 2 | 3 {
  if (matchNumber >= 1 && matchNumber <= 24) return 1;
  if (matchNumber >= 25 && matchNumber <= 48) return 2;
  if (matchNumber >= 49 && matchNumber <= 72) return 3;
  throw new Error(`Match ${matchNumber} is not a group-stage match.`);
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function outcome(home: number, away: number): "home_win" | "draw" | "away_win" {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
}

function formatOutcome(value: "home_win" | "draw" | "away_win"): string {
  if (value === "home_win") return "home win";
  if (value === "away_win") return "away win";
  return "draw";
}

function isValidGoal(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function requireScore(value: unknown, matchNumber: number, side: string): number {
  if (!isValidGoal(value)) throw new Error(`Match ${matchNumber} ${side} score is missing or invalid.`);
  return value;
}

function normalizeRange(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return clamp((value - min) / (max - min), 0, 1);
}

function normalizeInverseRange(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return clamp((max - value) / (max - min), 0, 1);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampRelative(value: number, center: number, maxRelativeMove: number): number {
  return clamp(value, center * (1 - maxRelativeMove), center * (1 + maxRelativeMove));
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function scoreKey(goalsA: number, goalsB: number): string {
  return `${goalsA},${goalsB}`;
}

function parseScoreKey(key: string): [number, number] {
  const [goalsA, goalsB] = key.split(",").map(Number);
  return [goalsA, goalsB];
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Rules field ${label} is missing or invalid.`);
  return value as Record<string, unknown>;
}

function requireSourcedNumber(value: unknown, label: string): number {
  const record = requireRecord(value, label);
  if (typeof record.value !== "number") throw new Error(`Rules field ${label}.value is missing or not numeric.`);
  return record.value;
}

function assertNoPredictionInputs(paths: string[]): void {
  for (const path of paths) {
    const normalizedPath = normalize(path);
    if (normalizedPath === PREDICTIONS_DIR || normalizedPath.startsWith(`${PREDICTIONS_DIR}\\`)) {
      throw new Error(`Prediction input contamination blocked: ${path}`);
    }
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  updateAfterMatchday1().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
