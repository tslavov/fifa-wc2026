import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { teamKey } from "../normalize/teams.js";

const DETERMINISTIC_PATH = join("data", "predictions", "group-standings-v1.json");
const MONTE_CARLO_PATH = join("data", "predictions", "group-stage-monte-carlo-v1.json");
const OUTPUT_PATH = join("data", "predictions", "group-position-differences-v1.json");

type PredictionTeam = {
  predictedPosition: number;
  team: string;
  countryCode?: string;
  predictionScore?: number;
  advanceProbability?: number;
  topTwoAdvanceProbability?: number;
  averagePosition?: number;
};

type PredictionGroup = {
  group: string;
  predictedStandings: PredictionTeam[];
};

type PredictionArtifact = {
  artifactKind: string;
  predictionId?: string;
  predictionType?: string;
  generatedAt?: string;
  groups: PredictionGroup[];
};

type DifferenceRow = {
  team: string;
  countryCode: string;
  deterministicPosition: number;
  monteCarloPosition: number;
  positionDelta: number;
  movement: "up" | "down" | "same";
  deterministicPredictionScore?: number;
  monteCarloAveragePosition?: number;
  monteCarloAdvanceProbability?: number;
  monteCarloTopTwoAdvanceProbability?: number;
};

export async function comparePredictionPositions(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const deterministic = await readPredictionArtifact(DETERMINISTIC_PATH);
  const monteCarlo = await readPredictionArtifact(MONTE_CARLO_PATH);
  const warnings: string[] = [];

  const groups = deterministic.groups.map((deterministicGroup) => {
    const monteCarloGroup = monteCarlo.groups.find((group) => group.group === deterministicGroup.group);
    if (!monteCarloGroup) throw new Error(`Monte Carlo artifact is missing Group ${deterministicGroup.group}.`);

    const monteCarloByTeam = new Map(monteCarloGroup.predictedStandings.map((team) => [teamKey(team.team), team]));
    const differences: DifferenceRow[] = deterministicGroup.predictedStandings.map((deterministicTeam) => {
      const monteCarloTeam = monteCarloByTeam.get(teamKey(deterministicTeam.team));
      if (!monteCarloTeam) throw new Error(`Monte Carlo artifact is missing ${deterministicTeam.team} in Group ${deterministicGroup.group}.`);

      const positionDelta = monteCarloTeam.predictedPosition - deterministicTeam.predictedPosition;
      return {
        team: deterministicTeam.team,
        countryCode: deterministicTeam.countryCode ?? monteCarloTeam.countryCode ?? "not-collected",
        deterministicPosition: deterministicTeam.predictedPosition,
        monteCarloPosition: monteCarloTeam.predictedPosition,
        positionDelta,
        movement: positionDelta < 0 ? "up" : positionDelta > 0 ? "down" : "same",
        ...(deterministicTeam.predictionScore === undefined ? {} : { deterministicPredictionScore: deterministicTeam.predictionScore }),
        ...(monteCarloTeam.averagePosition === undefined ? {} : { monteCarloAveragePosition: monteCarloTeam.averagePosition }),
        ...(monteCarloTeam.advanceProbability === undefined ? {} : { monteCarloAdvanceProbability: monteCarloTeam.advanceProbability }),
        ...(monteCarloTeam.topTwoAdvanceProbability === undefined ? {} : { monteCarloTopTwoAdvanceProbability: monteCarloTeam.topTwoAdvanceProbability }),
      };
    });

    for (const monteCarloTeam of monteCarloGroup.predictedStandings) {
      if (!deterministicGroup.predictedStandings.some((team) => teamKey(team.team) === teamKey(monteCarloTeam.team))) {
        warnings.push(`Deterministic artifact is missing ${monteCarloTeam.team} in Group ${deterministicGroup.group}.`);
      }
    }

    return {
      group: deterministicGroup.group,
      differences,
    };
  });

  const allDifferences = groups.flatMap((group) => group.differences);
  const summary = {
    totalTeamsCompared: allDifferences.length,
    unchanged: allDifferences.filter((row) => row.movement === "same").length,
    movedUpInMonteCarlo: allDifferences.filter((row) => row.movement === "up").length,
    movedDownInMonteCarlo: allDifferences.filter((row) => row.movement === "down").length,
    maxAbsolutePositionDelta: Math.max(...allDifferences.map((row) => Math.abs(row.positionDelta))),
  };

  const output = {
    artifactKind: "prediction_comparison",
    comparisonId: "group-position-differences-v1",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: {
      notes: "This file compares prediction artifacts for review only. It must not be read by future collectors, model-input builders, or prediction builders.",
      comparisonInputPaths: [DETERMINISTIC_PATH, MONTE_CARLO_PATH],
      outputPath: OUTPUT_PATH,
    },
    inputs: {
      deterministic: {
        path: DETERMINISTIC_PATH,
        predictionId: deterministic.predictionId,
        predictionType: deterministic.predictionType,
        generatedAt: deterministic.generatedAt,
      },
      monteCarlo: {
        path: MONTE_CARLO_PATH,
        predictionId: monteCarlo.predictionId,
        predictionType: monteCarlo.predictionType,
        generatedAt: monteCarlo.generatedAt,
      },
    },
    positionDeltaDefinition: "monteCarloPosition - deterministicPosition; negative means the Monte Carlo artifact ranks the team higher, positive means lower.",
    summary,
    ...(warnings.length > 0 ? { warnings } : {}),
    groups,
  };

  await writeJson(OUTPUT_PATH, output);
  console.log(`Prediction position differences: wrote ${OUTPUT_PATH}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

async function readPredictionArtifact(path: string): Promise<PredictionArtifact> {
  const artifact = JSON.parse(await readFile(path, "utf8")) as PredictionArtifact;
  if (!Array.isArray(artifact.groups)) throw new Error(`${path} does not include groups.`);
  return artifact;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  comparePredictionPositions().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
