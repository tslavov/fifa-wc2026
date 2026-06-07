import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { ResultsOutputSchema, type ResultRow, type SourceRef } from "../schemas.js";
import { normalizeTeamName } from "../normalize/teams.js";

const RESULTS_SOURCE_URL = "https://github.com/martj42/international_results";
const RESULTS_CSV_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";
const OUTPUT_PATH = join("data", "normalized", "results.json");

export async function collectResults(): Promise<void> {
  const collectedAt = new Date().toISOString();
  const warnings: string[] = [];

  const csv = await fetchText(RESULTS_CSV_URL);
  await writeText(join("data", "raw", "international-results.csv"), csv);

  const rows = normalizeResults(csv, collectedAt, warnings);
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.homeTeam.localeCompare(b.homeTeam) || a.awayTeam.localeCompare(b.awayTeam));

  const output = {
    generatedAt: collectedAt,
    rows,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  ResultsOutputSchema.parse(output);
  await writeJson(OUTPUT_PATH, output);
  console.log(`International results: wrote ${rows.length} rows to ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

function normalizeResults(csv: string, collectedAt: string, warnings: string[]): ResultRow[] {
  const records = parseCsv(csv);
  const [header, ...dataRows] = records;
  if (!header) {
    warnings.push("results.csv was empty.");
    return [];
  }

  const rows: ResultRow[] = [];
  const incompleteRows: number[] = [];
  for (const [index, fields] of dataRows.entries()) {
    if (fields.length === 1 && fields[0] === "") continue;
    const record = Object.fromEntries(header.map((name, fieldIndex) => [name, fields[fieldIndex] ?? ""]));
    const homeScore = Number(record.home_score);
    const awayScore = Number(record.away_score);
    const neutral = parseBoolean(record.neutral);

    if (
      !record.date ||
      !record.home_team ||
      !record.away_team ||
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      !record.tournament ||
      !record.city ||
      !record.country ||
      neutral === undefined
    ) {
      incompleteRows.push(index + 2);
      continue;
    }

    const sourceRefs: SourceRef[] = [
      {
        sourceName: "international_results results.csv",
        sourceUrl: RESULTS_SOURCE_URL,
        collectedAt,
        notes: `Raw CSV snapshot: ${RESULTS_CSV_URL}.`,
      },
    ];

    rows.push({
      date: record.date,
      homeTeam: normalizeTeamName(record.home_team),
      awayTeam: normalizeTeamName(record.away_team),
      homeScore,
      awayScore,
      tournament: record.tournament,
      city: record.city,
      country: record.country,
      neutral,
      sourceRefs,
    });
  }

  addRowListWarning(warnings, "Skipped incomplete results.csv rows", incompleteRows);
  return rows;
}

function addRowListWarning(warnings: string[], label: string, rowNumbers: number[]): void {
  if (rowNumbers.length === 0) return;
  const sample = rowNumbers.slice(0, 25).join(", ");
  const suffix = rowNumbers.length > 25 ? `, and ${rowNumbers.length - 25} more` : "";
  warnings.push(`${label}: ${rowNumbers.length} (${sample}${suffix}).`);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseBoolean(value: string): boolean | undefined {
  if (value === "TRUE") return true;
  if (value === "FALSE") return false;
  return undefined;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "fifa-wc2026-data-pipeline/0.1 (+public-source-collector)",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
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
  collectResults().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
