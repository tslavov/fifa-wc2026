import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const RESULTS = "data/results/round-of-16-results-v1.json";
const TEAM_STATS = "data/knockout/quarter-final-team-stats-v1.json";
const PREDICTIONS = "data/predictions/quarter-final-score-predictions-v1.json";
const AVAILABILITY = "data/context/quarter-final-player-availability-v1.json";

const [results, teamStats, predictions, availability] = await Promise.all([
  readJson(RESULTS),
  readJson(TEAM_STATS),
  readJson(PREDICTIONS),
  readJson(AVAILABILITY),
]);

assert(results.results.length === 8, "one match cannot be appended twice; expected exactly 8 Round of 16 results");
assert(new Set(results.results.map((match) => match.matchNumber)).size === 8, "Round of 16 match numbers must be unique");
assert(teamStats.teams.length === 8, "quarter-final team stats must contain exactly 8 advancing teams");

for (const match of results.results) {
  assert(match.regulationScore && Number.isFinite(match.regulationScore.home) && Number.isFinite(match.regulationScore.away), `missing regulation score for ${match.matchNumber}`);
  assert(match.duration.playingMinutes === (match.extraTimePlayed ? 120 : 90), `fatigue must use normalized playingMinutes for ${match.matchNumber}`);
  assert(match.duration.elapsedClockMinutes === null || match.duration.elapsedClockMinutes >= match.duration.playingMinutes, `elapsed clock should be preserved separately for ${match.matchNumber}`);
  if (match.penaltiesPlayed) {
    assert(match.penaltyScore, `penalty score must be stored separately for ${match.matchNumber}`);
    assert(match.finalScore.home === match.scoreAfterExtraTime.home && match.finalScore.away === match.scoreAfterExtraTime.away, `penalties must not enter normal goals for ${match.matchNumber}`);
  }
}

const swiss = results.results.find((match) => match.matchNumber === 96);
assert(swiss.duration.playingMinutes === 120 && swiss.duration.elapsedClockMinutes === 130 && swiss.penaltiesPlayed, "Switzerland-Colombia must be 120 playing minutes plus separate penalties");

for (const team of teamStats.teams) {
  assert(Number.isFinite(team.modelingTotals.goalsForPerMatch) && team.modelingTotals.goalsForPerMatch > 0, `${team.team} attack xG input must be finite and positive`);
  assert(Number.isFinite(team.modelingTotals.goalsAgainstPerMatch) && team.modelingTotals.goalsAgainstPerMatch > 0, `${team.team} defensive xG input must be finite and positive`);
  assert(team.modelingTotals.updateMethod === "opponent_adjusted_residual", `${team.team} must use residual update, not full-score blending`);
  assert(Math.abs(team.expectedGoalTrace.shrinkageAppliedToResidual.evidenceWeight - 0.05) < 1e-9, `${team.team} residual evidence weight must be 5%`);
}

for (const match of predictions.matches) {
  assert(match.scoreDistribution.every((score) => Number.isFinite(score.probability) && score.probability >= 0), `${match.matchNumber} score probabilities must be finite`);
  assert(Math.abs(match.validation.scoreProbabilitySum - 1) <= 0.001, `${match.matchNumber} score matrix must sum to approximately one`);
  assert(Math.abs(match.validation.wdlProbabilitySum - 1) <= 0.001, `${match.matchNumber} 1X2 probabilities must sum to one`);
  assert(Math.abs(match.validation.qualificationProbabilitySum - 1) <= 0.001, `${match.matchNumber} qualification probabilities must sum to one`);
  assert(Math.abs(match.extraTimeProbability - match.outcomeProbabilities.drawThrough90) <= 0.0001, `${match.matchNumber} extra-time probability must equal regulation draw probability`);
  assert(match.penaltyShootoutProbability.unconditional <= match.extraTimeProbability + 0.0001, `${match.matchNumber} unconditional penalties cannot exceed extra-time probability`);
  assert(match.evidenceConfidence !== "High", `${match.matchNumber} evidence confidence must not be High with missing inputs`);
  assert(match.marketComparison.status !== "diagnostic_only_not_model_input" || match.validationWarnings.some((warning) => warning.includes("market")) || Math.max(Math.abs(match.marketComparison.differencePercentagePoints.home), Math.abs(match.marketComparison.differencePercentagePoints.away)) <= 10, `${match.matchNumber} market disagreement must produce a warning`);
}

assert(availability.curatedEvidencePolicy?.path, "curated human-readable availability evidence hook must be present");

const stable = predictions.matches.map((match) => ({
  matchNumber: match.matchNumber,
  expectedGoals: match.expectedGoals,
  selectedScore: match.selectedScore,
  outcomeProbabilities: match.outcomeProbabilities,
  qualificationProbabilities: match.qualificationProbabilities,
  penaltyShootoutProbability: match.penaltyShootoutProbability,
  predictionStrength: match.predictionStrength,
  evidenceConfidence: match.evidenceConfidence,
}));

console.log(`roundOf16Update validation passed ${hash(stable)}`);

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
