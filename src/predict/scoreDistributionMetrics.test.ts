import assert from "node:assert/strict";
import { calculateScoreDistributionMetrics, interpretUpside, normalizeScoreDistribution } from "./scoreDistributionMetrics.js";

const mixedFormatDistribution = normalizeScoreDistribution([
  { score: "2-0", probability: 50 },
  { homeGoals: 1, awayGoals: 1, probability: 25 },
  { goalsA: 0, goalsB: 1, probability: 25 },
]);

assert.equal(mixedFormatDistribution.length, 3);
assert.equal(mixedFormatDistribution[0]?.homeGoals, 2);
assert.equal(mixedFormatDistribution[0]?.awayGoals, 0);
assertApprox(mixedFormatDistribution.reduce((sum, scoreline) => sum + scoreline.probability, 0), 1);

const wdlMetrics = calculateScoreDistributionMetrics([
  { score: "2-0", probability: 50 },
  { homeGoals: 1, awayGoals: 1, probability: 25 },
  { goalsA: 0, goalsB: 1, probability: 25 },
]);

assert.ok(wdlMetrics);
assertApprox(wdlMetrics.homeWinProbability, 0.5);
assertApprox(wdlMetrics.drawProbability, 0.25);
assertApprox(wdlMetrics.awayWinProbability, 0.25);

const aggregateMetrics = calculateScoreDistributionMetrics([
  { score: "2-0", probability: 0.4 },
  { score: "3-0", probability: 0.2 },
  { score: "4-0", probability: 0.1 },
  { score: "1-1", probability: 0.1 },
  { score: "0-1", probability: 0.2 },
]);

assert.ok(aggregateMetrics);
assertApprox(aggregateMetrics.homeScore3PlusProbability, 0.3);
assertApprox(aggregateMetrics.homeScore4PlusProbability, 0.1);
assertApprox(aggregateMetrics.homeWinBy3PlusProbability, 0.3);
assertApprox(aggregateMetrics.cleanSheetHomeProbability, 0.7);
assertApprox(aggregateMetrics.cleanSheetAwayProbability, 0.2);

const blowoutMetrics = calculateScoreDistributionMetrics([
  { score: "2-0", probability: 0.35 },
  { score: "3-0", probability: 0.2 },
  { score: "4-0", probability: 0.1 },
  { score: "1-0", probability: 0.15 },
  { score: "1-1", probability: 0.1 },
  { score: "0-1", probability: 0.1 },
]);

assert.ok(blowoutMetrics);
const interpretation = interpretUpside(blowoutMetrics, { homeGoals: 2, awayGoals: 0 }, "Favorite", "Underdog");
assert.equal(interpretation.exactScoreMayUnderstateFavoriteUpside, true);
assert.equal(interpretation.label, "Exact score may understate favorite upside.");

console.log("scoreDistributionMetrics tests passed");

function assertApprox(actual: number, expected: number, tolerance = 0.0001): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}
