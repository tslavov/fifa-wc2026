import { FormDatasetSchema, type FormDataset } from "../schemas/form.schema.js";
import { writeJson } from "./types.js";

export function buildEmptyFormDataset(): FormDataset {
  return {
    datasetId: "team-form-not-collected",
    generatedAt: "2026-06-07",
    scope: "Current-form, tactical, and availability collector placeholder. No recent match, xG, injury, or suspension values collected yet.",
    currentForm: [],
    tacticalContext: [],
    availabilityRisk: []
  };
}

export async function main() {
  await writeJson("data/form/team-form.json", buildEmptyFormDataset(), FormDatasetSchema);
  console.log("Wrote data/form/team-form.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
