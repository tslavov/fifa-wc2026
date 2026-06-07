import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { FixturesDatasetSchema } from "../schemas/fixture.schema.js";
import { RankingDatasetSchema } from "../schemas/ranking.schema.js";
import { TeamsDatasetSchema } from "../schemas/team.schema.js";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function writeCsv(path: string, rows: unknown[][]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`, "utf8");
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const teams = TeamsDatasetSchema.parse(await readJson("data/teams/teams.normalized.json"));
  await writeCsv("data/teams/teams.normalized.csv", [
    ["teamId", "name", "countryCode", "group", "groupPosition", "fifaRank", "rankingDate"],
    ...teams.teams.map((team) => [
      team.teamId,
      team.name.value,
      team.countryCode.value,
      team.group?.value ?? "",
      team.groupPosition?.value ?? "",
      team.strength.fifaRanking?.rank.value ?? "",
      team.strength.fifaRanking?.rankingDate.value ?? ""
    ])
  ]);

  const fifaRankings = RankingDatasetSchema.parse(await readJson("data/rankings/fifa-rankings.json"));
  await writeCsv("data/rankings/fifa-rankings.csv", [
    ["teamId", "teamName", "countryCode", "rankingSystem", "rank", "rating", "points", "rankingDate"],
    ...fifaRankings.rankings.map((ranking) => [
      ranking.teamId,
      ranking.teamName.value,
      ranking.countryCode.value,
      ranking.rankingSystem,
      ranking.rank?.value ?? "",
      ranking.rating?.value ?? "",
      ranking.points?.value ?? "",
      ranking.rankingDate.value
    ])
  ]);

  const fixtures = FixturesDatasetSchema.parse(await readJson("data/fixtures/group-fixtures.json"));
  await writeCsv("data/fixtures/group-fixtures.csv", [
    ["fixtureId", "matchNumber", "date", "timeEt", "group", "homeTeam", "homeCode", "awayTeam", "awayCode", "venue"],
    ...fixtures.fixtures.map((fixture) => [
      fixture.fixtureId,
      fixture.matchNumber?.value ?? "",
      fixture.date.value,
      fixture.timeEt?.value ?? "",
      fixture.group.value,
      fixture.homeTeam.name.value,
      fixture.homeTeam.countryCode.value,
      fixture.awayTeam.name.value,
      fixture.awayTeam.countryCode.value,
      fixture.venue.name.value
    ])
  ]);

  console.log("Wrote CSV exports for teams, FIFA rankings, and fixtures");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
