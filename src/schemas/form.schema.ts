import { z } from "zod";
import {
  ISODateStringSchema,
  SourcedCountryCodeSchema,
  SourcedDateSchema,
  SourcedNumberSchema,
  SourcedStringSchema
} from "./common.js";

export const MatchFormSchema = z.object({
  matchId: z.string().min(1).optional(),
  date: SourcedDateSchema,
  opponent: SourcedStringSchema,
  opponentCountryCode: SourcedCountryCodeSchema.optional(),
  opponentStrength: SourcedNumberSchema.optional(),
  result: SourcedStringSchema,
  goalsFor: SourcedNumberSchema,
  goalsAgainst: SourcedNumberSchema,
  xgFor: SourcedNumberSchema.optional(),
  xgAgainst: SourcedNumberSchema.optional(),
  venueType: SourcedStringSchema.optional(),
  competition: SourcedStringSchema.optional(),
  notes: z.string().optional()
});

export const CurrentFormSchema = z.object({
  teamId: z.string().min(1),
  teamName: SourcedStringSchema,
  countryCode: SourcedCountryCodeSchema,
  matches: z.array(MatchFormSchema),
  cleanSheets: SourcedNumberSchema.optional(),
  winRate: SourcedNumberSchema.optional(),
  drawRate: SourcedNumberSchema.optional(),
  lossRate: SourcedNumberSchema.optional(),
  goalDifference: SourcedNumberSchema.optional(),
  weightedRecentFormScore: SourcedNumberSchema.optional(),
  notes: z.string().optional()
});

export const TacticalContextSchema = z.object({
  teamId: z.string().min(1),
  teamName: SourcedStringSchema,
  countryCode: SourcedCountryCodeSchema,
  coachName: SourcedStringSchema.optional(),
  coachTenureStart: SourcedDateSchema.optional(),
  preferredFormation: SourcedStringSchema.optional(),
  tournamentExperience: SourcedStringSchema.optional(),
  styleTags: z
    .object({
      possession: SourcedStringSchema.optional(),
      highPress: SourcedStringSchema.optional(),
      lowBlock: SourcedStringSchema.optional(),
      counterattack: SourcedStringSchema.optional(),
      directPlay: SourcedStringSchema.optional(),
      setPieceStrength: SourcedStringSchema.optional()
    })
    .optional(),
  notes: z.string().optional()
});

export const AvailabilityRiskSchema = z.object({
  teamId: z.string().min(1),
  teamName: SourcedStringSchema,
  countryCode: SourcedCountryCodeSchema,
  injuries: z.array(SourcedStringSchema).default([]),
  suspensions: z.array(SourcedStringSchema).default([]),
  recentMinutesLoad: SourcedStringSchema.optional(),
  keyPlayerUncertainty: SourcedStringSchema.optional(),
  sourceDate: SourcedDateSchema,
  notes: z.string().optional()
});

export const FormDatasetSchema = z.object({
  datasetId: z.string().min(1),
  generatedAt: ISODateStringSchema,
  scope: z.string().min(1),
  currentForm: z.array(CurrentFormSchema),
  tacticalContext: z.array(TacticalContextSchema).default([]),
  availabilityRisk: z.array(AvailabilityRiskSchema).default([])
});

export type CurrentForm = z.infer<typeof CurrentFormSchema>;
export type TacticalContext = z.infer<typeof TacticalContextSchema>;
export type AvailabilityRisk = z.infer<typeof AvailabilityRiskSchema>;
export type FormDataset = z.infer<typeof FormDatasetSchema>;
