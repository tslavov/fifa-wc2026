import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import {
  RecentFormOutputSchema,
  TeamStrengthOutputSchema,
  type OutputFile,
  type RecentFormRow,
  type TeamStrengthRow,
} from "../schemas.js";
import { normalizeTeamName, teamKey } from "../normalize/teams.js";

const TEAM_STRENGTH_PATH = join("data", "model-input", "team-strength.json");
const RECENT_FORM_PATH = join("data", "model-input", "recent-form.json");
const GROUPS_PATH = "fifa-world-cup-2026-groups.md";
const OUTPUT_PATH = join("data", "predictions", "group-standings-v1.json");
const PREDICTIONS_DIR = normalize(join("data", "predictions"));

const WEIGHTS = {
  fifaPoints: 0.35,
  fifaRank: 0.2,
  eloRating: 0.3,
  recentFormPointsRate: 0.1,
  recentGoalDifferencePerMatch: 0.05,
} as const;

type ScoreComponent = {
  name: keyof typeof WEIGHTS;
  value: number;
  weight: number;
  weightedValue: number;
};

type PredictionTeam = {
  predictedPosition: number;
  team: string;
  countryCode: string;
  predictionScore: number;
  rankOrderOnly: true;
  scoreComponents: ScoreComponent[];
  sourceFeatureRefs: {
    teamStrength: string;
    recentForm: string;
  };
  predictionFlags: {
    isPrediction: true;
    excludeFromFuturePredictionInputs: true;
    doNotUseAsTrainingData: true;
  };
};

type GroupPrediction = {
  group: string;
  predictedStandings: PredictionTeam[];
};

export async function buildGroupStandingsPrediction(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputPaths = [TEAM_STRENGTH_PATH, RECENT_FORM_PATH, GROUPS_PATH];
  assertNoPredictionInputs(inputPaths);

  const teamStrength = TeamStrengthOutputSchema.parse(await readJson(TEAM_STRENGTH_PATH)) as OutputFile<TeamStrengthRow>;
  const recentForm = RecentFormOutputSchema.parse(await readJson(RECENT_FORM_PATH)) as OutputFile<RecentFormRow>;
  const groupsMarkdown = await readFile(GROUPS_PATH, "utf8");
  const groupDefinitions = parseGroups(groupsMarkdown);
  const warnings: string[] = [];

  warnings.push(...(teamStrength.warnings ?? []).map((warning) => `Team-strength warning carried forward: ${warning}`));
  warnings.push(...(recentForm.warnings ?? []).map((warning) => `Recent-form warning carried forward: ${warning}`));

  const strengthByTeam = new Map(teamStrength.rows.map((row) => [teamKey(row.team), row]));
  const formByTeam = new Map(recentForm.rows.map((row) => [teamKey(row.team), row]));
  const stats = buildStats(teamStrength.rows, recentForm.rows);

  const groups: GroupPrediction[] = groupDefinitions.map((definition) => {
    const predictedStandings = definition.teams
      .map((rawTeam) => buildTeamPrediction(rawTeam, strengthByTeam, formByTeam, stats, warnings))
      .filter((row): row is Omit<PredictionTeam, "predictedPosition"> & { fifaRank: number; eloRank?: number } => row !== undefined)
      .sort((a, b) =>
        b.predictionScore - a.predictionScore ||
        a.fifaRank - b.fifaRank ||
        (a.eloRank ?? Number.POSITIVE_INFINITY) - (b.eloRank ?? Number.POSITIVE_INFINITY) ||
        a.team.localeCompare(b.team),
      )
      .map(({ fifaRank, eloRank, ...row }, index) => ({
        ...row,
        predictedPosition: index + 1,
      }));

    return {
      group: definition.group,
      predictedStandings,
    };
  });

  const output = {
    artifactKind: "prediction",
    predictionId: "group-standings-v1",
    predictionType: "group_standings_rank_order",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: {
      outputDirectory: PREDICTIONS_DIR,
      builderInputPaths: inputPaths,
      predictionDirectoryReadAsInput: false,
      notes:
        "This artifact is an output for review only. Future collectors, features, model inputs, and predictions must not read data/predictions as input.",
    },
    method: {
      type: "deterministic_collected_feature_score",
      languageModelUsedForTeamOrdering: false,
      monteCarloIterations: 0,
      rankOrderOnly: true,
      weights: WEIGHTS,
      missingFeatureHandling:
        "Missing optional components are omitted and remaining component weights are renormalized for that team; warnings are emitted.",
      tieBreakers: ["higher predictionScore", "lower fifaRank", "lower eloRank", "team name"],
    },
    basedOnData: {
      teamStrength: {
        path: TEAM_STRENGTH_PATH,
        generatedAt: teamStrength.generatedAt,
      },
      recentForm: {
        path: RECENT_FORM_PATH,
        generatedAt: recentForm.generatedAt,
      },
      groups: {
        path: GROUPS_PATH,
        notes: "Local group file with FIFA source links; group membership is used only to arrange teams into groups.",
      },
    },
    warnings,
    groups,
  };

  await writeJson(OUTPUT_PATH, output);
  console.log(`Group standings prediction: wrote ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

type GroupDefinition = {
  group: string;
  teams: string[];
};

type Stats = {
  fifaRankMin: number;
  fifaRankMax: number;
  fifaPointsMin: number;
  fifaPointsMax: number;
  eloRatingMin: number;
  eloRatingMax: number;
  gdPerMatchMin: number;
  gdPerMatchMax: number;
};

function parseGroups(markdown: string): GroupDefinition[] {
  const groups: GroupDefinition[] = [];
  let currentGroup: GroupDefinition | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## Group ([A-L])$/);
    if (heading) {
      currentGroup = { group: heading[1], teams: [] };
      groups.push(currentGroup);
      continue;
    }

    if (line.startsWith("## ") && currentGroup) {
      currentGroup = undefined;
      continue;
    }

    const team = line.match(/^-\s+(.+)$/)?.[1];
    if (team && currentGroup) {
      currentGroup.teams.push(normalizeTeamName(team));
    }
  }

  return groups;
}

function buildStats(teamStrength: TeamStrengthRow[], recentForm: RecentFormRow[]): Stats {
  const fifaRanks = teamStrength.map((row) => row.fifaRank);
  const fifaPoints = teamStrength.map((row) => row.fifaPoints);
  const eloRatings = teamStrength.flatMap((row) => (row.eloRating === undefined ? [] : [row.eloRating]));
  const gdPerMatch = recentForm.map((row) => row.goalDifference / row.matchesPlayed);

  return {
    fifaRankMin: Math.min(...fifaRanks),
    fifaRankMax: Math.max(...fifaRanks),
    fifaPointsMin: Math.min(...fifaPoints),
    fifaPointsMax: Math.max(...fifaPoints),
    eloRatingMin: Math.min(...eloRatings),
    eloRatingMax: Math.max(...eloRatings),
    gdPerMatchMin: Math.min(...gdPerMatch),
    gdPerMatchMax: Math.max(...gdPerMatch),
  };
}

function buildTeamPrediction(
  rawTeam: string,
  strengthByTeam: Map<string, TeamStrengthRow>,
  formByTeam: Map<string, RecentFormRow>,
  stats: Stats,
  warnings: string[],
): (Omit<PredictionTeam, "predictedPosition"> & { fifaRank: number; eloRank?: number }) | undefined {
  const team = normalizeTeamName(rawTeam);
  const strength = strengthByTeam.get(teamKey(team));
  const form = formByTeam.get(teamKey(team));

  if (!strength) {
    warnings.push(`No team-strength row found for group team ${team}; omitted from prediction.`);
    return undefined;
  }

  if (!form) {
    warnings.push(`No recent-form row found for group team ${team}; omitted from prediction.`);
    return undefined;
  }

  const components: ScoreComponent[] = [];
  addComponent(components, "fifaPoints", normalizeRange(strength.fifaPoints, stats.fifaPointsMin, stats.fifaPointsMax));
  addComponent(components, "fifaRank", normalizeInverseRange(strength.fifaRank, stats.fifaRankMin, stats.fifaRankMax));

  if (strength.eloRating === undefined) {
    warnings.push(`No Elo rating available for ${team}; Elo component omitted and weights renormalized.`);
  } else {
    addComponent(components, "eloRating", normalizeRange(strength.eloRating, stats.eloRatingMin, stats.eloRatingMax));
  }

  addComponent(components, "recentFormPointsRate", form.formPoints / (form.matchesPlayed * 3));
  addComponent(
    components,
    "recentGoalDifferencePerMatch",
    normalizeRange(form.goalDifference / form.matchesPlayed, stats.gdPerMatchMin, stats.gdPerMatchMax),
  );

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const normalizedComponents = components.map((component) => ({
    ...component,
    weight: round(component.weight / totalWeight),
    weightedValue: round((component.value * component.weight) / totalWeight),
  }));
  const predictionScore = round(normalizedComponents.reduce((sum, component) => sum + component.weightedValue, 0));

  return {
    team: strength.team,
    countryCode: strength.countryCode,
    predictionScore,
    rankOrderOnly: true,
    scoreComponents: normalizedComponents,
    sourceFeatureRefs: {
      teamStrength: TEAM_STRENGTH_PATH,
      recentForm: RECENT_FORM_PATH,
    },
    predictionFlags: {
      isPrediction: true,
      excludeFromFuturePredictionInputs: true,
      doNotUseAsTrainingData: true,
    },
    fifaRank: strength.fifaRank,
    ...(strength.eloRank === undefined ? {} : { eloRank: strength.eloRank }),
  };
}

function addComponent(components: ScoreComponent[], name: keyof typeof WEIGHTS, value: number): void {
  components.push({
    name,
    value: round(value),
    weight: WEIGHTS[name],
    weightedValue: round(value * WEIGHTS[name]),
  });
}

function normalizeRange(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return clamp((value - min) / (max - min));
}

function normalizeInverseRange(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return clamp((max - value) / (max - min));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function assertNoPredictionInputs(paths: string[]): void {
  for (const path of paths) {
    const normalizedPath = normalize(path);
    if (normalizedPath === PREDICTIONS_DIR || normalizedPath.startsWith(`${PREDICTIONS_DIR}\\`)) {
      throw new Error(`Prediction input contamination blocked: ${path}`);
    }
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildGroupStandingsPrediction().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
