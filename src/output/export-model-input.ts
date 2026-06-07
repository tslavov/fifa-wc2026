import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { FixturesDatasetSchema, type FixturesDataset } from "../schemas/fixture.schema.js";
import { FormDatasetSchema, type FormDataset } from "../schemas/form.schema.js";
import { ModelInputSchema, type FixtureModelInput, type ModelInput, type TeamModelInput } from "../schemas/model-input.schema.js";
import { RankingDatasetSchema, type RankingDataset } from "../schemas/ranking.schema.js";
import { SquadDatasetSchema, type SquadDataset } from "../schemas/squad.schema.js";
import { TeamsDatasetSchema, type Team, type TeamsDataset } from "../schemas/team.schema.js";
import { TournamentRulesSchema, type TournamentRules } from "../schemas/tournament-rules.schema.js";

const GENERATED_AT = "2026-06-07";

const INPUTS = {
  rules: "data/rules/world-cup-2026-rules.json",
  teams: "data/teams/teams.normalized.json",
  fifaRankings: "data/rankings/fifa-rankings.json",
  eloRatings: "data/rankings/elo-ratings.json",
  form: "data/form/team-form.json",
  squads: "data/squads/squad-quality.json",
  fixtures: "data/fixtures/group-fixtures.json"
} as const;

type Warning = ModelInput["warnings"][number];

type LoadedDatasets = {
  rules: TournamentRules;
  teams: TeamsDataset;
  fifaRankings: RankingDataset;
  eloRatings: RankingDataset;
  form: FormDataset;
  squads: SquadDataset;
  fixtures: FixturesDataset;
};

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadDatasets(): Promise<LoadedDatasets> {
  return {
    rules: TournamentRulesSchema.parse(await readJson(INPUTS.rules)),
    teams: TeamsDatasetSchema.parse(await readJson(INPUTS.teams)),
    fifaRankings: RankingDatasetSchema.parse(await readJson(INPUTS.fifaRankings)),
    eloRatings: RankingDatasetSchema.parse(await readJson(INPUTS.eloRatings)),
    form: FormDatasetSchema.parse(await readJson(INPUTS.form)),
    squads: SquadDatasetSchema.parse(await readJson(INPUTS.squads)),
    fixtures: FixturesDatasetSchema.parse(await readJson(INPUTS.fixtures))
  };
}

function warning(code: string, message: string): Warning {
  return { code, severity: "warning", message };
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function parseHour(time: string | undefined): number | null {
  if (!time) return null;
  const hour = Number(time.split(":")[0]);
  return Number.isFinite(hour) ? hour : null;
}

function teamIdByCountryCode(teams: Team[]): Map<string, string> {
  return new Map(teams.map((team) => [team.countryCode.value, team.teamId]));
}

function getFifaRank(team: Team, fifaRankings: RankingDataset): number | null {
  if (team.strength.fifaRanking?.rank.value !== undefined) {
    return team.strength.fifaRanking.rank.value;
  }

  const ranking = fifaRankings.rankings.find((item) => item.teamId === team.teamId && item.rankingSystem === "fifa");
  return ranking?.rank?.value ?? null;
}

function minMaxRankScore(rank: number | null, ranks: number[]): number | null {
  if (rank === null || ranks.length < 2) return null;
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  if (minRank === maxRank) return null;
  return round6((maxRank - rank) / (maxRank - minRank));
}

function buildTeamWarnings(team: Team, hasSquad: boolean, hasForm: boolean, hasTactical: boolean, hasAvailability: boolean): Warning[] {
  const warnings: Warning[] = [];

  if (!team.strength.fifaRanking?.points) {
    warnings.push(warning("missing_fifa_ranking_points", `${team.normalizedName}: FIFA ranking points were not collected.`));
  }
  if (!team.strength.eloRating) {
    warnings.push(warning("missing_elo_rating", `${team.normalizedName}: Elo rating is null because no allowed Elo source has been collected.`));
  }
  if (!team.strength.attackingStrengthEstimate) {
    warnings.push(warning("missing_attacking_strength", `${team.normalizedName}: attacking strength estimate is null; no sourced xG/goals model input collected.`));
  }
  if (!team.strength.defensiveStrengthEstimate) {
    warnings.push(warning("missing_defensive_strength", `${team.normalizedName}: defensive strength estimate is null; no sourced xG/goals-against model input collected.`));
  }
  if (!team.strength.historicalWorldCupPerformance) {
    warnings.push(warning("missing_historical_world_cup_performance", `${team.normalizedName}: historical World Cup performance is null.`));
  }
  if (!team.strength.recentTournamentPerformance) {
    warnings.push(warning("missing_recent_tournament_performance", `${team.normalizedName}: recent tournament performance score is null.`));
  }
  if (!hasSquad) {
    warnings.push(warning("missing_squad_quality", `${team.normalizedName}: squad quality features are null because squad data has not been collected.`));
  }
  if (!hasForm) {
    warnings.push(warning("missing_recent_form", `${team.normalizedName}: recent-form features are null because form data has not been collected.`));
  }
  if (!hasTactical) {
    warnings.push(warning("missing_coaching_context", `${team.normalizedName}: coaching and tactical features are null because tactical data has not been collected.`));
  }
  if (!hasAvailability) {
    warnings.push(warning("missing_availability_risk", `${team.normalizedName}: availability-risk features are null because injury/suspension data has not been collected.`));
  }
  warnings.push(warning("missing_fixture_environment", `${team.normalizedName}: rest days, travel distance, altitude, and climate features are null until sourced environment data is collected.`));

  return warnings;
}

function buildTeamFixtures(team: Team, datasets: LoadedDatasets, codeToTeamId: Map<string, string>): TeamModelInput["fixtures"] {
  return datasets.fixtures.fixtures
    .filter((fixture) => fixture.homeTeam.countryCode.value === team.countryCode.value || fixture.awayTeam.countryCode.value === team.countryCode.value)
    .map((fixture) => {
      const isHomeListed = fixture.homeTeam.countryCode.value === team.countryCode.value;
      const opponent = isHomeListed ? fixture.awayTeam : fixture.homeTeam;
      const opponentTeamId = codeToTeamId.get(opponent.countryCode.value) ?? opponent.countryCode.value.toLowerCase();

      return {
        fixtureId: fixture.fixtureId,
        matchNumber: fixture.matchNumber?.value ?? null,
        opponentTeamId,
        opponentCountryCode: opponent.countryCode.value,
        matchDay: fixture.matchDay?.value ?? null,
        kickoffHourEt: parseHour(fixture.timeEt?.value),
        venueName: fixture.venue.name.value ?? null,
        environmentFeatures: {
          restDays: null,
          travelDistanceKm: null,
          venueAltitudeMeters: fixture.venue.altitudeMeters?.value ?? null,
          climateRiskIndex: null
        }
      };
    });
}

function buildTeams(datasets: LoadedDatasets): TeamModelInput[] {
  const ranks = datasets.teams.teams
    .map((team) => getFifaRank(team, datasets.fifaRankings))
    .filter((rank): rank is number => typeof rank === "number");
  const codeToTeamId = teamIdByCountryCode(datasets.teams.teams);

  return datasets.teams.teams.map((team) => {
    const fifaRank = getFifaRank(team, datasets.fifaRankings);
    const squad = datasets.squads.squads.find((item) => item.teamId === team.teamId);
    const form = datasets.form.currentForm.find((item) => item.teamId === team.teamId);
    const tactical = datasets.form.tacticalContext.find((item) => item.teamId === team.teamId);
    const availability = datasets.form.availabilityRisk.find((item) => item.teamId === team.teamId);
    const teamFixtures = buildTeamFixtures(team, datasets, codeToTeamId);

    return {
      teamId: team.teamId,
      name: team.normalizedName,
      countryCode: team.countryCode.value,
      group: team.group?.value ?? null,
      groupPosition: team.groupPosition?.value ?? null,
      features: {
        teamStrength: {
          fifaRank,
          fifaRankInverse: fifaRank === null ? null : round6(1 / fifaRank),
          fifaRankSampleMinMax01: minMaxRankScore(fifaRank, ranks),
          fifaRankingPoints: team.strength.fifaRanking?.points?.value ?? null,
          eloRating: team.strength.eloRating?.rating.value ?? null,
          eloRatingNormalized: null,
          historicalWorldCupAppearances: team.strength.historicalWorldCupPerformance?.value.appearances ?? null,
          recentTournamentPerformanceScore: null,
          attackingStrengthEstimate: team.strength.attackingStrengthEstimate?.value ?? null,
          defensiveStrengthEstimate: team.strength.defensiveStrengthEstimate?.value ?? null
        },
        squadQuality: {
          playerCount: squad ? squad.players.length : null,
          averageSquadAge: squad?.averageSquadAge?.value ?? null,
          totalSquadValueEur: squad?.totalSquadValueEur?.value ?? null,
          topFiveLeaguePlayerCount: squad?.numberOfPlayersInTopFiveLeagues?.value ?? null,
          championsLeagueEuropaLeaguePlayerCount: squad?.numberOfPlayersInChampionsLeagueEuropaLeagueClubs?.value ?? null,
          keyPlayerCount: squad?.keyPlayers?.length ?? null
        },
        recentForm: {
          matchesWindow: form ? form.matches.length : null,
          cleanSheets: form?.cleanSheets?.value ?? null,
          winRate: form?.winRate?.value ?? null,
          drawRate: form?.drawRate?.value ?? null,
          lossRate: form?.lossRate?.value ?? null,
          goalDifference: form?.goalDifference?.value ?? null,
          weightedRecentFormScore: form?.weightedRecentFormScore?.value ?? null,
          xgForPerMatch: null,
          xgAgainstPerMatch: null
        },
        coachingContext: {
          coachTenureDays: null,
          formationKnown01: tactical?.preferredFormation ? 1 : null,
          possessionStyle01: null,
          highPressStyle01: null,
          lowBlockStyle01: null,
          counterattackStyle01: null,
          directPlayStyle01: null,
          setPieceStrength01: null
        },
        availabilityRisk: {
          injuryCount: availability ? availability.injuries.length : null,
          suspensionCount: availability ? availability.suspensions.length : null,
          keyPlayerUncertainty01: null,
          recentMinutesLoadIndex: null
        },
        fixtureEnvironment: {
          groupFixtureCount: teamFixtures.length,
          averageRestDays: null,
          totalTravelDistanceKm: null,
          maxVenueAltitudeMeters: null,
          climateRiskIndex: null
        }
      },
      fixtures: teamFixtures,
      warnings: buildTeamWarnings(team, Boolean(squad), Boolean(form), Boolean(tactical), Boolean(availability))
    };
  });
}

function buildFixtureWarnings(fixtureId: string): Warning[] {
  return [
    warning("missing_fixture_rest_days", `${fixtureId}: rest-day features are null because rest calculations have not been collected.`),
    warning("missing_fixture_travel_distance", `${fixtureId}: travel-distance features are null because fixture travel data has not been collected.`),
    warning("missing_fixture_altitude", `${fixtureId}: venue altitude is null because altitude data has not been collected.`),
    warning("missing_fixture_climate", `${fixtureId}: climate risk is null because climate data has not been collected.`)
  ];
}

function buildFixtures(datasets: LoadedDatasets): FixtureModelInput[] {
  const codeToTeamId = teamIdByCountryCode(datasets.teams.teams);

  return datasets.fixtures.fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    matchNumber: fixture.matchNumber?.value ?? null,
    group: fixture.group.value ?? null,
    date: fixture.date.value ?? null,
    matchDay: fixture.matchDay?.value ?? null,
    kickoffHourEt: parseHour(fixture.timeEt?.value),
    homeTeamId: codeToTeamId.get(fixture.homeTeam.countryCode.value) ?? fixture.homeTeam.countryCode.value.toLowerCase(),
    awayTeamId: codeToTeamId.get(fixture.awayTeam.countryCode.value) ?? fixture.awayTeam.countryCode.value.toLowerCase(),
    venueName: fixture.venue.name.value ?? null,
    numericFeatures: {
      homeRestDays: null,
      awayRestDays: null,
      homeTravelDistanceKm: null,
      awayTravelDistanceKm: null,
      venueAltitudeMeters: fixture.venue.altitudeMeters?.value ?? null,
      climateRiskIndex: null
    },
    warnings: buildFixtureWarnings(fixture.fixtureId)
  }));
}

function sourceDatasets(datasets: LoadedDatasets): ModelInput["sourceDatasets"] {
  return [
    { key: "rules", path: INPUTS.rules, datasetId: datasets.rules.datasetId, generatedAt: datasets.rules.generatedAt },
    { key: "teams", path: INPUTS.teams, datasetId: datasets.teams.datasetId, generatedAt: datasets.teams.generatedAt },
    { key: "fifaRankings", path: INPUTS.fifaRankings, datasetId: datasets.fifaRankings.datasetId, generatedAt: datasets.fifaRankings.generatedAt },
    { key: "eloRatings", path: INPUTS.eloRatings, datasetId: datasets.eloRatings.datasetId, generatedAt: datasets.eloRatings.generatedAt },
    { key: "form", path: INPUTS.form, datasetId: datasets.form.datasetId, generatedAt: datasets.form.generatedAt },
    { key: "squads", path: INPUTS.squads, datasetId: datasets.squads.datasetId, generatedAt: datasets.squads.generatedAt },
    { key: "fixtures", path: INPUTS.fixtures, datasetId: datasets.fixtures.datasetId, generatedAt: datasets.fixtures.generatedAt }
  ];
}

function buildGlobalWarnings(datasets: LoadedDatasets): Warning[] {
  const warnings: Warning[] = [];

  warnings.push(
    warning(
      "sample_scope_group_a_only",
      "Model input currently covers only the Group A sample. Do not run a full 48-team tournament simulation from this file yet."
    )
  );
  warnings.push(
    warning(
      "sample_minmax_normalization",
      "fifaRankSampleMinMax01 is normalized only across teams present in this export, not across all FIFA members or all 48 World Cup teams."
    )
  );

  if (datasets.eloRatings.rankings.length === 0) {
    warnings.push(warning("empty_elo_dataset", "Elo rating dataset is empty; all Elo model features are null."));
  }
  if (datasets.squads.squads.length === 0) {
    warnings.push(warning("empty_squad_dataset", "Squad quality dataset is empty; all squad quality model features are null."));
  }
  if (datasets.form.currentForm.length === 0) {
    warnings.push(warning("empty_form_dataset", "Recent form dataset is empty; all recent-form model features are null."));
  }
  if (datasets.form.tacticalContext.length === 0) {
    warnings.push(warning("empty_tactical_dataset", "Tactical/coaching dataset is empty; all coaching context model features are null."));
  }
  if (datasets.form.availabilityRisk.length === 0) {
    warnings.push(warning("empty_availability_dataset", "Availability-risk dataset is empty; all injury/suspension model features are null."));
  }

  return warnings;
}

export async function buildModelInput(): Promise<ModelInput> {
  const datasets = await loadDatasets();

  const modelInput: ModelInput = {
    datasetId: "world-cup-2026-model-input-group-a-sample",
    generatedAt: GENERATED_AT,
    scope: "Prediction-ready model input for sourced Group A sample data only. Missing features remain null.",
    missingValuePolicy: "Use null for unavailable or unsourced model features; do not impute inside this export.",
    normalizationPolicy: {
      fifaRankInverse: "Computed as 1 / collected FIFA rank; higher values indicate stronger rank position.",
      fifaRankSampleMinMax01: "Computed as (maxRankInExport - rank) / (maxRankInExport - minRankInExport), using only teams present in this export; higher is stronger.",
      otherFeatures: "Only sourced numeric values are emitted. Unavailable values are null and paired with warnings."
    },
    sourceDatasets: sourceDatasets(datasets),
    tournamentRules: {
      totalTeams: datasets.rules.format.totalTeams.value,
      groupCount: datasets.rules.format.groupCount.value,
      teamsPerGroup: datasets.rules.format.teamsPerGroup.value,
      groupMatchesPerTeam: datasets.rules.format.groupMatchesPerTeam.value,
      topTeamsPerGroup: datasets.rules.qualification.topTeamsPerGroup.value,
      bestThirdPlaceTeams: datasets.rules.qualification.bestThirdPlaceTeams.value,
      qualifiedFromGroupsTotal: datasets.rules.qualification.qualifiedFromGroupsTotal.value,
      pointsForWin: datasets.rules.pointsSystem.win.value,
      pointsForDraw: datasets.rules.pointsSystem.draw.value,
      pointsForLoss: datasets.rules.pointsSystem.loss.value,
      groupRankingTiebreakerKeys: datasets.rules.groupRankingTiebreakers.map((item) => item.key),
      thirdPlaceRankingTiebreakerKeys: datasets.rules.thirdPlaceRankingTiebreakers.map((item) => item.key),
      fairPlayDeductions: {
        yellowCard: datasets.rules.fairPlayScoreRules.yellowCard.value,
        indirectRedCardSecondYellow: datasets.rules.fairPlayScoreRules.indirectRedCardSecondYellow.value,
        directRedCard: datasets.rules.fairPlayScoreRules.directRedCard.value,
        yellowCardAndDirectRedCard: datasets.rules.fairPlayScoreRules.yellowCardAndDirectRedCard.value
      }
    },
    teams: buildTeams(datasets),
    fixtures: buildFixtures(datasets),
    warnings: buildGlobalWarnings(datasets)
  };

  return ModelInputSchema.parse(modelInput);
}

async function main() {
  const outputPath = "data/model-input/world-cup-2026-model-input.json";
  const modelInput = await buildModelInput();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(modelInput, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
