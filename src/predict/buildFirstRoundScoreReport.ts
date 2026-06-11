import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { RecentFormOutputSchema, TeamStrengthOutputSchema, type OutputFile, type RecentFormRow, type TeamStrengthRow } from "../schemas.js";
import { normalizeTeamName, teamKey } from "../normalize/teams.js";
import {
  calculateScoreDistributionMetrics,
  interpretUpside,
  type RawScoreline,
  type ScoreDistributionMetrics,
  type UpsideInterpretation,
} from "./scoreDistributionMetrics.js";

const GROUPS_PATH = "fifa-world-cup-2026-groups.md";
const TEAM_STRENGTH_PATH = join("data", "model-input", "team-strength.json");
const RECENT_FORM_PATH = join("data", "model-input", "recent-form.json");
const MONTE_CARLO_PATH = join("data", "predictions", "group-stage-monte-carlo-v1.json");
const MARKOV_PATH = join("data", "predictions", "group-stage-markov-chain-v1.json");
const GROUP_FIXTURES_PATH = join("data", "fixtures", "group-fixtures.json");
const OUTPUT_PATH = join("data", "predictions", "first-round-match-score-report-v1.md");

type GroupDefinition = { group: string; teams: string[] };
type PredictionTeam = { team: string; advanceProbability?: number; topTwoAdvanceProbability?: number; averagePoints?: number; averagePosition?: number };
type PredictionGroup = { group: string; predictedStandings: PredictionTeam[] };
type PredictionArtifact = { generatedAt?: string; predictionId?: string; groups: PredictionGroup[]; fixtureDistributions?: FixtureDistribution[] };
type FixtureDistribution = {
  group: string;
  teamA: string;
  teamB: string;
  lambdaA: number;
  lambdaB: number;
  scoreDistribution?: Array<{ goalsA: number; goalsB: number; probability: number }>;
  mostLikelyScores: Array<{ goalsA: number; goalsB: number; probability: number }>;
};
type FixtureSample = { fixtures?: Array<{ group?: { value?: string }; matchDay?: { value?: number }; homeTeam?: { name?: { value?: string } }; awayTeam?: { name?: { value?: string } }; date?: { value?: string }; timeEt?: { value?: string }; venue?: { name?: { value?: string } } }> };

type MatchReport = {
  group: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  confidence: "High" | "Medium" | "Low";
  basis: string;
  assumption: string;
  metrics?: ScoreDistributionMetrics;
  interpretation?: UpsideInterpretation;
  distributionMetricsUnavailable: boolean;
  date?: string;
  timeEt?: string;
  venue?: string;
};

export async function buildFirstRoundScoreReport(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const groups = parseGroups(await readFile(GROUPS_PATH, "utf8"));
  const teamStrength = TeamStrengthOutputSchema.parse(await readJson(TEAM_STRENGTH_PATH)) as OutputFile<TeamStrengthRow>;
  const recentForm = RecentFormOutputSchema.parse(await readJson(RECENT_FORM_PATH)) as OutputFile<RecentFormRow>;
  const monteCarlo = (await readJson(MONTE_CARLO_PATH)) as PredictionArtifact;
  const markov = (await readJson(MARKOV_PATH)) as PredictionArtifact;
  const fixtureSample = await readOptionalJson<FixtureSample>(GROUP_FIXTURES_PATH);

  const strengthByTeam = new Map(teamStrength.rows.map((row) => [teamKey(row.team), row]));
  const formByTeam = new Map(recentForm.rows.map((row) => [teamKey(row.team), row]));
  const monteCarloByTeam = predictionMap(monteCarlo);
  const markovByTeam = predictionMap(markov);
  const fixtureByTeams = fixtureSampleMap(fixtureSample);

  const matches = groups.flatMap((group) => firstRoundPairings(group).map(([homeTeam, awayTeam]) => {
    const fixture = fixtureByTeams.get(pairKey(group.group, homeTeam, awayTeam));
    return buildMatchReport(group.group, homeTeam, awayTeam, markov, strengthByTeam, formByTeam, monteCarloByTeam, markovByTeam, fixture);
  }));

  const lines = [
    "# FIFA World Cup 2026 First Round Match Score Predictions",
    "",
    `Generated: ${generatedAt}`,
    "",
    "noFutureUse: true",
    "",
    "This is a prediction report only. Do not use it as collected data, training data, model input, or future prediction input.",
    "",
    "## Method",
    "",
    "Predicted scores combine:",
    "",
    "- Monte Carlo group-stage simulation context from `data/predictions/group-stage-monte-carlo-v1.json`.",
    "- Markov-chain match-state score distributions from `data/predictions/group-stage-markov-chain-v1.json`.",
    "- LLM football reasoning as a qualitative overlay using available team strength, recent form, group context, and qualification-performance notes.",
    "",
    "The exact score pick is only the largest individual bucket in the Markov score distribution. Because exact score buckets are small, the report also aggregates win/draw/loss, expected goals, 3+ goal wins, 4+ team-goal chances, clean sheets, and top scorelines so strong favorites are not flattened into a conservative single score.",
    "",
    "LLM reasoning is used to explain and sanity-check the distribution-aware scenario, not to invent unavailable squad, injury, tactical, weather, or venue data.",
    "",
    "## Assumptions And Missing Data",
    "",
    "- First round means the first two matches in each group: listed team 1 vs team 2 and listed team 3 vs team 4.",
    "- Group A fixture metadata is available from the existing fixture sample; Groups B-L fixture dates, times, venues, weather, and travel context are not collected in Phase 1 and are marked as assumptions.",
    "- Squad quality, injuries, suspensions, tactical style, current weather/forecast, detailed venue effects, and head-to-head features are not available in the current model input, so they are not used as factual inputs.",
    "- If a team has no Elo field, the existing model already omits it and relies on FIFA ranking/points plus recent form.",
    "",
    "## Predictions",
    "",
  ];

  for (const group of groups) {
    lines.push(`### Group ${group.group}`, "");
    lines.push("| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |");
    lines.push("|---|---:|---:|---:|---:|---:|---:|---|---|");
    for (const match of matches.filter((item) => item.group === group.group)) {
      const metadata = [match.date, match.timeEt ? `${match.timeEt} ET` : undefined, match.venue].filter(Boolean).join(", ");
      const matchLabel = metadata ? `${match.homeTeam} vs ${match.awayTeam} (${metadata})` : `${match.homeTeam} vs ${match.awayTeam}`;
      lines.push(`| ${matchLabel} | ${match.homeTeam} ${match.homeGoals}-${match.awayGoals} ${match.awayTeam} | ${formatWdl(match)} | ${formatExpectedGoals(match)} | ${formatThreePlusWin(match)} | ${formatFourPlusGoals(match)} | ${formatCleanSheets(match)} | ${formatTopScorelines(match)} | ${formatInterpretation(match)} |`);
    }
    lines.push("");
  }

  await writeText(OUTPUT_PATH, `${lines.join("\n")}\n`);
  console.log(`First-round score report: wrote ${OUTPUT_PATH}`);
}

function buildMatchReport(
  group: string,
  homeTeamRaw: string,
  awayTeamRaw: string,
  markov: PredictionArtifact,
  strengthByTeam: Map<string, TeamStrengthRow>,
  formByTeam: Map<string, RecentFormRow>,
  monteCarloByTeam: Map<string, PredictionTeam>,
  markovByTeam: Map<string, PredictionTeam>,
  fixture?: { date?: string; timeEt?: string; venue?: string },
): MatchReport {
  const homeTeam = normalizeTeamName(homeTeamRaw);
  const awayTeam = normalizeTeamName(awayTeamRaw);
  const distribution = findFixtureDistribution(markov, group, homeTeam, awayTeam);
  const orientedDistribution = orientDistribution(distribution, homeTeam, awayTeam);
  const metrics = orientedDistribution.length > 0 ? calculateScoreDistributionMetrics(orientedDistribution) : undefined;
  const score = metrics?.topScorelines[0] ?? pickScore(distribution, homeTeam, awayTeam);
  const homeStrength = required(strengthByTeam.get(teamKey(homeTeam)), `Missing team-strength for ${homeTeam}`);
  const awayStrength = required(strengthByTeam.get(teamKey(awayTeam)), `Missing team-strength for ${awayTeam}`);
  const homeForm = required(formByTeam.get(teamKey(homeTeam)), `Missing recent-form for ${homeTeam}`);
  const awayForm = required(formByTeam.get(teamKey(awayTeam)), `Missing recent-form for ${awayTeam}`);
  const homeMc = monteCarloByTeam.get(teamKey(homeTeam));
  const awayMc = monteCarloByTeam.get(teamKey(awayTeam));
  const homeMk = markovByTeam.get(teamKey(homeTeam));
  const awayMk = markovByTeam.get(teamKey(awayTeam));

  const confidence = confidenceLabel(score.probability, Math.abs((homeMk?.advanceProbability ?? 0) - (awayMk?.advanceProbability ?? 0)));
  const interpretation = metrics ? interpretUpside(metrics, score, homeTeam, awayTeam) : undefined;
  const basis = [
    metrics ? `Markov distribution W/D/L ${percent(metrics.homeWinProbability)}/${percent(metrics.drawProbability)}/${percent(metrics.awayWinProbability)}` : `Markov top score ${percent(score.probability)}`,
    `MC adv ${homeTeam} ${percent(homeMc?.advanceProbability)} vs ${awayTeam} ${percent(awayMc?.advanceProbability)}`,
    `FIFA ranks ${homeStrength.fifaRank}/${awayStrength.fifaRank}`,
    `recent GF/GA ${homeForm.goalsForPerMatch}/${homeForm.goalsAgainstPerMatch} vs ${awayForm.goalsForPerMatch}/${awayForm.goalsAgainstPerMatch}`,
  ].join("; ");
  const assumption = fixture
    ? "Fixture metadata sourced from current Group A sample; no squad/injury/weather/tactical facts collected."
    : "Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected.";

  return {
    group,
    homeTeam,
    awayTeam,
    homeGoals: score.homeGoals,
    awayGoals: score.awayGoals,
    confidence,
    basis,
    assumption,
    metrics,
    interpretation,
    distributionMetricsUnavailable: metrics === undefined,
    ...fixture,
  };
}

function orientDistribution(distribution: FixtureDistribution | undefined, homeTeam: string, awayTeam: string): RawScoreline[] {
  if (!distribution) return [];
  const scorelines = distribution.scoreDistribution ?? distribution.mostLikelyScores;
  const sameDirection = teamKey(distribution.teamA) === teamKey(homeTeam) && teamKey(distribution.teamB) === teamKey(awayTeam);
  const reverseDirection = teamKey(distribution.teamA) === teamKey(awayTeam) && teamKey(distribution.teamB) === teamKey(homeTeam);
  if (!sameDirection && !reverseDirection) throw new Error(`Fixture distribution mismatch for ${homeTeam} vs ${awayTeam}.`);
  return scorelines.map((scoreline) => sameDirection
    ? { homeGoals: scoreline.goalsA, awayGoals: scoreline.goalsB, probability: scoreline.probability }
    : { homeGoals: scoreline.goalsB, awayGoals: scoreline.goalsA, probability: scoreline.probability });
}

function pickScore(distribution: FixtureDistribution | undefined, homeTeam: string, awayTeam: string): { homeGoals: number; awayGoals: number; probability: number } {
  if (!distribution || distribution.mostLikelyScores.length === 0) {
    return { homeGoals: 1, awayGoals: 1, probability: 0 };
  }
  const top = distribution.mostLikelyScores[0];
  const sameDirection = teamKey(distribution.teamA) === teamKey(homeTeam) && teamKey(distribution.teamB) === teamKey(awayTeam);
  const reverseDirection = teamKey(distribution.teamA) === teamKey(awayTeam) && teamKey(distribution.teamB) === teamKey(homeTeam);
  if (!sameDirection && !reverseDirection) throw new Error(`Fixture distribution mismatch for ${homeTeam} vs ${awayTeam}.`);
  return sameDirection
    ? { homeGoals: top.goalsA, awayGoals: top.goalsB, probability: top.probability }
    : { homeGoals: top.goalsB, awayGoals: top.goalsA, probability: top.probability };
}

function confidenceLabel(scoreProbability: number, advanceGap: number): "High" | "Medium" | "Low" {
  if (scoreProbability >= 0.08 && advanceGap >= 0.25) return "High";
  if (scoreProbability >= 0.055 || advanceGap >= 0.12) return "Medium";
  return "Low";
}

function findFixtureDistribution(markov: PredictionArtifact, group: string, homeTeam: string, awayTeam: string): FixtureDistribution | undefined {
  return markov.fixtureDistributions?.find((fixture) =>
    fixture.group === group &&
    ((teamKey(fixture.teamA) === teamKey(homeTeam) && teamKey(fixture.teamB) === teamKey(awayTeam)) ||
      (teamKey(fixture.teamA) === teamKey(awayTeam) && teamKey(fixture.teamB) === teamKey(homeTeam))),
  );
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

function firstRoundPairings(group: GroupDefinition): Array<[string, string]> {
  if (group.teams.length !== 4) throw new Error(`Group ${group.group} must have 4 teams.`);
  return [[group.teams[0], group.teams[1]], [group.teams[2], group.teams[3]]];
}

function predictionMap(artifact: PredictionArtifact): Map<string, PredictionTeam> {
  return new Map(artifact.groups.flatMap((group) => group.predictedStandings.map((team) => [teamKey(team.team), team] as const)));
}

function fixtureSampleMap(sample: FixtureSample | undefined): Map<string, { date?: string; timeEt?: string; venue?: string }> {
  const map = new Map<string, { date?: string; timeEt?: string; venue?: string }>();
  for (const fixture of sample?.fixtures ?? []) {
    if (fixture.matchDay?.value !== 1) continue;
    const group = fixture.group?.value;
    const home = fixture.homeTeam?.name?.value;
    const away = fixture.awayTeam?.name?.value;
    if (!group || !home || !away) continue;
    map.set(pairKey(group, normalizeTeamName(home), normalizeTeamName(away)), {
      date: fixture.date?.value,
      timeEt: fixture.timeEt?.value,
      venue: fixture.venue?.name?.value,
    });
  }
  return map;
}

function pairKey(group: string, homeTeam: string, awayTeam: string): string {
  return `${group}|${teamKey(homeTeam)}|${teamKey(awayTeam)}`;
}

function percent(value: number | undefined): string {
  if (value === undefined) return "not collected";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatWdl(match: MatchReport): string {
  if (!match.metrics) return "not collected";
  return `H ${percent(match.metrics.homeWinProbability)} / D ${percent(match.metrics.drawProbability)} / A ${percent(match.metrics.awayWinProbability)}`;
}

function formatExpectedGoals(match: MatchReport): string {
  if (!match.metrics) return "not collected";
  return `${match.metrics.expectedHomeGoals.toFixed(2)}-${match.metrics.expectedAwayGoals.toFixed(2)}`;
}

function formatThreePlusWin(match: MatchReport): string {
  if (!match.metrics) return "not collected";
  return `${match.homeTeam} ${percent(match.metrics.homeWinBy3PlusProbability)} / ${match.awayTeam} ${percent(match.metrics.awayWinBy3PlusProbability)}`;
}

function formatFourPlusGoals(match: MatchReport): string {
  if (!match.metrics) return "not collected";
  return `${match.homeTeam} ${percent(match.metrics.homeScore4PlusProbability)} / ${match.awayTeam} ${percent(match.metrics.awayScore4PlusProbability)}`;
}

function formatCleanSheets(match: MatchReport): string {
  if (!match.metrics) return "not collected";
  return `${match.homeTeam} ${percent(match.metrics.cleanSheetHomeProbability)} / ${match.awayTeam} ${percent(match.metrics.cleanSheetAwayProbability)}`;
}

function formatTopScorelines(match: MatchReport): string {
  if (!match.metrics) return "not collected";
  return match.metrics.topScorelines
    .map((scoreline) => `${scoreline.homeGoals}-${scoreline.awayGoals} (${percent(scoreline.probability)})`)
    .join(", ");
}

function formatInterpretation(match: MatchReport): string {
  if (!match.interpretation) return `${match.assumption} Distribution metrics unavailable; using exact-score fallback.`;
  return `${match.interpretation.label} ${match.interpretation.scenario} ${match.assumption}`;
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function readOptionalJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildFirstRoundScoreReport().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
