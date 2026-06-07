import { z } from "zod";
import {
  ISODateStringSchema,
  SourcedCountryCodeSchema,
  SourcedDateSchema,
  SourcedNumberSchema,
  SourcedStringSchema
} from "./common.js";

export const RankingRecordSchema = z
  .object({
    teamId: z.string().min(1),
    teamName: SourcedStringSchema,
    countryCode: SourcedCountryCodeSchema,
    rankingSystem: z.enum(["fifa", "elo"]),
    rank: SourcedNumberSchema.optional(),
    rating: SourcedNumberSchema.optional(),
    points: SourcedNumberSchema.optional(),
    rankingDate: SourcedDateSchema,
    notes: z.string().optional()
  })
  .superRefine((record, ctx) => {
    if (!record.rank && !record.rating && !record.points) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ranking records need at least rank, rating, or points"
      });
    }
  });

export const RankingDatasetSchema = z.object({
  datasetId: z.string().min(1),
  generatedAt: ISODateStringSchema,
  scope: z.string().min(1),
  rankings: z.array(RankingRecordSchema)
});

export type RankingRecord = z.infer<typeof RankingRecordSchema>;
export type RankingDataset = z.infer<typeof RankingDatasetSchema>;
