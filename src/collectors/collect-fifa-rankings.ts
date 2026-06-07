import { sourced } from "../normalize/normalize-sources.js";
import { RankingDatasetSchema, type RankingDataset } from "../schemas/ranking.schema.js";
import { writeJson } from "./types.js";
import { COLLECTED_AT } from "./source-refs.js";
import { sourceRef } from "../normalize/normalize-sources.js";

const RANKING_DATE = "2026-04-01";

const sampleRankings = [
  {
    teamId: "mexico",
    teamName: "Mexico",
    countryCode: "MEX",
    rank: 15,
    sourceId: "fifa-ranking-mex-2026-04-01",
    sourceUrl: "https://football-technology.fifa.com/fifa-world-ranking/MEX",
    sourceName: "FIFA/Coca-Cola Men's World Ranking - Mexico"
  },
  {
    teamId: "south-africa",
    teamName: "South Africa",
    countryCode: "RSA",
    rank: 60,
    sourceId: "fifa-ranking-rsa-2026-04-01",
    sourceUrl: "https://inside.fifa.com/fifa-world-ranking/RSA",
    sourceName: "FIFA/Coca-Cola Men's World Ranking - South Africa"
  },
  {
    teamId: "korea-republic",
    teamName: "Korea Republic",
    countryCode: "KOR",
    rank: 25,
    sourceId: "fifa-ranking-kor-2026-04-01",
    sourceUrl: "https://football-technology.fifa.com/fifa-world-ranking/KOR",
    sourceName: "FIFA/Coca-Cola Men's World Ranking - Korea Republic"
  },
  {
    teamId: "czechia",
    teamName: "Czechia",
    countryCode: "CZE",
    rank: 41,
    sourceId: "fifa-ranking-cze-2026-04-01",
    sourceUrl: "https://inside.fifa.com/fifa-world-ranking/CZE",
    sourceName: "FIFA/Coca-Cola Men's World Ranking - Czechia"
  }
] as const;

export function buildFifaRankings(): RankingDataset {
  return {
    datasetId: "fifa-rankings-group-a-sample",
    generatedAt: "2026-06-07",
    scope: "Sample Group A FIFA rankings only; points were not collected from the public pages.",
    rankings: sampleRankings.map((item) => {
      const source = sourceRef({
        sourceId: item.sourceId,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        collectedAt: COLLECTED_AT,
        confidence: "high",
        notes: "Official FIFA ranking team page; rank captured manually for deterministic sample."
      });

      return {
        teamId: item.teamId,
        teamName: sourced(item.teamName, source),
        countryCode: sourced(item.countryCode, source),
        rankingSystem: "fifa" as const,
        rank: sourced(item.rank, source),
        rankingDate: sourced(RANKING_DATE, source, "Last official update shown by FIFA ranking page."),
        notes: "Ranking points are intentionally omitted until collected from an allowed source."
      };
    })
  };
}

export async function main() {
  const data = RankingDatasetSchema.parse(buildFifaRankings());
  await writeJson("data/rankings/fifa-rankings.json", data, RankingDatasetSchema);
  console.log("Wrote data/rankings/fifa-rankings.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
