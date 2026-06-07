import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  EloRatingOutputSchema,
  FifaRankingOutputSchema,
  RecentFormOutputSchema,
  ResultsOutputSchema,
  TeamStrengthOutputSchema,
  type OutputFile,
} from "./schemas.js";

type Parser = {
  parse: (value: unknown) => OutputFile<unknown>;
};

type ValidationTarget = {
  path: string;
  parser: Parser;
  requireCountryCode?: boolean;
};

const targets: ValidationTarget[] = [
  { path: join("data", "normalized", "fifa-rankings.json"), parser: FifaRankingOutputSchema, requireCountryCode: true },
  { path: join("data", "normalized", "elo-ratings.json"), parser: EloRatingOutputSchema },
  { path: join("data", "normalized", "results.json"), parser: ResultsOutputSchema },
  { path: join("data", "model-input", "team-strength.json"), parser: TeamStrengthOutputSchema, requireCountryCode: true },
  { path: join("data", "model-input", "recent-form.json"), parser: RecentFormOutputSchema },
];

export async function validate(): Promise<void> {
  const errors: string[] = [];

  for (const target of targets) {
    try {
      await validateTarget(target, errors);
    } catch (error) {
      errors.push(`${target.path}: ${formatError(error)}`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`Error: ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed for Phase 1 outputs.");
}

async function validateTarget(target: ValidationTarget, errors: string[]): Promise<void> {
  const raw = await readFile(target.path, "utf8");
  const parsedJson = JSON.parse(raw) as unknown;
  const nullPaths = findNullPaths(parsedJson);
  for (const nullPath of nullPaths) {
    errors.push(`${target.path}: null value found at ${nullPath}; omit unavailable fields instead.`);
  }

  const output = target.parser.parse(parsedJson);
  if (output.warnings && output.warnings.length > 0) {
    for (const warning of output.warnings) console.warn(`Warning from ${target.path}: ${warning}`);
  }

  for (const [index, row] of output.rows.entries()) {
    const rowRecord = row as Record<string, unknown>;
    if (!Array.isArray(rowRecord.sourceRefs) || rowRecord.sourceRefs.length === 0) {
      errors.push(`${target.path}: row ${index} has no sourceRefs.`);
    }

    if (target.requireCountryCode && typeof rowRecord.countryCode !== "string") {
      errors.push(`${target.path}: row ${index} has no source-backed countryCode.`);
    }
  }
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
    for (const [key, child] of Object.entries(value)) {
      findNullPaths(child, `${path}.${key}`, paths);
    }
  }

  return paths;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validate().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
