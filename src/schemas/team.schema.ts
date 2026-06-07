import { z } from "zod";
import {
  GroupLabelSchema,
  ISODateStringSchema,
  SourcedConfederationSchema,
  SourcedCountryCodeSchema,
  SourcedDateSchema,
  SourcedGroupLabelSchema,
  SourcedNumberSchema,
  SourcedStringSchema,
  sourcedValueSchema
} from "./common.js";

const HistoricalWorldCupPerformanceSchema = sourcedValueSchema(
  z.object({
    appearances: z.number().int().nonnegative().optional(),
    bestFinish: z.string().optional(),
    lastAppearance: z.number().int().optional(),
    notes: z.string().optional()
  })
);

const RecentTournamentPerformanceSchema = sourcedValueSchema(
  z.object({
    competition: z.string().min(1),
    edition: z.string().min(1),
    finish: z.string().min(1),
    notes: z.string().optional()
  })
);

export const TeamStrengthSchema = z.object({
  fifaRanking: z
    .object({
      rank: SourcedNumberSchema,
      rankingDate: SourcedDateSchema,
      rankingSystem: SourcedStringSchema,
      points: SourcedNumberSchema.optional()
    })
    .optional(),
  eloRating: z
    .object({
      rating: SourcedNumberSchema,
      provider: SourcedStringSchema,
      ratingDate: SourcedDateSchema
    })
    .optional(),
  historicalWorldCupPerformance: HistoricalWorldCupPerformanceSchema.optional(),
  recentTournamentPerformance: RecentTournamentPerformanceSchema.optional(),
  attackingStrengthEstimate: SourcedNumberSchema.optional(),
  defensiveStrengthEstimate: SourcedNumberSchema.optional()
});

export const TeamSchema = z.object({
  teamId: z.string().min(1),
  name: SourcedStringSchema,
  normalizedName: z.string().min(1),
  countryCode: SourcedCountryCodeSchema,
  confederation: SourcedConfederationSchema.optional(),
  group: SourcedGroupLabelSchema.optional(),
  groupPosition: sourcedValueSchema(z.string().regex(new RegExp(`^[${GroupLabelSchema.options.join("")}]\\d$`))).optional(),
  strength: TeamStrengthSchema.default({})
});

export const TeamsDatasetSchema = z.object({
  datasetId: z.string().min(1),
  generatedAt: ISODateStringSchema,
  scope: z.string().min(1),
  teams: z.array(TeamSchema)
});

export type Team = z.infer<typeof TeamSchema>;
export type TeamsDataset = z.infer<typeof TeamsDatasetSchema>;
