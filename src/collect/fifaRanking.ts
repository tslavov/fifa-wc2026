import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { FifaRankingOutputSchema, type FifaRankingRow, type SourceRef } from "../schemas.js";
import { normalizeTeamName } from "../normalize/teams.js";

const FIFA_RANKING_URL = "https://inside.fifa.com/fifa-world-ranking/men";
const FIFA_RANKING_API = "https://inside.fifa.com/api/ranking-overview?locale=en&dateId=";
const OUTPUT_PATH = join("data", "normalized", "fifa-rankings.json");
const RAW_PAGE_PATH = join("data", "raw", "fifa-ranking-page.html");

export async function collectFifaRanking(): Promise<void> {
  const collectedAt = new Date().toISOString();
  const warnings: string[] = [];

  const pageHtml = await fetchText(FIFA_RANKING_URL);
  await writeText(RAW_PAGE_PATH, pageHtml);

  const dates = extractRankingDates(pageHtml);
  if (dates.length === 0) {
    warnings.push("FIFA ranking page did not expose ranking date IDs in __NEXT_DATA__.");
  }

  let rows: FifaRankingRow[] = [];
  for (const dateInfo of dates) {
    const apiUrl = `${FIFA_RANKING_API}${encodeURIComponent(dateInfo.id)}`;
    try {
      const rawJson = await fetchText(apiUrl);
      const parsed = JSON.parse(rawJson) as FifaRankingApiResponse;
      const rankings = Array.isArray(parsed.rankings) ? parsed.rankings : [];

      if (rankings.length === 0) {
        warnings.push(`FIFA ranking dateId ${dateInfo.id} returned no ranking rows.`);
        continue;
      }

      await writeText(join("data", "raw", `fifa-ranking-${dateInfo.id}.json`), rawJson);
      rows = normalizeFifaRows(rankings, dateInfo, apiUrl, collectedAt, warnings);
      break;
    } catch (error) {
      warnings.push(`FIFA ranking dateId ${dateInfo.id} failed: ${formatError(error)}`);
    }
  }

  if (rows.length === 0) {
    warnings.push("No FIFA ranking rows were collected from official FIFA endpoints.");
  }

  rows.sort((a, b) => a.rank - b.rank || a.team.localeCompare(b.team));

  const output = {
    generatedAt: collectedAt,
    rows,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  FifaRankingOutputSchema.parse(output);
  await writeJson(OUTPUT_PATH, output);
  logSummary("FIFA rankings", rows.length, warnings);
}

type FifaRankingDate = {
  id: string;
  iso?: string;
  dateText?: string;
  matchWindowEndDate?: string;
};

type FifaNextData = {
  props?: {
    pageProps?: {
      pageData?: {
        ranking?: {
          dates?: Array<{ year?: string; dates?: FifaRankingDate[] }>;
        };
      };
    };
  };
};

type FifaRankingApiResponse = {
  rankings?: FifaRankingApiRow[];
};

type FifaRankingApiRow = {
  rankingItem?: {
    name?: string;
    countryCode?: string;
    rank?: number;
    totalPoints?: number;
  };
  lastUpdateDate?: string;
};

function extractRankingDates(html: string): FifaRankingDate[] {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return [];

  const data = JSON.parse(match[1]) as FifaNextData;
  const groups = data.props?.pageProps?.pageData?.ranking?.dates ?? [];
  return groups.flatMap((group) => group.dates ?? []).filter((date) => typeof date.id === "string" && date.id.length > 0);
}

function normalizeFifaRows(
  rankings: FifaRankingApiRow[],
  dateInfo: FifaRankingDate,
  apiUrl: string,
  collectedAt: string,
  warnings: string[],
): FifaRankingRow[] {
  const rows: FifaRankingRow[] = [];
  const rankingDate = toDateOnly(dateInfo.matchWindowEndDate ?? dateInfo.iso ?? rankings[0]?.lastUpdateDate);

  for (const row of rankings) {
    const item = row.rankingItem;
    const team = item?.name ? normalizeTeamName(item.name) : undefined;
    const countryCode = item?.countryCode;
    const rank = typeof item?.rank === "number" ? item.rank : Number.NaN;
    const points = typeof item?.totalPoints === "number" ? item.totalPoints : Number.NaN;

    if (!team || !countryCode || !Number.isInteger(rank) || rank <= 0 || !Number.isFinite(points) || !rankingDate) {
      warnings.push(`Skipped incomplete FIFA ranking row for ${item?.name ?? "unknown team"}.`);
      continue;
    }

    const sourceRefs: SourceRef[] = [
      {
        sourceName: "FIFA men's ranking",
        sourceUrl: FIFA_RANKING_URL,
        collectedAt,
        notes: `Official FIFA ranking-overview API: ${apiUrl}; dateId: ${dateInfo.id}.`,
      },
    ];

    rows.push({
      team,
      countryCode,
      rank,
      points,
      rankingDate,
      sourceRefs,
    });
  }

  return rows;
}

function toDateOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : undefined;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "fifa-wc2026-data-pipeline/0.1 (+public-source-collector)",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
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

function logSummary(label: string, rowCount: number, warnings: string[]): void {
  console.log(`${label}: wrote ${rowCount} rows to ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFifaRanking().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
