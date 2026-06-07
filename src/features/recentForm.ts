import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  RecentFormOutputSchema,
  ResultsOutputSchema,
  TeamStrengthOutputSchema,
  type OutputFile,
  type RecentFormRow,
  type ResultRow,
  type SourceRef,
  type TeamStrengthRow,
} from "../schemas.js";
import { teamKey } from "../normalize/teams.js";

const RESULTS_INPUT_PATH = join("data", "normalized", "results.json");
const TEAM_STRENGTH_INPUT_PATH = join("data", "model-input", "team-strength.json");
const OUTPUT_PATH = join("data", "model-input", "recent-form.json");
const MATCH_LIMIT = 10;

export async function buildRecentForm(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const warnings: string[] = [];

  const resultsOutput = ResultsOutputSchema.parse(await readJson(RESULTS_INPUT_PATH)) as OutputFile<ResultRow>;
  const teamStrengthOutput = TeamStrengthOutputSchema.parse(await readJson(TEAM_STRENGTH_INPUT_PATH)) as OutputFile<TeamStrengthRow>;
  warnings.push(...(resultsOutput.warnings ?? []).map((warning) => `Results collector warning: ${warning}`));

  const matchesByTeam = new Map<string, TeamMatch[]>();
  for (const result of resultsOutput.rows) {
    addTeamMatch(matchesByTeam, result.homeTeam, {
      team: result.homeTeam,
      date: result.date,
      goalsFor: result.homeScore,
      goalsAgainst: result.awayScore,
      sourceRefs: result.sourceRefs,
    });
    addTeamMatch(matchesByTeam, result.awayTeam, {
      team: result.awayTeam,
      date: result.date,
      goalsFor: result.awayScore,
      goalsAgainst: result.homeScore,
      sourceRefs: result.sourceRefs,
    });
  }

  const rows: RecentFormRow[] = [];
  const fewerThanLimit: string[] = [];
  const withoutResults: string[] = [];

  for (const teamStrengthRow of teamStrengthOutput.rows) {
    const team = teamStrengthRow.team;
    const matches = matchesByTeam.get(teamKey(team)) ?? [];
    if (matches.length === 0) {
      withoutResults.push(team);
      continue;
    }

    const recentMatches = matches.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MATCH_LIMIT);
    if (recentMatches.length < MATCH_LIMIT) fewerThanLimit.push(team);
    rows.push(calculateFormRow(team, recentMatches));
  }

  addTeamListWarning(warnings, "FIFA-ranked teams without collected match results", withoutResults);
  addTeamListWarning(warnings, `Teams with fewer than ${MATCH_LIMIT} collected matches`, fewerThanLimit);
  rows.sort((a, b) => a.team.localeCompare(b.team));

  const output = {
    generatedAt,
    rows,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  RecentFormOutputSchema.parse(output);
  await writeJson(OUTPUT_PATH, output);
  console.log(`Recent form: wrote ${rows.length} rows to ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

type TeamMatch = {
  team: string;
  date: string;
  goalsFor: number;
  goalsAgainst: number;
  sourceRefs: SourceRef[];
};

function addTeamMatch(matchesByTeam: Map<string, TeamMatch[]>, team: string, match: TeamMatch): void {
  const key = teamKey(team);
  const matches = matchesByTeam.get(key) ?? [];
  matches.push(match);
  matchesByTeam.set(key, matches);
}

function calculateFormRow(team: string, matches: TeamMatch[]): RecentFormRow {
  const matchesPlayed = matches.length;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of matches) {
    goalsFor += match.goalsFor;
    goalsAgainst += match.goalsAgainst;
    if (match.goalsFor > match.goalsAgainst) wins += 1;
    else if (match.goalsFor === match.goalsAgainst) draws += 1;
    else losses += 1;
  }

  const goalDifference = goalsFor - goalsAgainst;
  const sourceRefs = dedupeSourceRefs(matches.flatMap((match) => match.sourceRefs));

  return {
    team,
    matchesPlayed,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference,
    goalsForPerMatch: round(goalsFor / matchesPlayed),
    goalsAgainstPerMatch: round(goalsAgainst / matchesPlayed),
    formPoints: wins * 3 + draws,
    sourceRefs,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function addTeamListWarning(warnings: string[], label: string, teams: string[]): void {
  if (teams.length === 0) return;
  const sortedTeams = [...teams].sort((a, b) => a.localeCompare(b));
  const sample = sortedTeams.slice(0, 25).join(", ");
  const suffix = sortedTeams.length > 25 ? `, and ${sortedTeams.length - 25} more` : "";
  warnings.push(`${label}: ${sortedTeams.length} (${sample}${suffix}).`);
}

function dedupeSourceRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  const deduped: SourceRef[] = [];

  for (const ref of refs) {
    const key = `${ref.sourceName}|${ref.sourceUrl}|${ref.collectedAt}|${ref.notes ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ref);
  }

  return deduped;
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
  buildRecentForm().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
