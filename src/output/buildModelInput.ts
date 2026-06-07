import { pathToFileURL } from "node:url";
import { buildRecentForm } from "../features/recentForm.js";
import { buildTeamStrength } from "../features/teamStrength.js";

export async function buildModelInput(): Promise<void> {
  await buildTeamStrength();
  await buildRecentForm();
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message.includes("ENOENT")) {
    return `${error.message}\nRun npm run collect:all before npm run build:model-input.`;
  }
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildModelInput().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
