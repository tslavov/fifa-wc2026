import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { teamKey } from "../normalize/teams.js";

const DETERMINISTIC_PATH = join("data", "predictions", "group-standings-v1.json");
const MONTE_CARLO_PATH = join("data", "predictions", "group-stage-monte-carlo-v1.json");
const MARKOV_PATH = join("data", "predictions", "group-stage-markov-chain-v1.json");
const OUTPUT_PATH = join("data", "predictions", "standings-differences-all-methods-v1.json");

type Team = { team: string; predictedPosition: number };
type Group = { group: string; predictedStandings: Team[] };
type Artifact = { groups: Group[] };

export async function buildSimpleAllMethodComparison(): Promise<void> {
  const deterministic = await readArtifact(DETERMINISTIC_PATH);
  const monteCarlo = await readArtifact(MONTE_CARLO_PATH);
  const markov = await readArtifact(MARKOV_PATH);

  const groups = deterministic.groups.map((detGroup) => {
    const mcGroup = findGroup(monteCarlo, detGroup.group, "monteCarlo");
    const markovGroup = findGroup(markov, detGroup.group, "markov");
    const deterministicPositions = toPositionMap(detGroup);
    const monteCarloPositions = toPositionMap(mcGroup);
    const markovPositions = toPositionMap(markovGroup);

    return {
      group: detGroup.group,
      standings: {
        deterministic: orderedTeams(detGroup),
        monteCarlo: orderedTeams(mcGroup),
        markov: orderedTeams(markovGroup),
      },
      differences: orderedTeams(detGroup).map((team) => {
        const key = teamKey(team);
        const deterministicPosition = requiredPosition(deterministicPositions, key, team, "deterministic");
        const monteCarloPosition = requiredPosition(monteCarloPositions, key, team, "monteCarlo");
        const markovPosition = requiredPosition(markovPositions, key, team, "markov");
        return {
          team,
          deterministic: deterministicPosition,
          monteCarlo: monteCarloPosition,
          markov: markovPosition,
          monteCarloMinusDeterministic: monteCarloPosition - deterministicPosition,
          markovMinusDeterministic: markovPosition - deterministicPosition,
          markovMinusMonteCarlo: markovPosition - monteCarloPosition,
        };
      }),
    };
  });

  await writeJson(OUTPUT_PATH, { noFutureUse: true, groups });
  console.log(`Simple all-method standings comparison: wrote ${OUTPUT_PATH}`);
}

async function readArtifact(path: string): Promise<Artifact> {
  const artifact = JSON.parse(await readFile(path, "utf8")) as Artifact;
  if (!Array.isArray(artifact.groups)) throw new Error(`${path} does not contain groups.`);
  return artifact;
}

function findGroup(artifact: Artifact, groupName: string, label: string): Group {
  const group = artifact.groups.find((item) => item.group === groupName);
  if (!group) throw new Error(`${label} artifact is missing Group ${groupName}.`);
  return group;
}

function orderedTeams(group: Group): string[] {
  return [...group.predictedStandings].sort((a, b) => a.predictedPosition - b.predictedPosition).map((team) => team.team);
}

function toPositionMap(group: Group): Map<string, number> {
  return new Map(group.predictedStandings.map((team) => [teamKey(team.team), team.predictedPosition]));
}

function requiredPosition(positions: Map<string, number>, key: string, team: string, label: string): number {
  const position = positions.get(key);
  if (position === undefined) throw new Error(`${label} artifact is missing ${team}.`);
  return position;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildSimpleAllMethodComparison().catch((error: unknown) => {
    console.error(formatError(error));
    process.exit(1);
  });
}
