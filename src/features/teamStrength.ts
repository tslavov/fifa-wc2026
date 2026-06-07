import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  EloRatingOutputSchema,
  FifaRankingOutputSchema,
  TeamStrengthOutputSchema,
  type EloRatingRow,
  type FifaRankingRow,
  type OutputFile,
  type SourceRef,
  type TeamStrengthRow,
} from "../schemas.js";
import { teamKey } from "../normalize/teams.js";

const FIFA_INPUT_PATH = join("data", "normalized", "fifa-rankings.json");
const ELO_INPUT_PATH = join("data", "normalized", "elo-ratings.json");
const OUTPUT_PATH = join("data", "model-input", "team-strength.json");

export async function buildTeamStrength(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const warnings: string[] = [];

  const fifaOutput = FifaRankingOutputSchema.parse(await readJson(FIFA_INPUT_PATH)) as OutputFile<FifaRankingRow>;
  const eloOutput = EloRatingOutputSchema.parse(await readJson(ELO_INPUT_PATH)) as OutputFile<EloRatingRow>;

  warnings.push(...(fifaOutput.warnings ?? []).map((warning) => `FIFA collector warning: ${warning}`));
  warnings.push(...(eloOutput.warnings ?? []).map((warning) => `Elo collector warning: ${warning}`));

  const eloByTeam = new Map<string, EloRatingRow>();
  for (const row of eloOutput.rows) {
    const key = teamKey(row.team);
    if (eloByTeam.has(key)) warnings.push(`Duplicate normalized Elo team ${row.team}; keeping first row.`);
    else eloByTeam.set(key, row);
  }

  const matchedEloKeys = new Set<string>();
  const missingEloTeams: string[] = [];
  const rows: TeamStrengthRow[] = fifaOutput.rows.map((fifaRow) => {
    const key = teamKey(fifaRow.team);
    const eloRow = eloByTeam.get(key);
    const sourceRefs = dedupeSourceRefs([...fifaRow.sourceRefs, ...(eloRow?.sourceRefs ?? [])]);

    if (eloRow) matchedEloKeys.add(key);
    else missingEloTeams.push(fifaRow.team);

    return {
      team: fifaRow.team,
      countryCode: fifaRow.countryCode,
      fifaRank: fifaRow.rank,
      fifaPoints: fifaRow.points,
      ...(eloRow ? { eloRank: eloRow.rank, eloRating: eloRow.rating } : {}),
      sourceRefs,
    };
  });

  const eloOnlyTeams = eloOutput.rows.filter((row) => !matchedEloKeys.has(teamKey(row.team))).map((row) => row.team);
  addTeamListWarning(warnings, "FIFA teams without matched Elo rows", missingEloTeams);
  addTeamListWarning(warnings, "Elo teams not emitted because no FIFA countryCode was available", eloOnlyTeams);

  rows.sort((a, b) => a.fifaRank - b.fifaRank || a.team.localeCompare(b.team));

  const output = {
    generatedAt,
    rows,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  TeamStrengthOutputSchema.parse(output);
  await writeJson(OUTPUT_PATH, output);
  console.log(`Team strength: wrote ${rows.length} rows to ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

function addTeamListWarning(warnings: string[], label: string, teams: string[]): void {
  if (teams.length === 0) return;
  const sample = teams.slice(0, 25).join(", ");
  const suffix = teams.length > 25 ? `, and ${teams.length - 25} more` : "";
  warnings.push(`${label}: ${teams.length} (${sample}${suffix}).`);
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
  buildTeamStrength().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
