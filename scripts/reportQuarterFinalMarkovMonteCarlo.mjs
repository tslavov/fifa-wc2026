import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const INPUT_PATH = join("data", "predictions", "quarter-final-score-predictions-v1.json");
const REPORT_PATH = join("reports", "quarter-final-markov-monte-carlo.md");
const COMMANDS = [
  "node scripts/updateAfterRoundOf16.mjs",
  "node scripts/reportQuarterFinalMarkovMonteCarlo.mjs",
];
const MONTE_CARLO_ITERATIONS = 250000;
const MONTE_CARLO_SEED_BASE = 2026070800;

const generatedAt = new Date().toISOString();
const artifact = JSON.parse(await readFile(INPUT_PATH, "utf8"));
const rows = artifact.matches.flatMap((match) => [
  markovRow(match),
  monteCarloRow(match, MONTE_CARLO_ITERATIONS, MONTE_CARLO_SEED_BASE + match.matchNumber),
]);
const comparisons = artifact.matches.map((match) => {
  const markov = rows.find((row) => row.matchNumber === match.matchNumber && row.method === "Markov");
  const monteCarlo = rows.find((row) => row.matchNumber === match.matchNumber && row.method === "Monte Carlo");
  return {
    matchNumber: match.matchNumber,
    match: `${match.homeTeam} vs ${match.awayTeam}`,
    monteCarloPick: monteCarlo.qualifier,
    markovPick: markov.qualifier,
    sameWinner: monteCarlo.qualifier === markov.qualifier,
    sameScore: monteCarlo.selectedScore.home === markov.selectedScore.home && monteCarlo.selectedScore.away === markov.selectedScore.away,
    qualificationDelta: round(Math.abs(monteCarlo.qualification.home - markov.qualification.home)),
  };
});

const report = [
  "# Quarter-Final Markov vs Monte Carlo",
  "",
  `Generated: ${generatedAt}`,
  "",
  "## Files Used",
  "",
  `- ${INPUT_PATH}`,
  ...artifact.contaminationControl.builderInputPaths.map((path) => `- ${path}`),
  "",
  "## Commands Executed",
  "",
  ...COMMANDS.map((command) => `- \`${command}\``),
  "",
  "## Seeds",
  "",
  `- Monte Carlo iterations per fixture: ${MONTE_CARLO_ITERATIONS}`,
  `- Monte Carlo seed base: ${MONTE_CARLO_SEED_BASE}`,
  ...artifact.matches.map((match) => `- ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} seed ${MONTE_CARLO_SEED_BASE + match.matchNumber}`),
  "",
  "## Results",
  "",
  "| Match | Method | Expected goals | Most probable score | Selected score | Home win | Draw | Away win | Extra time | Penalties | Qualification |",
  "| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...rows.map((row) => `| ${row.matchNumber}: ${row.match} | ${row.method} | ${row.expectedGoals.home}-${row.expectedGoals.away} | ${formatScore(row.mostProbableScore)} (${percent(row.mostProbableScore.probability)}) | ${formatScore(row.selectedScore)} | ${percent(row.outcomes.homeWin)} | ${percent(row.outcomes.drawThrough90)} | ${percent(row.outcomes.awayWin)} | ${percent(row.extraTime)} | ${percent(row.penalties)} | ${row.homeTeam} ${percent(row.qualification.home)}, ${row.awayTeam} ${percent(row.qualification.away)} |`),
  "",
  "## Method Comparison",
  "",
  "| Match | Monte Carlo pick | Markov pick | Same winner | Same score |",
  "| --- | --- | --- | --- | --- |",
  ...comparisons.map((row) => `| ${row.matchNumber}: ${row.match} | ${row.monteCarloPick} | ${row.markovPick} | ${yesNo(row.sameWinner)} | ${yesNo(row.sameScore)} |`),
  "",
  "## Disagreements",
  "",
  ...disagreementLines(comparisons),
  "",
  "## Validation",
  "",
  ...validationLines(rows),
  "",
].join("\n");

await writeText(REPORT_PATH, report);
console.log(`Wrote ${REPORT_PATH}`);

function markovRow(match) {
  return {
    matchNumber: match.matchNumber,
    match: `${match.homeTeam} vs ${match.awayTeam}`,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    method: "Markov",
    expectedGoals: match.expectedGoals,
    mostProbableScore: match.mostProbableScore,
    selectedScore: match.selectedScore,
    outcomes: match.outcomeProbabilities,
    extraTime: match.extraTimeProbability,
    penalties: match.penaltyShootoutProbability.unconditional,
    qualification: match.qualificationProbabilities,
    qualifier: match.selectedAdvancingTeam,
    validation: {
      scoreMatrixSum: round(match.scoreDistribution.reduce((sum, score) => sum + score.probability, 0)),
      wdlSum: round(match.outcomeProbabilities.homeWin + match.outcomeProbabilities.drawThrough90 + match.outcomeProbabilities.awayWin),
      qualificationSum: round(match.qualificationProbabilities.home + match.qualificationProbabilities.away),
      penaltiesNotAboveExtraTime: match.penaltyShootoutProbability.unconditional <= match.extraTimeProbability + 0.0001,
    },
  };
}

function monteCarloRow(match, iterations, seed) {
  const rng = mulberry32(seed);
  const scoreCounts = new Map();
  let homeGoals = 0;
  let awayGoals = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let penalties = 0;
  let homeQualifies = 0;
  const homeFromDraw = match.outcomeProbabilities.drawThrough90 === 0
    ? 0.5
    : clamp((match.qualificationProbabilities.home - match.outcomeProbabilities.homeWin) / match.outcomeProbabilities.drawThrough90, 0, 1);

  for (let i = 0; i < iterations; i += 1) {
    const score = sampleScore(match.scoreDistribution, rng);
    homeGoals += score.homeGoals;
    awayGoals += score.awayGoals;
    increment(scoreCounts, `${score.homeGoals}-${score.awayGoals}`);
    if (score.homeGoals > score.awayGoals) {
      homeWins += 1;
      homeQualifies += 1;
    } else if (score.homeGoals < score.awayGoals) {
      awayWins += 1;
    } else {
      draws += 1;
      if (rng() < match.penaltyShootoutProbability.conditionalOnExtraTime) penalties += 1;
      if (rng() < homeFromDraw) homeQualifies += 1;
    }
  }

  const mostProbable = [...scoreCounts.entries()]
    .map(([score, count]) => {
      const [home, away] = score.split("-").map(Number);
      return { home, away, probability: round(count / iterations), count };
    })
    .sort((a, b) => b.count - a.count || a.home - b.home || a.away - b.away)[0];
  const qualification = { home: round(homeQualifies / iterations), away: round(1 - homeQualifies / iterations) };
  return {
    matchNumber: match.matchNumber,
    match: `${match.homeTeam} vs ${match.awayTeam}`,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    method: "Monte Carlo",
    seed,
    iterations,
    expectedGoals: { home: round(homeGoals / iterations), away: round(awayGoals / iterations) },
    mostProbableScore: mostProbable,
    selectedScore: { home: mostProbable.home, away: mostProbable.away },
    outcomes: {
      homeWin: round(homeWins / iterations),
      drawThrough90: round(draws / iterations),
      awayWin: round(awayWins / iterations),
    },
    extraTime: round(draws / iterations),
    penalties: round(penalties / iterations),
    qualification,
    qualifier: qualification.home >= qualification.away ? match.homeTeam : match.awayTeam,
    validation: {
      scoreMatrixSum: round([...scoreCounts.values()].reduce((sum, count) => sum + count, 0) / iterations),
      wdlSum: round((homeWins + draws + awayWins) / iterations),
      qualificationSum: round(qualification.home + qualification.away),
      penaltiesNotAboveExtraTime: penalties <= draws,
    },
  };
}

function sampleScore(distribution, rng) {
  const roll = rng();
  let cumulative = 0;
  for (const score of distribution) {
    cumulative += score.probability;
    if (roll <= cumulative) return score;
  }
  return distribution[distribution.length - 1];
}

function validationLines(rows) {
  return rows.map((row) => {
    const ok = Math.abs(row.validation.scoreMatrixSum - 1) <= 0.001
      && Math.abs(row.validation.wdlSum - 1) <= 0.001
      && Math.abs(row.validation.qualificationSum - 1) <= 0.001
      && row.validation.penaltiesNotAboveExtraTime;
    return `- ${row.matchNumber} ${row.method}: ${ok ? "pass" : "fail"}; score matrix ${row.validation.scoreMatrixSum}, 1X2 ${row.validation.wdlSum}, qualification ${row.validation.qualificationSum}, penalties<=ET ${row.validation.penaltiesNotAboveExtraTime}.`;
  });
}

function disagreementLines(comparisons) {
  const lines = comparisons.flatMap((row) => {
    const out = [];
    if (!row.sameWinner) out.push(`- ${row.match}: winner differs.`);
    if (!row.sameScore) out.push(`- ${row.match}: exact score differs.`);
    if (row.qualificationDelta >= 0.01) out.push(`- ${row.match}: qualification probability differs by ${percent(row.qualificationDelta)}.`);
    return out;
  });
  return lines.length ? lines : ["- No winner or exact-score disagreements; qualification differences are sampling noise only."];
}

function formatScore(score) {
  return `${score.home}-${score.away}`;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}
