import { z } from "zod";
import {
  ISODateStringSchema,
  SourcedCountryCodeSchema,
  SourcedDateSchema,
  SourcedNumberSchema,
  SourcedStringSchema
} from "./common.js";

export const PlayerSchema = z.object({
  playerId: z.string().min(1).optional(),
  name: SourcedStringSchema,
  age: SourcedNumberSchema.optional(),
  club: SourcedStringSchema.optional(),
  league: SourcedStringSchema.optional(),
  minutesPlayed: SourcedNumberSchema.optional(),
  goals: SourcedNumberSchema.optional(),
  assists: SourcedNumberSchema.optional(),
  marketValueEur: SourcedNumberSchema.optional(),
  championsLeagueOrEuropaClub: SourcedStringSchema.optional(),
  keyPlayer: SourcedStringSchema.optional(),
  notes: z.string().optional()
});

export const SquadQualitySchema = z.object({
  teamId: z.string().min(1),
  teamName: SourcedStringSchema,
  countryCode: SourcedCountryCodeSchema,
  squadAnnouncementDate: SourcedDateSchema.optional(),
  players: z.array(PlayerSchema),
  numberOfPlayersInTopFiveLeagues: SourcedNumberSchema.optional(),
  numberOfPlayersInChampionsLeagueEuropaLeagueClubs: SourcedNumberSchema.optional(),
  averageSquadAge: SourcedNumberSchema.optional(),
  totalSquadValueEur: SourcedNumberSchema.optional(),
  keyPlayers: z.array(SourcedStringSchema).optional(),
  notes: z.string().optional()
});

export const SquadDatasetSchema = z.object({
  datasetId: z.string().min(1),
  generatedAt: ISODateStringSchema,
  scope: z.string().min(1),
  squads: z.array(SquadQualitySchema)
});

export type Player = z.infer<typeof PlayerSchema>;
export type SquadQuality = z.infer<typeof SquadQualitySchema>;
export type SquadDataset = z.infer<typeof SquadDatasetSchema>;
