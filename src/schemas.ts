import { z } from "zod";

export const SourceRefSchema = z
  .object({
    sourceName: z.string().min(1),
    sourceUrl: z.string().url(),
    collectedAt: z.string().datetime(),
    retrievedAt: z.string().datetime().optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const SourceRefsSchema = z.array(SourceRefSchema).min(1);

export const FifaRankingRowSchema = z
  .object({
    team: z.string().min(1),
    countryCode: z.string().min(2),
    rank: z.number().int().positive(),
    points: z.number(),
    rankingDate: z.string().min(1),
    sourceRefs: SourceRefsSchema,
  })
  .strict();

export const EloRatingRowSchema = z
  .object({
    team: z.string().min(1),
    rank: z.number().int().positive(),
    rating: z.number().int().positive(),
    lastUpdated: z.string().datetime().optional(),
    sourceRefs: SourceRefsSchema,
  })
  .strict();

export const ResultRowSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    homeTeam: z.string().min(1),
    awayTeam: z.string().min(1),
    homeScore: z.number().int().nonnegative(),
    awayScore: z.number().int().nonnegative(),
    tournament: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    neutral: z.boolean(),
    sourceRefs: SourceRefsSchema,
  })
  .strict();

export const TeamStrengthRowSchema = z
  .object({
    team: z.string().min(1),
    countryCode: z.string().min(2),
    fifaRank: z.number().int().positive(),
    fifaPoints: z.number(),
    eloRank: z.number().int().positive().optional(),
    eloRating: z.number().int().positive().optional(),
    sourceRefs: SourceRefsSchema,
  })
  .strict();

export const RecentFormRowSchema = z
  .object({
    team: z.string().min(1),
    matchesPlayed: z.number().int().min(1).max(10),
    wins: z.number().int().nonnegative(),
    draws: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    goalsFor: z.number().int().nonnegative(),
    goalsAgainst: z.number().int().nonnegative(),
    goalDifference: z.number().int(),
    goalsForPerMatch: z.number().nonnegative(),
    goalsAgainstPerMatch: z.number().nonnegative(),
    formPoints: z.number().int().nonnegative(),
    sourceRefs: SourceRefsSchema,
  })
  .strict();

export const OutputSchema = <T extends z.ZodTypeAny>(rowSchema: T) =>
  z
    .object({
      generatedAt: z.string().datetime(),
      rows: z.array(rowSchema),
      warnings: z.array(z.string().min(1)).optional(),
    })
    .strict();

export const FifaRankingOutputSchema = OutputSchema(FifaRankingRowSchema);
export const EloRatingOutputSchema = OutputSchema(EloRatingRowSchema);
export const ResultsOutputSchema = OutputSchema(ResultRowSchema);
export const TeamStrengthOutputSchema = OutputSchema(TeamStrengthRowSchema);
export const RecentFormOutputSchema = OutputSchema(RecentFormRowSchema);

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type FifaRankingRow = z.infer<typeof FifaRankingRowSchema>;
export type EloRatingRow = z.infer<typeof EloRatingRowSchema>;
export type ResultRow = z.infer<typeof ResultRowSchema>;
export type TeamStrengthRow = z.infer<typeof TeamStrengthRowSchema>;
export type RecentFormRow = z.infer<typeof RecentFormRowSchema>;
export type OutputFile<T> = {
  generatedAt: string;
  rows: T[];
  warnings?: string[];
};
