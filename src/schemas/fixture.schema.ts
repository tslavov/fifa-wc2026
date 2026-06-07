import { z } from "zod";
import {
  ISODateStringSchema,
  SourcedCountryCodeSchema,
  SourcedDateSchema,
  SourcedGroupLabelSchema,
  SourcedNumberSchema,
  SourcedStringSchema
} from "./common.js";

export const FixtureTeamSchema = z.object({
  name: SourcedStringSchema,
  countryCode: SourcedCountryCodeSchema
});

export const FixtureVenueSchema = z.object({
  name: SourcedStringSchema,
  city: SourcedStringSchema.optional(),
  hostCountry: SourcedStringSchema.optional(),
  altitudeMeters: SourcedNumberSchema.optional(),
  climateNotes: SourcedStringSchema.optional()
});

export const FixtureSchema = z.object({
  fixtureId: z.string().min(1),
  matchNumber: SourcedNumberSchema.optional(),
  group: SourcedGroupLabelSchema,
  matchDay: SourcedNumberSchema.optional(),
  date: SourcedDateSchema,
  timeLocal: SourcedStringSchema.optional(),
  timeEt: SourcedStringSchema.optional(),
  homeTeam: FixtureTeamSchema,
  awayTeam: FixtureTeamSchema,
  venue: FixtureVenueSchema,
  restDays: z
    .array(
      z.object({
        teamId: z.string().min(1),
        restDays: SourcedNumberSchema
      })
    )
    .optional(),
  travelDistanceKm: SourcedNumberSchema.optional(),
  notes: z.string().optional()
});

export const FixturesDatasetSchema = z.object({
  datasetId: z.string().min(1),
  generatedAt: ISODateStringSchema,
  scope: z.string().min(1),
  fixtures: z.array(FixtureSchema)
});

export type Fixture = z.infer<typeof FixtureSchema>;
export type FixturesDataset = z.infer<typeof FixturesDatasetSchema>;
