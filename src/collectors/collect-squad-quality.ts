import { SquadDatasetSchema, type SquadDataset } from "../schemas/squad.schema.js";
import { writeJson } from "./types.js";

export function buildEmptySquadDataset(): SquadDataset {
  return {
    datasetId: "squad-quality-not-collected",
    generatedAt: "2026-06-07",
    scope: "Squad quality collector placeholder. Player lists, minutes, values, and key-player fields must be sourced before use.",
    squads: []
  };
}

export async function main() {
  await writeJson("data/squads/squad-quality.json", buildEmptySquadDataset(), SquadDatasetSchema);
  console.log("Wrote data/squads/squad-quality.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
