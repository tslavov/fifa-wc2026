import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { EloRatingOutputSchema, type EloRatingRow, type SourceRef } from "../schemas.js";
import { normalizeTeamName } from "../normalize/teams.js";

const ELO_SOURCE_URL = "https://www.eloratings.net/";
const ELO_WORLD_TSV_URL = "https://www.eloratings.net/World.tsv";
const ELO_TEAMS_TSV_URL = "https://www.eloratings.net/en.teams.tsv";
const OUTPUT_PATH = join("data", "normalized", "elo-ratings.json");

export async function collectEloRatings(): Promise<void> {
  const collectedAt = new Date().toISOString();
  const warnings: string[] = [];

  const worldResponse = await fetchTextWithHeaders(ELO_WORLD_TSV_URL);
  const teamsResponse = await fetchTextWithHeaders(ELO_TEAMS_TSV_URL);

  await writeText(join("data", "raw", "elo-world.tsv"), worldResponse.text);
  await writeText(join("data", "raw", "elo-teams.tsv"), teamsResponse.text);

  const lastUpdated = parseHttpDate(worldResponse.lastModified);
  if (!lastUpdated) {
    warnings.push("World Football Elo Ratings did not return a usable Last-Modified header for World.tsv.");
  }

  const teamNames = parseTeamNames(teamsResponse.text, warnings);
  const rows = parseWorldRows(worldResponse.text, teamNames, collectedAt, lastUpdated, warnings);
  rows.sort((a, b) => a.rank - b.rank || a.team.localeCompare(b.team));

  const output = {
    generatedAt: collectedAt,
    rows,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  EloRatingOutputSchema.parse(output);
  await writeJson(OUTPUT_PATH, output);
  console.log(`Elo ratings: wrote ${rows.length} rows to ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

function parseTeamNames(tsv: string, warnings: string[]): Map<string, string> {
  const teamNames = new Map<string, string>();

  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split("\t");
    const code = fields[0];
    const canonicalName = fields[1];

    if (!code || code.includes("_") || !canonicalName) continue;
    if (teamNames.has(code)) warnings.push(`Duplicate Elo team code ${code} in en.teams.tsv; keeping first value.`);
    else teamNames.set(code, normalizeTeamName(canonicalName));
  }

  return teamNames;
}

function parseWorldRows(
  tsv: string,
  teamNames: Map<string, string>,
  collectedAt: string,
  lastUpdated: string | undefined,
  warnings: string[],
): EloRatingRow[] {
  const rows: EloRatingRow[] = [];

  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split("\t");
    const rank = Number(fields[1]);
    const code = fields[2];
    const rating = Number(fields[3]);
    const team = code ? teamNames.get(code) : undefined;

    if (!team || !Number.isInteger(rank) || !Number.isInteger(rating)) {
      warnings.push(`Skipped incomplete Elo row for code ${code ?? "unknown"}.`);
      continue;
    }

    const sourceRefs: SourceRef[] = [
      {
        sourceName: "World Football Elo Ratings",
        sourceUrl: ELO_SOURCE_URL,
        collectedAt,
        notes: `Parsed from ${ELO_WORLD_TSV_URL} and ${ELO_TEAMS_TSV_URL}.`,
      },
    ];

    rows.push({
      team,
      rank,
      rating,
      ...(lastUpdated ? { lastUpdated } : {}),
      sourceRefs,
    });
  }

  return rows;
}

async function fetchTextWithHeaders(url: string): Promise<{ text: string; lastModified?: string }> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "fifa-wc2026-data-pipeline/0.1 (+public-source-collector)",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
  }

  return {
    text: await response.text(),
    ...(response.headers.get("last-modified") ? { lastModified: response.headers.get("last-modified") as string } : {}),
  };
}

function parseHttpDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectEloRatings().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
