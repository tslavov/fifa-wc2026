import { z } from "zod";
import { ISODateStringSchema, SourceRefSchema, SourcedBooleanSchema, SourcedDateSchema, SourcedNumberSchema, SourcedStringSchema } from "./common.js";

export const RuleItemSchema = z.object({
  order: z.number().int().positive(),
  key: z.string().min(1),
  label: z.string().min(1),
  source: SourceRefSchema,
  sourceLocation: z.string().optional(),
  notes: z.string().optional()
});

export const TournamentRulesSchema = z.object({
  datasetId: z.string().min(1),
  generatedAt: ISODateStringSchema,
  sources: z.array(SourceRefSchema).min(1),
  tournament: z.object({
    name: SourcedStringSchema,
    startDate: SourcedDateSchema,
    endDate: SourcedDateSchema,
    hostCountries: z.array(SourcedStringSchema)
  }),
  format: z.object({
    totalTeams: SourcedNumberSchema,
    groupCount: SourcedNumberSchema,
    teamsPerGroup: SourcedNumberSchema,
    groupMatchesPerTeam: SourcedNumberSchema,
    groupStageMatchCount: SourcedNumberSchema,
    stagesAfterGroup: z.array(SourcedStringSchema)
  }),
  pointsSystem: z.object({
    win: SourcedNumberSchema,
    draw: SourcedNumberSchema,
    loss: SourcedNumberSchema
  }),
  qualification: z.object({
    topTeamsPerGroup: SourcedNumberSchema,
    bestThirdPlaceTeams: SourcedNumberSchema,
    qualifiedFromGroupsTotal: SourcedNumberSchema,
    nextRound: SourcedStringSchema
  }),
  groupRankingTiebreakers: z.array(RuleItemSchema),
  thirdPlaceRankingTiebreakers: z.array(RuleItemSchema),
  fairPlayScoreRules: z.object({
    yellowCard: SourcedNumberSchema,
    indirectRedCardSecondYellow: SourcedNumberSchema,
    directRedCard: SourcedNumberSchema,
    yellowCardAndDirectRedCard: SourcedNumberSchema,
    onlyOneDeductionPerPersonPerMatch: SourcedBooleanSchema
  }),
  matchScheduleMetadata: z.object({
    lastGroupMatchesSimultaneous: SourcedBooleanSchema,
    minimumRestDays: SourcedNumberSchema,
    matchScheduleSubjectToChange: SourcedBooleanSchema.optional(),
    annexeCThirdPlaceCombinationCount: SourcedNumberSchema.optional()
  })
});

export type TournamentRules = z.infer<typeof TournamentRulesSchema>;
export type RuleItem = z.infer<typeof RuleItemSchema>;
