import { RankingDatasetSchema, type RankingDataset } from "../schemas/ranking.schema.js";
import { writeJson } from "./types.js";

export function buildEmptyEloDataset(): RankingDataset {
  return {
    datasetId: "elo-ratings-not-collected",
    generatedAt: "2026-06-07",
    scope: "Elo ratings collector placeholder. No Elo values collected yet because an allowed source has not been configured.",
    rankings: []
  };
}

export async function main() {
  await writeJson("data/rankings/elo-ratings.json", buildEmptyEloDataset(), RankingDatasetSchema);
  console.log("Wrote data/rankings/elo-ratings.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
