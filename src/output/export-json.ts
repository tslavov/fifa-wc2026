import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const INPUTS = [
  ["rules", "data/rules/world-cup-2026-rules.json"],
  ["teams", "data/teams/teams.normalized.json"],
  ["fifaRankings", "data/rankings/fifa-rankings.json"],
  ["eloRatings", "data/rankings/elo-ratings.json"],
  ["form", "data/form/team-form.json"],
  ["squads", "data/squads/squad-quality.json"],
  ["fixtures", "data/fixtures/group-fixtures.json"],
  ["sources", "data/sources/source-index.json"]
] as const;

async function main() {
  const bundle: Record<string, unknown> = {
    generatedAt: new Date().toISOString().slice(0, 10)
  };

  for (const [key, path] of INPUTS) {
    bundle[key] = JSON.parse(await readFile(path, "utf8"));
  }

  const outputPath = "data/world-cup-2026-data-bundle.json";
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
