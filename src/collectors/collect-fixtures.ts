import { readFile } from "node:fs/promises";
import { sourced } from "../normalize/normalize-sources.js";
import { FixturesDatasetSchema, type FixturesDataset } from "../schemas/fixture.schema.js";
import { writeJson } from "./types.js";
import { FIFA_SCHEDULE_SOURCE } from "./source-refs.js";

const SNAPSHOT_PATH = "src/data/sources/raw/fifa-group-a-fixtures.snapshot.tsv";

type RawFixture = {
  matchNumber: string;
  date: string;
  group: "A";
  homeTeam: string;
  homeCode: string;
  awayTeam: string;
  awayCode: string;
  venue: string;
  matchDay: string;
  timeEt: string;
};

function parseSnapshot(text: string): RawFixture[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const [headerLine, ...rows] = lines;
  const headers = headerLine.split("\t");

  return rows.map((row) => {
    const values = row.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]])) as RawFixture;
  });
}

function fixtureId(raw: RawFixture): string {
  return `fwc2026-m${raw.matchNumber.padStart(3, "0")}`;
}

export async function collectFixtures(): Promise<FixturesDataset> {
  const rawText = await readFile(SNAPSHOT_PATH, "utf8");
  const rows = parseSnapshot(rawText);

  return {
    datasetId: "world-cup-2026-group-a-fixtures",
    generatedAt: "2026-06-07",
    scope: "Sample normalized output for Group A only",
    fixtures: rows.map((raw) => ({
      fixtureId: fixtureId(raw),
      matchNumber: sourced(Number(raw.matchNumber), FIFA_SCHEDULE_SOURCE),
      group: sourced(raw.group, FIFA_SCHEDULE_SOURCE),
      matchDay: sourced(Number(raw.matchDay), FIFA_SCHEDULE_SOURCE),
      date: sourced(raw.date, FIFA_SCHEDULE_SOURCE),
      timeEt: sourced(raw.timeEt, FIFA_SCHEDULE_SOURCE, "Time captured from the saved schedule snapshot; verify timezone before production simulations."),
      homeTeam: {
        name: sourced(raw.homeTeam, FIFA_SCHEDULE_SOURCE),
        countryCode: sourced(raw.homeCode, FIFA_SCHEDULE_SOURCE)
      },
      awayTeam: {
        name: sourced(raw.awayTeam, FIFA_SCHEDULE_SOURCE),
        countryCode: sourced(raw.awayCode, FIFA_SCHEDULE_SOURCE)
      },
      venue: {
        name: sourced(raw.venue, FIFA_SCHEDULE_SOURCE)
      },
      notes: "Fixture sample only. Add host-country/city/climate/rest/travel metrics in later collectors when sourced."
    }))
  };
}

export async function main() {
  const data = FixturesDatasetSchema.parse(await collectFixtures());
  await writeJson("data/fixtures/group-fixtures.json", data, FixturesDatasetSchema);
  console.log("Wrote data/fixtures/group-fixtures.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
