import { z } from "zod";
import { ISODateStringSchema } from "./common.js";

const NullableNumberSchema = z.number().finite().nullable();

export const ModelFeatureWarningsSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["warning", "error"]).default("warning"),
  message: z.string().min(1)
});

export const TeamModelInputSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{3}$/),
  group: z.string().min(1).nullable(),
  groupPosition: z.string().min(1).nullable(),
  features: z.object({
    teamStrength: z.object({
      fifaRank: NullableNumberSchema,
      fifaRankInverse: NullableNumberSchema,
      fifaRankSampleMinMax01: NullableNumberSchema,
      fifaRankingPoints: NullableNumberSchema,
      eloRating: NullableNumberSchema,
      eloRatingNormalized: NullableNumberSchema,
      historicalWorldCupAppearances: NullableNumberSchema,
      recentTournamentPerformanceScore: NullableNumberSchema,
      attackingStrengthEstimate: NullableNumberSchema,
      defensiveStrengthEstimate: NullableNumberSchema
    }),
    squadQuality: z.object({
      playerCount: NullableNumberSchema,
      averageSquadAge: NullableNumberSchema,
      totalSquadValueEur: NullableNumberSchema,
      topFiveLeaguePlayerCount: NullableNumberSchema,
      championsLeagueEuropaLeaguePlayerCount: NullableNumberSchema,
      keyPlayerCount: NullableNumberSchema
    }),
    recentForm: z.object({
      matchesWindow: NullableNumberSchema,
      cleanSheets: NullableNumberSchema,
      winRate: NullableNumberSchema,
      drawRate: NullableNumberSchema,
      lossRate: NullableNumberSchema,
      goalDifference: NullableNumberSchema,
      weightedRecentFormScore: NullableNumberSchema,
      xgForPerMatch: NullableNumberSchema,
      xgAgainstPerMatch: NullableNumberSchema
    }),
    coachingContext: z.object({
      coachTenureDays: NullableNumberSchema,
      formationKnown01: NullableNumberSchema,
      possessionStyle01: NullableNumberSchema,
      highPressStyle01: NullableNumberSchema,
      lowBlockStyle01: NullableNumberSchema,
      counterattackStyle01: NullableNumberSchema,
      directPlayStyle01: NullableNumberSchema,
      setPieceStrength01: NullableNumberSchema
    }),
    availabilityRisk: z.object({
      injuryCount: NullableNumberSchema,
      suspensionCount: NullableNumberSchema,
      keyPlayerUncertainty01: NullableNumberSchema,
      recentMinutesLoadIndex: NullableNumberSchema
    }),
    fixtureEnvironment: z.object({
      groupFixtureCount: NullableNumberSchema,
      averageRestDays: NullableNumberSchema,
      totalTravelDistanceKm: NullableNumberSchema,
      maxVenueAltitudeMeters: NullableNumberSchema,
      climateRiskIndex: NullableNumberSchema
    })
  }),
  fixtures: z.array(
    z.object({
      fixtureId: z.string().min(1),
      matchNumber: NullableNumberSchema,
      opponentTeamId: z.string().min(1),
      opponentCountryCode: z.string().regex(/^[A-Z]{3}$/),
      matchDay: NullableNumberSchema,
      kickoffHourEt: NullableNumberSchema,
      venueName: z.string().min(1).nullable(),
      environmentFeatures: z.object({
        restDays: NullableNumberSchema,
        travelDistanceKm: NullableNumberSchema,
        venueAltitudeMeters: NullableNumberSchema,
        climateRiskIndex: NullableNumberSchema
      })
    })
  ),
  warnings: z.array(ModelFeatureWarningsSchema)
});

export const FixtureModelInputSchema = z.object({
  fixtureId: z.string().min(1),
  matchNumber: NullableNumberSchema,
  group: z.string().min(1).nullable(),
  date: z.string().min(1).nullable(),
  matchDay: NullableNumberSchema,
  kickoffHourEt: NullableNumberSchema,
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  venueName: z.string().min(1).nullable(),
  numericFeatures: z.object({
    homeRestDays: NullableNumberSchema,
    awayRestDays: NullableNumberSchema,
    homeTravelDistanceKm: NullableNumberSchema,
    awayTravelDistanceKm: NullableNumberSchema,
    venueAltitudeMeters: NullableNumberSchema,
    climateRiskIndex: NullableNumberSchema
  }),
  warnings: z.array(ModelFeatureWarningsSchema)
});

export const ModelInputSchema = z.object({
  datasetId: z.string().min(1),
  generatedAt: ISODateStringSchema,
  scope: z.string().min(1),
  missingValuePolicy: z.literal("Use null for unavailable or unsourced model features; do not impute inside this export."),
  normalizationPolicy: z.object({
    fifaRankInverse: z.string().min(1),
    fifaRankSampleMinMax01: z.string().min(1),
    otherFeatures: z.string().min(1)
  }),
  sourceDatasets: z.array(
    z.object({
      key: z.string().min(1),
      path: z.string().min(1),
      datasetId: z.string().min(1).nullable(),
      generatedAt: z.string().min(1).nullable()
    })
  ),
  tournamentRules: z.object({
    totalTeams: NullableNumberSchema,
    groupCount: NullableNumberSchema,
    teamsPerGroup: NullableNumberSchema,
    groupMatchesPerTeam: NullableNumberSchema,
    topTeamsPerGroup: NullableNumberSchema,
    bestThirdPlaceTeams: NullableNumberSchema,
    qualifiedFromGroupsTotal: NullableNumberSchema,
    pointsForWin: NullableNumberSchema,
    pointsForDraw: NullableNumberSchema,
    pointsForLoss: NullableNumberSchema,
    groupRankingTiebreakerKeys: z.array(z.string().min(1)),
    thirdPlaceRankingTiebreakerKeys: z.array(z.string().min(1)),
    fairPlayDeductions: z.object({
      yellowCard: NullableNumberSchema,
      indirectRedCardSecondYellow: NullableNumberSchema,
      directRedCard: NullableNumberSchema,
      yellowCardAndDirectRedCard: NullableNumberSchema
    })
  }),
  teams: z.array(TeamModelInputSchema),
  fixtures: z.array(FixtureModelInputSchema),
  warnings: z.array(ModelFeatureWarningsSchema)
});

export type ModelInput = z.infer<typeof ModelInputSchema>;
export type TeamModelInput = z.infer<typeof TeamModelInputSchema>;
export type FixtureModelInput = z.infer<typeof FixtureModelInputSchema>;
