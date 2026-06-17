import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeTeamName, teamKey } from "./normalize/teams.js";

const GROUPS_PATH = "fifa-world-cup-2026-groups.md";
const RESULTS_PATH = join("data", "results", "group-stage-matchday-1-results-v1.json");
const EVALUATION_PATH = join("data", "evaluation", "matchday-1-prediction-evaluation-v1.json");
const COEFFICIENTS_PATH = join("data", "model", "coefficients-v2-after-matchday-1.json");
const REMAINING_PREDICTIONS_PATH = join("data", "predictions", "group-stage-remaining-score-predictions-v2-after-matchday-1.json");
const MATCHDAY_2_PREDICTIONS_PATH = join("data", "predictions", "matchday-2-score-predictions-v2-after-matchday-1.json");
const MATCHDAY_3_PREDICTIONS_PATH = join("data", "predictions", "matchday-3-score-predictions-v2-after-matchday-1.json");
const UPDATED_MONTE_CARLO_PATH = join("data", "predictions", "group-stage-monte-carlo-v2-after-matchday-1.json");
const UPDATED_MARKOV_PATH = join("data", "predictions", "group-stage-markov-chain-v2-after-matchday-1.json");

type MatchdayResults = {
  artifactKind?: string;
  completionStatus?: {
    expectedFixtures?: number;
    completedFixtures?: number;
    incompleteFixtures?: number;
    allMatchday1FixturesFinal?: boolean;
  };
  results?: ResultRow[];
  incompleteFixtures?: IncompleteFixture[];
};
type ResultRow = {
  matchId?: string;
  matchNumber?: number;
  group?: string;
  homeTeam?: string;
  awayTeam?: string;
  finalScore?: { home?: number; away?: number; teamA?: number; teamB?: number };
};
type IncompleteFixture = {
  matchId?: string;
  matchNumber?: number;
  group?: string;
  homeTeam?: string;
  awayTeam?: string;
};
type Evaluation = {
  artifactKind?: string;
  evaluatedFixtureCount?: number;
  matches?: Array<{ matchId?: string; matchNumber?: number; actualScore?: { home?: number; away?: number }; predictedScore?: { home?: number; away?: number } }>;
};
type PredictionOutput = {
  artifactKind?: string;
  excludeFromFuturePredictionInputs?: boolean;
  doNotUseAsTrainingData?: boolean;
  doNotUseAsCollectedData?: boolean;
  matches?: PredictionMatch[];
};
type PredictionMatch = {
  matchId?: string;
  matchNumber?: number;
  group?: string;
  matchday?: number;
  homeTeam?: string;
  awayTeam?: string;
  selectedPredictedScore?: { home?: number; away?: number };
  mostProbableScore?: { home?: number; away?: number };
};

export async function validateMatchday1Update(): Promise<void> {
  const errors: string[] = [];
  const groups = parseGroups(await readFile(GROUPS_PATH, "utf8"));
  const teamsByGroup = new Map(groups.map((group) => [group.group, new Set(group.teams.map((team) => teamKey(team)))]));

  const results = await readJson<MatchdayResults>(RESULTS_PATH, errors);
  const evaluation = await readJson<Evaluation>(EVALUATION_PATH, errors);
  const coefficients = await readJson<Record<string, unknown>>(COEFFICIENTS_PATH, errors);
  const remaining = await readJson<PredictionOutput>(REMAINING_PREDICTIONS_PATH, errors);
  const matchday2 = await readJson<PredictionOutput>(MATCHDAY_2_PREDICTIONS_PATH, errors);
  const matchday3 = await readJson<PredictionOutput>(MATCHDAY_3_PREDICTIONS_PATH, errors);
  const monteCarlo = await readJson<Record<string, unknown>>(UPDATED_MONTE_CARLO_PATH, errors);
  const markov = await readJson<Record<string, unknown>>(UPDATED_MARKOV_PATH, errors);

  if (results) validateResults(results, teamsByGroup, errors);
  if (evaluation && results) validateEvaluation(evaluation, results, errors);
  if (coefficients) validateCoefficients(coefficients, errors);
  if (remaining && results) validatePredictionOutput(remaining, "remaining predictions", [1, 2, 3], 48 + (results.incompleteFixtures?.length ?? 0), teamsByGroup, errors);
  if (matchday2) validatePredictionOutput(matchday2, "matchday 2 predictions", [2], 24, teamsByGroup, errors);
  if (matchday3) validatePredictionOutput(matchday3, "matchday 3 predictions", [3], 24, teamsByGroup, errors);
  validatePredictionArtifact(monteCarlo, UPDATED_MONTE_CARLO_PATH, errors);
  validatePredictionArtifact(markov, UPDATED_MARKOV_PATH, errors);

  if (errors.length > 0) {
    for (const error of errors) console.error(`Error: ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed for Matchday 1 update artifacts.");
}

async function readJson<T>(path: string, errors: string[]): Promise<T | undefined> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as T;
    for (const nullPath of findNullPaths(parsed)) errors.push(`${path}: null value found at ${nullPath}; omit unavailable fields instead.`);
    return parsed;
  } catch (error) {
    errors.push(`${path}: ${formatError(error)}`);
    return undefined;
  }
}

function validateResults(results: MatchdayResults, teamsByGroup: Map<string, Set<string>>, errors: string[]): void {
  if (results.artifactKind !== "collected_results") errors.push(`${RESULTS_PATH}: artifactKind must be collected_results.`);
  const finals = results.results ?? [];
  const incomplete = results.incompleteFixtures ?? [];
  const allFixtures = [...finals, ...incomplete];
  if (results.completionStatus?.expectedFixtures !== 24) errors.push(`${RESULTS_PATH}: expectedFixtures must be 24.`);
  if (results.completionStatus?.completedFixtures !== finals.length) errors.push(`${RESULTS_PATH}: completedFixtures does not match results length.`);
  if (results.completionStatus?.incompleteFixtures !== incomplete.length) errors.push(`${RESULTS_PATH}: incompleteFixtures count does not match array length.`);
  if (allFixtures.length !== 24) errors.push(`${RESULTS_PATH}: results + incompleteFixtures must contain all 24 Matchday 1 fixtures.`);
  validateUnique(allFixtures.map((fixture) => fixture.matchId), `${RESULTS_PATH}: duplicate matchId`, errors);
  validateUnique(allFixtures.map((fixture) => fixture.matchNumber), `${RESULTS_PATH}: duplicate matchNumber`, errors);

  for (const result of finals) {
    validateFixtureTeams(result, teamsByGroup, RESULTS_PATH, errors);
    if (!isGoal(result.finalScore?.home) || !isGoal(result.finalScore?.away) || !isGoal(result.finalScore?.teamA) || !isGoal(result.finalScore?.teamB)) {
      errors.push(`${RESULTS_PATH}: match ${result.matchNumber} has invalid finalScore.`);
    }
  }

  for (const fixture of incomplete) validateFixtureTeams(fixture, teamsByGroup, RESULTS_PATH, errors);
}

function validateEvaluation(evaluation: Evaluation, results: MatchdayResults, errors: string[]): void {
  if (evaluation.artifactKind !== "evaluation") errors.push(`${EVALUATION_PATH}: artifactKind must be evaluation.`);
  const matches = evaluation.matches ?? [];
  const finals = results.results ?? [];
  if (evaluation.evaluatedFixtureCount !== finals.length) errors.push(`${EVALUATION_PATH}: evaluatedFixtureCount must match completed result count.`);
  if (matches.length !== finals.length) errors.push(`${EVALUATION_PATH}: matches length must match completed result count.`);
  const resultMatchIds = new Set(finals.map((row) => row.matchId));
  for (const row of matches) {
    if (!row.matchId || !resultMatchIds.has(row.matchId)) errors.push(`${EVALUATION_PATH}: evaluation row has no matching completed result (${row.matchId ?? "missing"}).`);
    if (!isGoal(row.actualScore?.home) || !isGoal(row.actualScore?.away)) errors.push(`${EVALUATION_PATH}: match ${row.matchNumber} has invalid actualScore.`);
    if (!isGoal(row.predictedScore?.home) || !isGoal(row.predictedScore?.away)) errors.push(`${EVALUATION_PATH}: match ${row.matchNumber} has invalid predictedScore.`);
  }
}

function validateCoefficients(coefficients: Record<string, unknown>, errors: string[]): void {
  if (coefficients.artifactKind !== "model_coefficients") errors.push(`${COEFFICIENTS_PATH}: artifactKind must be model_coefficients.`);
  const coeffs = coefficients.coefficients as Record<string, unknown> | undefined;
  const markov = coeffs?.markovMonteCarlo as Record<string, unknown> | undefined;
  const params = markov?.modelParameters as Record<string, unknown> | undefined;
  for (const key of ["baseGoalRateMultiplier", "qualityMultiplierScale", "lambdaMin", "lambdaMax", "stepsPerMatch", "pruneProbabilityBelow"]) {
    if (typeof params?.[key] !== "number") errors.push(`${COEFFICIENTS_PATH}: coefficients.markovMonteCarlo.modelParameters.${key} must be numeric.`);
  }
}

function validatePredictionOutput(
  output: PredictionOutput,
  label: string,
  allowedMatchdays: number[],
  expectedCount: number,
  teamsByGroup: Map<string, Set<string>>,
  errors: string[],
): void {
  if (output.artifactKind !== "prediction") errors.push(`${label}: artifactKind must be prediction.`);
  if (output.excludeFromFuturePredictionInputs !== true) errors.push(`${label}: excludeFromFuturePredictionInputs must be true.`);
  if (output.doNotUseAsTrainingData !== true) errors.push(`${label}: doNotUseAsTrainingData must be true.`);
  if (output.doNotUseAsCollectedData !== true) errors.push(`${label}: doNotUseAsCollectedData must be true.`);
  const matches = output.matches ?? [];
  if (matches.length !== expectedCount) errors.push(`${label}: expected ${expectedCount} matches but found ${matches.length}.`);
  validateUnique(matches.map((match) => match.matchId), `${label}: duplicate matchId`, errors);
  for (const match of matches) {
    if (!match.matchday || !allowedMatchdays.includes(match.matchday)) errors.push(`${label}: match ${match.matchNumber} has unexpected matchday ${match.matchday}.`);
    validateFixtureTeams(match, teamsByGroup, label, errors);
    if (!isGoal(match.selectedPredictedScore?.home) || !isGoal(match.selectedPredictedScore?.away)) {
      errors.push(`${label}: match ${match.matchNumber} has invalid selectedPredictedScore.`);
    }
    if (!isGoal(match.mostProbableScore?.home) || !isGoal(match.mostProbableScore?.away)) {
      errors.push(`${label}: match ${match.matchNumber} has invalid mostProbableScore.`);
    }
  }
}

function validatePredictionArtifact(value: Record<string, unknown> | undefined, path: string, errors: string[]): void {
  if (!value) return;
  if (value.artifactKind !== "prediction") errors.push(`${path}: artifactKind must be prediction.`);
  if (value.excludeFromFuturePredictionInputs !== true) errors.push(`${path}: excludeFromFuturePredictionInputs must be true.`);
  if (value.doNotUseAsTrainingData !== true) errors.push(`${path}: doNotUseAsTrainingData must be true.`);
  if (value.doNotUseAsCollectedData !== true) errors.push(`${path}: doNotUseAsCollectedData must be true.`);
}

function validateFixtureTeams(
  fixture: { group?: string; homeTeam?: string; awayTeam?: string; matchNumber?: number },
  teamsByGroup: Map<string, Set<string>>,
  label: string,
  errors: string[],
): void {
  if (!fixture.group || !teamsByGroup.has(fixture.group)) {
    errors.push(`${label}: match ${fixture.matchNumber} has unknown group ${fixture.group ?? "missing"}.`);
    return;
  }
  const teams = teamsByGroup.get(fixture.group) as Set<string>;
  if (!fixture.homeTeam || !teams.has(teamKey(normalizeTeamName(fixture.homeTeam)))) {
    errors.push(`${label}: match ${fixture.matchNumber} home team is not canonical for Group ${fixture.group}: ${fixture.homeTeam ?? "missing"}.`);
  }
  if (!fixture.awayTeam || !teams.has(teamKey(normalizeTeamName(fixture.awayTeam)))) {
    errors.push(`${label}: match ${fixture.matchNumber} away team is not canonical for Group ${fixture.group}: ${fixture.awayTeam ?? "missing"}.`);
  }
}

function validateUnique(values: Array<string | number | undefined>, label: string, errors: string[]): void {
  const seen = new Set<string | number>();
  for (const value of values) {
    if (value === undefined) {
      errors.push(`${label}: missing value.`);
      continue;
    }
    if (seen.has(value)) errors.push(`${label}: ${value}.`);
    seen.add(value);
  }
}

function parseGroups(markdown: string): Array<{ group: string; teams: string[] }> {
  const groups: Array<{ group: string; teams: string[] }> = [];
  let current: { group: string; teams: string[] } | undefined;
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

function isGoal(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function findNullPaths(value: unknown, path = "$", paths: string[] = []): string[] {
  if (value === null) {
    paths.push(path);
    return paths;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findNullPaths(item, `${path}[${index}]`, paths));
    return paths;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) findNullPaths(child, `${path}.${key}`, paths);
  }
  return paths;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateMatchday1Update().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
