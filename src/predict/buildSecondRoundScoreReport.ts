import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const MATCHDAY_2_PREDICTIONS_PATH = join("data", "predictions", "matchday-2-score-predictions-v2-after-matchday-1.json");
const MATCHDAY_1_RESULTS_PATH = join("data", "results", "group-stage-matchday-1-results-v1.json");
const COEFFICIENTS_PATH = join("data", "model", "coefficients-v2-after-matchday-1.json");
const OUTPUT_PATH = join("data", "predictions", "second-round-match-score-report-v2-after-matchday-1.md");

type PredictionOutput = {
  generatedAt: string;
  basedOnData: {
    results: { path: string };
    coefficients: { path: string };
    teamStrength: { path: string };
    recentForm: { path: string };
    officialFixtureApi: string;
  };
  method: {
    type: string;
    modelParameters: {
      baseGoalRateMultiplier: number;
      qualityMultiplierScale: number;
      lambdaMin: number;
      lambdaMax: number;
    };
    scoreSelection: {
      nearEqualRelativeBand: number;
      nearEqualAbsoluteProbabilityBand: number;
      higherScoreTiebreak: boolean;
      strongerTeamTiebreak: boolean;
      saferDrawFallback: boolean;
    };
    unavailableInputsOmitted: string[];
  };
  matches: MatchPrediction[];
};

type MatchPrediction = {
  matchId: string;
  matchNumber: number;
  group: string;
  matchday: number;
  date: string;
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
  topScorelines: Array<{ homeGoals: number; awayGoals: number; probability: number }>;
  previousPrediction?: {
    selectedScore?: { home: number; away: number };
    mostProbableScore?: { home: number; away: number };
  };
  updatedModelAdjustment: {
    baseGoalRateMultiplier: number;
    qualityMultiplierScale: number;
  };
  reasoningNote: string;
};

type ResultsOutput = {
  completionStatus: {
    expectedFixtures: number;
    completedFixtures: number;
    incompleteFixtures: number;
    allMatchday1FixturesFinal: boolean;
  };
  incompleteFixtures: Array<{
    group: string;
    homeTeam: string;
    awayTeam: string;
    status: string;
    scoreAtFetch?: { home: number; away: number };
  }>;
};

type CoefficientsOutput = {
  generatedAt: string;
  update_method: string;
  caps_applied: {
    evidenceWeight: number;
    relativeCoefficientMoveCap: number;
  };
  changes: Array<{
    coefficient: string;
    previous: number | string;
    updated: number | string;
    status: string;
  }>;
};

export async function buildSecondRoundScoreReport(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const predictions = await readJson<PredictionOutput>(MATCHDAY_2_PREDICTIONS_PATH);
  const results = await readJson<ResultsOutput>(MATCHDAY_1_RESULTS_PATH);
  const coefficients = await readJson<CoefficientsOutput>(COEFFICIENTS_PATH);

  if (predictions.matches.some((match) => match.matchday !== 2)) {
    throw new Error(`${MATCHDAY_2_PREDICTIONS_PATH} contains non-Matchday 2 rows.`);
  }

  const matches = [...predictions.matches].sort((a, b) => a.group.localeCompare(b.group) || a.matchNumber - b.matchNumber);
  const confidenceCounts = countBy(matches.map(confidenceLabel));
  const selectedDiffers = matches.filter((match) => match.selectedScoreDifferedFromMostProbable).length;

  const lines = [
    "# FIFA World Cup 2026 Second-Round Match Score Predictions",
    "",
    `Generated: ${generatedAt}`,
    "",
    "noFutureUse: true",
    "",
    "This is a prediction report only. Do not use it as collected data, training data, model input, or future prediction input.",
    "",
    "## Method",
    "",
    "Predicted scores are generated from the Matchday 2 v2 score-prediction artifact created after the Matchday 1 update.",
    "",
    `- Prediction input: \`${MATCHDAY_2_PREDICTIONS_PATH}\`.`,
    `- Matchday 1 result context: \`${MATCHDAY_1_RESULTS_PATH}\`.`,
    `- Updated coefficient version: \`${COEFFICIENTS_PATH}\`.`,
    `- Team-strength and recent-form inputs: \`${predictions.basedOnData.teamStrength.path}\`, \`${predictions.basedOnData.recentForm.path}\`.`,
    "- The selected score can differ from the most probable individual bucket when it remains inside the near-equal scoreline band and the existing score-selection tiebreaks choose a more informative result.",
    "- LLM-style qualitative text is explanatory only; no injuries, lineups, tactical news, weather, xG, market prices, or squad-quality assumptions are invented.",
    "",
    "## Matchday 1 Context",
    "",
    `- FIFA-official completed Matchday 1 finals at update time: ${results.completionStatus.completedFixtures}/${results.completionStatus.expectedFixtures}.`,
    `- Matchday 1 fixtures not final at update time: ${results.completionStatus.incompleteFixtures}.`,
    `- Base goal-rate multiplier: ${predictions.method.modelParameters.baseGoalRateMultiplier}.`,
    `- Quality multiplier scale: ${predictions.method.modelParameters.qualityMultiplierScale}.`,
    `- Evidence weight: ${coefficients.caps_applied.evidenceWeight}; coefficient movement cap: ${percent(coefficients.caps_applied.relativeCoefficientMoveCap)} relative.`,
    "",
    "## Summary",
    "",
    `Confidence counts: High ${confidenceCounts.High ?? 0}, Medium ${confidenceCounts.Medium ?? 0}, Low ${confidenceCounts.Low ?? 0}.`,
    `Selected score differed from the most probable score in ${selectedDiffers} of ${matches.length} matches.`,
    "",
    "| Match | Selected score | Most probable | W/D/L | Confidence | Notes |",
    "| --- | ---: | ---: | ---: | --- | --- |",
    ...matches.map((match) => {
      const selected = formatTeamScore(match, match.selectedPredictedScore);
      const mostProbable = `${match.mostProbableScore.home}-${match.mostProbableScore.away} (${percent(match.mostProbableScoreProbability)})`;
      return `| Group ${match.group}: ${match.homeTeam} vs ${match.awayTeam} | ${selected} | ${mostProbable} | ${formatWdl(match)} | ${confidenceLabel(match)} | ${summaryNote(match)} |`;
    }),
    "",
    "## Match Details",
    "",
  ];

  for (const group of unique(matches.map((match) => match.group))) {
    lines.push(`### Group ${group}`, "");
    lines.push("| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |");
    lines.push("| --- | --- | ---: | ---: | ---: | ---: | --- | --- |");
    for (const match of matches.filter((item) => item.group === group)) {
      lines.push(
        `| ${match.homeTeam} vs ${match.awayTeam} | ${formatDateVenue(match)} | ${formatPreviousPick(match)} | ${formatTeamScore(match, match.selectedPredictedScore)} | ${match.mostProbableScore.home}-${match.mostProbableScore.away} (${percent(match.mostProbableScoreProbability)}) | ${match.expectedGoals.home.toFixed(2)}-${match.expectedGoals.away.toFixed(2)} | ${formatTopScorelines(match)} | ${detailNote(match)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Coefficient Changes Used", "");
  lines.push("| Coefficient | Previous | Updated | Status |");
  lines.push("| --- | ---: | ---: | --- |");
  for (const change of coefficients.changes) {
    lines.push(`| ${change.coefficient} | ${change.previous} | ${change.updated} | ${change.status} |`);
  }
  lines.push("");

  if (results.incompleteFixtures.length > 0) {
    lines.push("## Matchday 1 Non-Final Fixtures At Update Time", "");
    for (const fixture of results.incompleteFixtures) {
      const score = fixture.scoreAtFetch ? `, score at fetch ${fixture.scoreAtFetch.home}-${fixture.scoreAtFetch.away}` : "";
      lines.push(`- Group ${fixture.group}: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.status}${score}).`);
    }
    lines.push("");
  }

  await writeText(OUTPUT_PATH, `${lines.join("\n")}\n`);
  console.log(`Second-round score report: wrote ${OUTPUT_PATH}`);
}

function confidenceLabel(match: MatchPrediction): "High" | "Medium" | "Low" {
  const maxOutcome = Math.max(match.outcomeProbabilities.homeWin, match.outcomeProbabilities.draw, match.outcomeProbabilities.awayWin);
  if (match.selectedScoreProbability >= 0.1 && maxOutcome >= 0.65) return "High";
  if (match.selectedScoreProbability >= 0.075 || maxOutcome >= 0.55) return "Medium";
  return "Low";
}

function summaryNote(match: MatchPrediction): string {
  if (!match.selectedScoreDifferedFromMostProbable) return "Selected score is the most probable bucket.";
  return `Selected differs by ${percent(match.probabilityDifferenceFromMostProbable)} but remains in the near-equal band.`;
}

function detailNote(match: MatchPrediction): string {
  const favorite = favoriteLabel(match);
  const selectedDiff = match.selectedScoreDifferedFromMostProbable
    ? `Most probable bucket is ${match.mostProbableScore.home}-${match.mostProbableScore.away}; selected score remains close enough for the existing tiebreak rule.`
    : "Selected score is the most probable bucket.";
  return `${favorite} ${selectedDiff} ${match.reasoningNote}`;
}

function favoriteLabel(match: MatchPrediction): string {
  const entries = [
    { label: `${match.homeTeam} lean`, value: match.outcomeProbabilities.homeWin },
    { label: "draw risk", value: match.outcomeProbabilities.draw },
    { label: `${match.awayTeam} lean`, value: match.outcomeProbabilities.awayWin },
  ].sort((a, b) => b.value - a.value);
  const top = entries[0];
  return `${top.label} leads outcome probabilities at ${percent(top.value)}.`;
}

function formatTeamScore(match: MatchPrediction, score: { home: number; away: number }): string {
  return `${match.homeTeam} ${score.home}-${score.away} ${match.awayTeam}`;
}

function formatPreviousPick(match: MatchPrediction): string {
  const previous = match.previousPrediction?.selectedScore;
  if (!previous) return "not available";
  return `${previous.home}-${previous.away}`;
}

function formatWdl(match: MatchPrediction): string {
  return `H ${percent(match.outcomeProbabilities.homeWin)} / D ${percent(match.outcomeProbabilities.draw)} / A ${percent(match.outcomeProbabilities.awayWin)}`;
}

function formatTopScorelines(match: MatchPrediction): string {
  return match.topScorelines.map((score) => `${score.homeGoals}-${score.awayGoals} (${percent(score.probability)})`).join(", ");
}

function formatDateVenue(match: MatchPrediction): string {
  const time = match.localDateTime.slice(11, 16);
  const place = [match.venue, match.city].filter(Boolean).join(", ");
  return `${match.date} ${time} local; ${place}`;
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function countBy<T extends string>(values: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSecondRoundScoreReport().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
