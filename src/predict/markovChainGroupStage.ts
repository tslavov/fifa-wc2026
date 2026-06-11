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

const TEAM_STRENGTH_PATH = join("data", "model-input", "team-strength.json");
const RECENT_FORM_PATH = join("data", "model-input", "recent-form.json");
const RULES_PATH = join("data", "rules", "world-cup-2026-rules.json");
const GROUPS_PATH = "fifa-world-cup-2026-groups.md";
const OUTPUT_PATH = join("data", "predictions", "group-stage-markov-chain-v1.json");
const PREDICTIONS_DIR = normalize(join("data", "predictions"));
const DEFAULT_ITERATIONS = 20_000;
const DEFAULT_SEED = 20260607;
const STEPS_PER_MATCH = 90;
const PRUNE_PROBABILITY_BELOW = 1e-14;

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
type ModelParameters = {
  baseGoalsPerTeamMatch: number;
  qualityMultiplierScale: number;
  lambdaMin: number;
  lambdaMax: number;
  stepsPerMatch: number;
  pruneProbabilityBelow: number;
};
type ScoreSample = { goalsA: number; goalsB: number; probability: number; cumulativeProbability: number };
type FixtureDistribution = {
  group: string;
  teamA: string;
  teamB: string;
  lambdaA: number;
  lambdaB: number;
  scoreDistribution: ScoreSample[];
};
type MatchResult = { teamA: string; teamB: string; goalsA: number; goalsB: number };
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
type TeamSummary = {
  team: string;
  countryCode: string;
  group: string;
  averagePosition: number;
  averagePoints: number;
  averageGoalsFor: number;
  averageGoalsAgainst: number;
  averageGoalDifference: number;
  firstPlaceProbability: number;
  secondPlaceProbability: number;
  thirdPlaceProbability: number;
  fourthPlaceProbability: number;
  topTwoAdvanceProbability: number;
  thirdPlaceFinishProbability: number;
  thirdPlaceAdvanceProbability: number;
  advanceProbability: number;
  predictionFlags: {
    isPrediction: true;
    excludeFromFuturePredictionInputs: true;
    doNotUseAsTrainingData: true;
  };
};

export async function runMarkovChainGroupStagePrediction(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const options = parseOptions(process.argv.slice(2));
  const inputPaths = [TEAM_STRENGTH_PATH, RECENT_FORM_PATH, RULES_PATH, GROUPS_PATH];
  assertNoPredictionInputs(inputPaths);

  const teamStrength = TeamStrengthOutputSchema.parse(await readJson(TEAM_STRENGTH_PATH)) as OutputFile<TeamStrengthRow>;
  const recentForm = RecentFormOutputSchema.parse(await readJson(RECENT_FORM_PATH)) as OutputFile<RecentFormRow>;
  const rules = parseRules(await readJson(RULES_PATH));
  const groups = parseGroups(await readFile(GROUPS_PATH, "utf8"));
  validateGroupShape(groups, rules);

  const warnings = [
    ...(teamStrength.warnings ?? []).map((warning) => `Team-strength warning carried forward: ${warning}`),
    ...(recentForm.warnings ?? []).map((warning) => `Recent-form warning carried forward: ${warning}`),
    "Fair-play/team-conduct data is not collected in Phase 1; simulations skip that tiebreaker and use FIFA rank if all simulated scoreline tiebreakers remain tied.",
    "Host/venue advantage is not applied because fixture locations and home/away venue assignments are not in Phase 1 model input.",
  ];

  const teamInputs = buildTeamInputs(groups, teamStrength.rows, recentForm.rows, warnings);
  const modelParameters: ModelParameters = {
    baseGoalsPerTeamMatch: round(average(teamInputs.map((team) => team.goalsForPerMatch))),
    qualityMultiplierScale: 0.65,
    lambdaMin: 0.15,
    lambdaMax: 4.25,
    stepsPerMatch: STEPS_PER_MATCH,
    pruneProbabilityBelow: PRUNE_PROBABILITY_BELOW,
  };
  const fixtureDistributions = buildFixtureDistributions(groups, teamInputs, modelParameters);
  const distributionByFixture = new Map(fixtureDistributions.map((fixture) => [fixtureKey(fixture.group, fixture.teamA, fixture.teamB), fixture]));
  const rng = createMulberry32(options.seed);
  const accumulators = new Map(teamInputs.map((team) => [teamKey(team.team), createAccumulator(team)]));

  for (let i = 0; i < options.iterations; i += 1) {
    const simulation = simulateTournament(teamInputs, groups, rules, distributionByFixture, rng);
    const qualifiedThirds = new Set(simulation.qualifiedThirds.map((row) => teamKey(row.team)));
    for (const groupResult of simulation.groupResults) {
      for (const [index, row] of groupResult.rankedRows.entries()) {
        const accumulator = getAccumulator(accumulators, row.team);
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
      .filter((team): team is TeamSummary => team !== undefined)
      .sort(compareTeamSummaries)
      .map((team, index) => ({ predictedPosition: index + 1, ...team })),
  }));
  const thirdPlaceSummaries = teamSummaries
    .filter((team) => team.thirdPlaceFinishProbability > 0)
    .sort((a, b) => b.thirdPlaceAdvanceProbability - a.thirdPlaceAdvanceProbability || b.advanceProbability - a.advanceProbability || a.team.localeCompare(b.team));

  const output = {
    artifactKind: "prediction",
    predictionId: "group-stage-markov-chain-v1",
    predictionType: "group_stage_markov_chain",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: {
      outputDirectory: PREDICTIONS_DIR,
      builderInputPaths: inputPaths,
      predictionDirectoryReadAsInput: false,
      notes: "This artifact is an output for review only. Future collectors, features, model inputs, and predictions must not read data/predictions as input.",
    },
    simulation: {
      iterations: options.iterations,
      seed: options.seed,
      randomGenerator: "mulberry32",
      markovChainSimulations: options.iterations,
    },
    method: {
      type: "discrete_time_markov_chain_group_stage",
      languageModelUsedForTeamOrdering: false,
      matchModel:
        "Each match is a 90-step score-state Markov chain. At each step, team A and team B independently transition by scoring 0/1 goals using per-step probabilities derived from feature-based expected goals. Fixture score distributions are precomputed, then sampled in group-stage simulations.",
      stateDefinition: "State is (teamA goals, teamB goals) at minute-step t.",
      transitionDefinition:
        "From (a,b), transitions are (a,b), (a+1,b), (a,b+1), or (a+1,b+1) with Bernoulli scoring probabilities lambdaA/90 and lambdaB/90.",
      expectedGoalsModel:
        "Lambda = collected recent-form base goals * sqrt(team attack index * opponent defensive-vulnerability index) * exp((team quality score - opponent quality score) * qualityMultiplierScale), clamped to [lambdaMin, lambdaMax].",
      modelParameters,
      qualityScoreInputs: ["FIFA points", "inverse FIFA rank", "Elo rating when collected", "recent-form points rate"],
      noInventedInputs: true,
      unavailableInputsOmitted: ["fair play/team conduct", "venue/host advantage", "injuries", "squad quality", "xG", "coach/tactics"],
    },
    basedOnData: {
      teamStrength: { path: TEAM_STRENGTH_PATH, generatedAt: teamStrength.generatedAt },
      recentForm: { path: RECENT_FORM_PATH, generatedAt: recentForm.generatedAt },
      rules: { path: RULES_PATH, sourceNames: rules.sources.map((source) => source.sourceName).filter(Boolean) },
      groups: { path: GROUPS_PATH },
    },
    rulesApplied: {
      winPoints: rules.winPoints,
      drawPoints: rules.drawPoints,
      lossPoints: rules.lossPoints,
      topTeamsPerGroup: rules.topTeamsPerGroup,
      bestThirdPlaceTeams: rules.bestThirdPlaceTeams,
      groupTiebreakersApplied: ["points", "head-to-head points", "head-to-head goal difference", "head-to-head goals scored", "overall goal difference", "overall goals scored", "FIFA rank fallback"],
      thirdPlaceTiebreakersApplied: ["points", "goal difference", "goals scored", "FIFA rank fallback"],
      tiebreakerNotes: "Fair-play/team-conduct is an official criterion but is not simulated because Phase 1 has no card/team-conduct source.",
    },
    warnings,
    groups: groupSummaries,
    thirdPlace: {
      predictedBestThirdPlaceTeams: thirdPlaceSummaries.slice(0, rules.bestThirdPlaceTeams),
      allThirdPlaceProbabilities: thirdPlaceSummaries,
    },
    fixtureDistributions: fixtureDistributions.map((fixture) => ({
      group: fixture.group,
      teamA: fixture.teamA,
      teamB: fixture.teamB,
      lambdaA: fixture.lambdaA,
      lambdaB: fixture.lambdaB,
      scoreDistribution: fixture.scoreDistribution.map(({ goalsA, goalsB, probability }) => ({ goalsA, goalsB, probability })),
      mostLikelyScores: [...fixture.scoreDistribution]
        .sort((a, b) => b.probability - a.probability || a.goalsA - b.goalsA || a.goalsB - b.goalsB)
        .slice(0, 5)
        .map(({ goalsA, goalsB, probability }) => ({ goalsA, goalsB, probability })),
    })),
    teams: teamSummaries.sort((a, b) => b.advanceProbability - a.advanceProbability || a.averagePosition - b.averagePosition || a.team.localeCompare(b.team)),
  };

  await writeJson(OUTPUT_PATH, output);
  console.log(`Markov-chain group-stage prediction: wrote ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

function buildFixtureDistributions(groups: GroupDefinition[], teamInputs: TeamInput[], modelParameters: ModelParameters): FixtureDistribution[] {
  const byTeam = new Map(teamInputs.map((team) => [teamKey(team.team), team]));
  const fixtures: FixtureDistribution[] = [];
  for (const group of groups) {
    const teams = group.teams.map((team) => getTeamInput(byTeam, team));
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        const teamA = teams[i];
        const teamB = teams[j];
        const lambdaA = expectedGoals(teamA, teamB, modelParameters);
        const lambdaB = expectedGoals(teamB, teamA, modelParameters);
        fixtures.push({
          group: group.group,
          teamA: teamA.team,
          teamB: teamB.team,
          lambdaA,
          lambdaB,
          scoreDistribution: buildScoreDistribution(lambdaA, lambdaB, modelParameters),
        });
      }
    }
  }
  return fixtures;
}

function buildScoreDistribution(lambdaA: number, lambdaB: number, modelParameters: ModelParameters): ScoreSample[] {
  const pA = clamp(lambdaA / modelParameters.stepsPerMatch, 0, 0.25);
  const pB = clamp(lambdaB / modelParameters.stepsPerMatch, 0, 0.25);
  const pNoGoal = (1 - pA) * (1 - pB);
  const pAGoal = pA * (1 - pB);
  const pBGoal = (1 - pA) * pB;
  const pBothGoal = pA * pB;
  let states = new Map<string, number>([[scoreKey(0, 0), 1]]);

  for (let step = 0; step < modelParameters.stepsPerMatch; step += 1) {
    const nextStates = new Map<string, number>();
    for (const [key, probability] of states) {
      const [goalsA, goalsB] = parseScoreKey(key);
      addProbability(nextStates, goalsA, goalsB, probability * pNoGoal, modelParameters.pruneProbabilityBelow);
      addProbability(nextStates, goalsA + 1, goalsB, probability * pAGoal, modelParameters.pruneProbabilityBelow);
      addProbability(nextStates, goalsA, goalsB + 1, probability * pBGoal, modelParameters.pruneProbabilityBelow);
      addProbability(nextStates, goalsA + 1, goalsB + 1, probability * pBothGoal, modelParameters.pruneProbabilityBelow);
    }
    states = nextStates;
  }

  const totalProbability = [...states.values()].reduce((sum, probability) => sum + probability, 0);
  let cumulativeProbability = 0;
  return [...states.entries()]
    .map(([key, probability]) => {
      const [goalsA, goalsB] = parseScoreKey(key);
      const normalizedProbability = probability / totalProbability;
      cumulativeProbability += normalizedProbability;
      return { goalsA, goalsB, probability: round(normalizedProbability), cumulativeProbability };
    })
    .sort((a, b) => a.cumulativeProbability - b.cumulativeProbability)
    .map((sample, index, samples) => ({
      ...sample,
      cumulativeProbability: index === samples.length - 1 ? 1 : sample.cumulativeProbability,
    }));
}

function simulateTournament(
  teamInputs: TeamInput[],
  groups: GroupDefinition[],
  rules: Rules,
  distributionByFixture: Map<string, FixtureDistribution>,
  rng: () => number,
) {
  const byTeam = new Map(teamInputs.map((team) => [teamKey(team.team), team]));
  const groupResults = groups.map((group) => simulateGroup(group, byTeam, rules, distributionByFixture, rng));
  const thirdPlaceRows = groupResults.map((groupResult) => groupResult.rankedRows[2]);
  const qualifiedThirds = rankThirdPlaceRows(thirdPlaceRows).slice(0, rules.bestThirdPlaceTeams);
  return { groupResults, qualifiedThirds };
}

function simulateGroup(
  group: GroupDefinition,
  byTeam: Map<string, TeamInput>,
  rules: Rules,
  distributionByFixture: Map<string, FixtureDistribution>,
  rng: () => number,
) {
  const rows = new Map<string, TableRow>();
  const matches: MatchResult[] = [];
  const teams = group.teams.map((team) => getTeamInput(byTeam, team));
  for (const team of teams) rows.set(teamKey(team.team), createTableRow(team));

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const teamA = teams[i];
      const teamB = teams[j];
      const fixture = distributionByFixture.get(fixtureKey(group.group, teamA.team, teamB.team));
      if (!fixture) throw new Error(`Missing score distribution for ${teamA.team} vs ${teamB.team}.`);
      const score = sampleScore(fixture.scoreDistribution, rng);
      const match = { teamA: teamA.team, teamB: teamB.team, goalsA: score.goalsA, goalsB: score.goalsB };
      matches.push(match);
      updateRows(rows, match, rules);
    }
  }

  return { group: group.group, rankedRows: rankGroupRows([...rows.values()], matches, rules), matches };
}

function sampleScore(distribution: ScoreSample[], rng: () => number): ScoreSample {
  const value = rng();
  let low = 0;
  let high = distribution.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (value <= distribution[mid].cumulativeProbability) high = mid;
    else low = mid + 1;
  }
  return distribution[low];
}

function expectedGoals(team: TeamInput, opponent: TeamInput, modelParameters: ModelParameters): number {
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * modelParameters.qualityMultiplierScale);
  return round(
    clamp(
      modelParameters.baseGoalsPerTeamMatch * Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex) * qualityMultiplier,
      modelParameters.lambdaMin,
      modelParameters.lambdaMax,
    ),
  );
}

function updateRows(rows: Map<string, TableRow>, match: MatchResult, rules: Rules): void {
  const rowA = getTableRow(rows, match.teamA);
  const rowB = getTableRow(rows, match.teamB);
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
    rowB.points += rules.lossPoints;
  } else if (match.goalsA < match.goalsB) {
    rowB.wins += 1;
    rowA.losses += 1;
    rowB.points += rules.winPoints;
    rowA.points += rules.lossPoints;
  } else {
    rowA.draws += 1;
    rowB.draws += 1;
    rowA.points += rules.drawPoints;
    rowB.points += rules.drawPoints;
  }
}

function rankGroupRows(rows: TableRow[], matches: MatchResult[], rules: Rules): TableRow[] {
  return breakTies(rows, [
    { direction: "desc", score: (row: TableRow) => row.points },
    { direction: "desc", score: (row: TableRow, tiedRows: TableRow[]) => headToHead(row, tiedRows, matches, rules).points },
    { direction: "desc", score: (row: TableRow, tiedRows: TableRow[]) => headToHead(row, tiedRows, matches, rules).goalDifference },
    { direction: "desc", score: (row: TableRow, tiedRows: TableRow[]) => headToHead(row, tiedRows, matches, rules).goalsFor },
    { direction: "desc", score: (row: TableRow) => row.goalDifference },
    { direction: "desc", score: (row: TableRow) => row.goalsFor },
    { direction: "asc", score: (row: TableRow) => row.fifaRank },
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

function buildTeamInputs(groups: GroupDefinition[], teamStrength: TeamStrengthRow[], recentForm: RecentFormRow[], warnings: string[]): TeamInput[] {
  const strengthByTeam = new Map(teamStrength.map((row) => [teamKey(row.team), row]));
  const formByTeam = new Map(recentForm.map((row) => [teamKey(row.team), row]));
  const stats = buildInputStats(teamStrength, recentForm);
  const inputs: TeamInput[] = [];
  for (const group of groups) {
    for (const rawTeam of group.teams) {
      const team = normalizeTeamName(rawTeam);
      const strength = strengthByTeam.get(teamKey(team));
      const form = formByTeam.get(teamKey(team));
      if (!strength) throw new Error(`Missing team-strength row for ${team}.`);
      if (!form) throw new Error(`Missing recent-form row for ${team}.`);
      if (strength.eloRating === undefined) warnings.push(`No Elo rating available for ${team}; quality score uses FIFA and recent-form components only.`);

      const fifaPointsScore = normalizeRange(strength.fifaPoints, stats.fifaPointsMin, stats.fifaPointsMax);
      const fifaRankScore = normalizeInverseRange(strength.fifaRank, stats.fifaRankMin, stats.fifaRankMax);
      const eloScore = strength.eloRating === undefined ? undefined : normalizeRange(strength.eloRating, stats.eloRatingMin, stats.eloRatingMax);
      const formPointsRate = form.formPoints / (form.matchesPlayed * 3);
      const qualityParts = [
        { value: fifaPointsScore, weight: 0.35 },
        { value: fifaRankScore, weight: 0.2 },
        ...(eloScore === undefined ? [] : [{ value: eloScore, weight: 0.3 }]),
        { value: formPointsRate, weight: 0.15 },
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

function parseGroups(markdown: string): GroupDefinition[] {
  const groups: GroupDefinition[] = [];
  let currentGroup: GroupDefinition | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## Group ([A-L])$/);
    if (heading) {
      currentGroup = { group: heading[1], teams: [] };
      groups.push(currentGroup);
      continue;
    }
    if (line.startsWith("## ") && currentGroup) {
      currentGroup = undefined;
      continue;
    }
    const team = line.match(/^-\s+(.+)$/)?.[1];
    if (team && currentGroup) currentGroup.teams.push(normalizeTeamName(team));
  }
  return groups;
}

function parseRules(value: unknown): Rules {
  const record = value as Record<string, unknown>;
  const pointsSystem = requireRecord(record.pointsSystem, "pointsSystem");
  const qualification = requireRecord(record.qualification, "qualification");
  const format = requireRecord(record.format, "format");
  const sources = Array.isArray(record.sources) ? (record.sources as Array<{ sourceName?: string; sourceUrl?: string }>) : [];
  if (!sources.some((source) => source.sourceName?.toLowerCase().includes("fifa") || source.sourceUrl?.includes("fifa.com"))) {
    throw new Error("Rules file must include at least one FIFA source.");
  }
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

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Rules field ${label} is missing or invalid.`);
  return value as Record<string, unknown>;
}

function requireSourcedNumber(value: unknown, label: string): number {
  const record = requireRecord(value, label);
  if (typeof record.value !== "number") throw new Error(`Rules field ${label}.value is missing or not numeric.`);
  const source = record.source as { sourceName?: string; sourceUrl?: string } | undefined;
  if (!source || (!source.sourceName?.toLowerCase().includes("fifa") && !source.sourceUrl?.includes("fifa.com"))) {
    throw new Error(`Rules field ${label} must be sourced from FIFA.`);
  }
  return record.value;
}

function validateGroupShape(groups: GroupDefinition[], rules: Rules): void {
  if (groups.length !== rules.groupCount) throw new Error(`Expected ${rules.groupCount} groups but found ${groups.length}.`);
  for (const group of groups) {
    if (group.teams.length !== rules.teamsPerGroup) throw new Error(`Expected ${rules.teamsPerGroup} teams in Group ${group.group} but found ${group.teams.length}.`);
  }
  if (rules.groupMatchesPerTeam !== rules.teamsPerGroup - 1) throw new Error("Rules groupMatchesPerTeam does not match teamsPerGroup - 1.");
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

function summarizeAccumulator(accumulator: Accumulator, iterations: number): TeamSummary {
  const probability = (count: number) => round(count / iterations);
  const averagePosition = round((accumulator.positionCounts[1] + accumulator.positionCounts[2] * 2 + accumulator.positionCounts[3] * 3 + accumulator.positionCounts[4] * 4) / iterations);
  return {
    team: accumulator.team,
    countryCode: accumulator.countryCode,
    group: accumulator.group,
    averagePosition,
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

function compareTeamSummaries(a: TeamSummary, b: TeamSummary): number {
  return a.averagePosition - b.averagePosition || b.advanceProbability - a.advanceProbability || b.firstPlaceProbability - a.firstPlaceProbability || a.team.localeCompare(b.team);
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

function parseOptions(args: string[]) {
  const iterationsArg = args.find((arg) => arg.startsWith("--iterations="));
  const seedArg = args.find((arg) => arg.startsWith("--seed="));
  const iterations = iterationsArg ? Number(iterationsArg.split("=")[1]) : DEFAULT_ITERATIONS;
  const seed = seedArg ? Number(seedArg.split("=")[1]) : DEFAULT_SEED;
  if (!Number.isInteger(iterations) || iterations <= 0) throw new Error("--iterations must be a positive integer.");
  if (!Number.isInteger(seed)) throw new Error("--seed must be an integer.");
  return { iterations, seed };
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

function addProbability(states: Map<string, number>, goalsA: number, goalsB: number, probability: number, threshold: number): void {
  if (probability < threshold) return;
  const key = scoreKey(goalsA, goalsB);
  states.set(key, (states.get(key) ?? 0) + probability);
}

function getTeamInput(byTeam: Map<string, TeamInput>, team: string): TeamInput {
  const row = byTeam.get(teamKey(team));
  if (!row) throw new Error(`Missing simulation input for ${team}.`);
  return row;
}

function getTableRow(rows: Map<string, TableRow>, team: string): TableRow {
  const row = rows.get(teamKey(team));
  if (!row) throw new Error(`Missing table row for ${team}.`);
  return row;
}

function getAccumulator(accumulators: Map<string, Accumulator>, team: string): Accumulator {
  const accumulator = accumulators.get(teamKey(team));
  if (!accumulator) throw new Error(`Missing accumulator for ${team}.`);
  return accumulator;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeRange(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return clamp((value - min) / (max - min), 0, 1);
}

function normalizeInverseRange(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return clamp((max - value) / (max - min), 0, 1);
}

function scoreKey(goalsA: number, goalsB: number): string {
  return `${goalsA},${goalsB}`;
}

function parseScoreKey(key: string): [number, number] {
  const [goalsA, goalsB] = key.split(",").map(Number);
  return [goalsA, goalsB];
}

function fixtureKey(group: string, teamA: string, teamB: string): string {
  return `${group}|${teamKey(teamA)}|${teamKey(teamB)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
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
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMarkovChainGroupStagePrediction().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
