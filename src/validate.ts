import { readFile } from "node:fs/promises";
import { SourceIndexSchema, SourceRefSchema } from "./schemas/common.js";
import { FixturesDatasetSchema } from "./schemas/fixture.schema.js";
import { FormDatasetSchema } from "./schemas/form.schema.js";
import { RankingDatasetSchema } from "./schemas/ranking.schema.js";
import { SquadDatasetSchema } from "./schemas/squad.schema.js";
import { TeamsDatasetSchema } from "./schemas/team.schema.js";
import { TournamentRulesSchema } from "./schemas/tournament-rules.schema.js";

const validationDate = process.env.VALIDATION_DATE ?? new Date().toISOString().slice(0, 10);

type Issue = {
  level: "error" | "warning";
  path: string;
  message: string;
};

type DatasetSpec = {
  path: string;
  schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: Array<{ path: Array<string | number>; message: string }> } } };
};

const DATASETS: DatasetSpec[] = [
  { path: "data/rules/world-cup-2026-rules.json", schema: TournamentRulesSchema },
  { path: "data/teams/teams.normalized.json", schema: TeamsDatasetSchema },
  { path: "data/rankings/fifa-rankings.json", schema: RankingDatasetSchema },
  { path: "data/rankings/elo-ratings.json", schema: RankingDatasetSchema },
  { path: "data/form/team-form.json", schema: FormDatasetSchema },
  { path: "data/squads/squad-quality.json", schema: SquadDatasetSchema },
  { path: "data/fixtures/group-fixtures.json", schema: FixturesDatasetSchema },
  { path: "data/sources/source-index.json", schema: SourceIndexSchema }
];

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((toMs - fromMs) / 86_400_000);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSourcedValues(value: unknown, path: string, issues: Issue[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSourcedValues(item, `${path}[${index}]`, issues));
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if ("value" in value) {
    if (!("source" in value)) {
      issues.push({ level: "error", path, message: "Sourced value is missing source" });
    } else {
      const parsed = SourceRefSchema.safeParse(value.source);
      if (!parsed.success) {
        issues.push({ level: "error", path: `${path}.source`, message: "Invalid source metadata" });
      }
    }

    if ((value.estimated === true || value.incomplete === true) && typeof value.notes !== "string") {
      issues.push({ level: "error", path, message: "Estimated or incomplete value needs notes" });
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    validateSourcedValues(nested, `${path}.${key}`, issues);
  }
}

function collectSourceDates(value: unknown, dates: Array<{ path: string; collectedAt: string }>, path = "$", scope?: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSourceDates(item, dates, `${path}[${index}]`, scope));
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if ("source" in value) {
    const parsed = SourceRefSchema.safeParse(value.source);
    if (parsed.success) {
      dates.push({ path, collectedAt: parsed.data.collectedAt });
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    collectSourceDates(nested, dates, `${path}.${key}`, scope);
  }
}

function hostIsFifa(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "fifa.com" || host.endsWith(".fifa.com") || host === "digitalhub.fifa.com";
  } catch {
    return false;
  }
}

async function main() {
  const issues: Issue[] = [];
  const loaded = new Map<string, unknown>();

  for (const dataset of DATASETS) {
    try {
      const json = await readJson(dataset.path);
      loaded.set(dataset.path, json);
      const parsed = dataset.schema.safeParse(json);
      if (!parsed.success && parsed.error) {
        for (const issue of parsed.error.issues) {
          issues.push({
            level: "error",
            path: `${dataset.path}:${issue.path.join(".")}`,
            message: issue.message
          });
        }
      }
      validateSourcedValues(json, dataset.path, issues);
    } catch (error) {
      issues.push({
        level: "error",
        path: dataset.path,
        message: error instanceof Error ? error.message : "Unable to read dataset"
      });
    }
  }

  const teams = TeamsDatasetSchema.safeParse(loaded.get("data/teams/teams.normalized.json"));
  if (teams.success) {
    for (const team of teams.data.teams) {
      if (!team.countryCode?.value) {
        issues.push({ level: "error", path: `team:${team.teamId}`, message: "Team is missing country code" });
      }
    }
  }

  const rules = TournamentRulesSchema.safeParse(loaded.get("data/rules/world-cup-2026-rules.json"));
  if (rules.success) {
    for (const source of rules.data.sources) {
      if (!source.sourceName.toLowerCase().includes("fifa") || !hostIsFifa(source.sourceUrl)) {
        issues.push({
          level: "error",
          path: "data/rules/world-cup-2026-rules.json.sources",
          message: "Tournament rules must be sourced from FIFA"
        });
      }
    }
  }

  const formJson = loaded.get("data/form/team-form.json");
  const formDates: Array<{ path: string; collectedAt: string }> = [];
  collectSourceDates(formJson, formDates, "data/form/team-form.json");
  for (const item of formDates) {
    if (daysBetween(item.collectedAt, validationDate) > 30) {
      issues.push({ level: "warning", path: item.path, message: "Form/injury source is older than 30 days" });
    }
  }

  const squadJson = loaded.get("data/squads/squad-quality.json");
  const squadDates: Array<{ path: string; collectedAt: string }> = [];
  collectSourceDates(squadJson, squadDates, "data/squads/squad-quality.json");
  for (const item of squadDates) {
    if (daysBetween(item.collectedAt, validationDate) > 90) {
      issues.push({ level: "warning", path: item.path, message: "Squad quality source is older than 90 days" });
    }
  }

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  for (const issue of errors) {
    console.error(`ERROR ${issue.path}: ${issue.message}`);
  }
  for (const issue of warnings) {
    console.warn(`WARN ${issue.path}: ${issue.message}`);
  }

  console.log(`Validation date: ${validationDate}`);
  console.log(`Validation complete: ${errors.length} error(s), ${warnings.length} warning(s)`);

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
