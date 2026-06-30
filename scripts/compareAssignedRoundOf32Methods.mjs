import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PATHS = {
  markov: join("data", "predictions", "assigned-round-of-32-score-predictions-v1.json"),
  comparison: join("data", "predictions", "assigned-round-of-32-method-comparison-v1.json"),
  report: join("reports", "assigned-round-of-32-method-comparison.md"),
};

const PURE_LLM_PICKS = new Map([
  [73, { score: { home: 1, away: 2 }, lean: "away", rationale: "Canada's group scoring and goal difference look more convincing than South Africa's lower-output route." }],
  [74, { score: { home: 2, away: 0 }, lean: "home", rationale: "Germany's attack and group goal difference point to control, but a knockout setting argues for a slightly lower score than the model's 3-0." }],
  [75, { score: { home: 2, away: 1 }, lean: "home", rationale: "Netherlands have the higher attacking ceiling, while Morocco's group strength keeps the margin narrow." }],
  [76, { score: { home: 2, away: 1 }, lean: "home", rationale: "Brazil have the stronger defensive profile and top-end quality, with Japan still likely to score." }],
  [77, { score: { home: 3, away: 1 }, lean: "home", rationale: "France's group dominance is the clearest signal, though Sweden's scoring record makes a consolation plausible." }],
  [78, { score: { home: 1, away: 2 }, lean: "away", rationale: "Norway's attack and Elo profile are appealing enough to override Ivory Coast's cleaner group table." }],
  [79, { score: { home: 2, away: 0 }, lean: "home", rationale: "Mexico's perfect group record and clean-sheet profile make them a strong qualitative pick against Ecuador." }],
  [80, { score: { home: 2, away: 0 }, lean: "home", rationale: "England have the stronger squad baseline and DR Congo's group record is still weak even with the assigned slot." }],
  [81, { score: { home: 2, away: 1 }, lean: "home", rationale: "The United States have the better group result and home-region context, but Bosnia's scoring keeps it competitive." }],
  [82, { score: { home: 2, away: 1 }, lean: "home", rationale: "Belgium's unbeaten group and stronger baseline edge Senegal, while Senegal's attack keeps the score close." }],
  [83, { score: { home: 2, away: 1 }, lean: "home", rationale: "Portugal's attacking return and squad quality point slightly above Croatia's uneven group phase." }],
  [84, { score: { home: 2, away: 0 }, lean: "home", rationale: "Spain's defensive group record and control profile make them a clear pick over Austria." }],
  [85, { score: { home: 2, away: 1 }, lean: "home", rationale: "Switzerland's balance and group consistency look safer than Algeria's third-place route." }],
  [86, { score: { home: 2, away: 0 }, lean: "home", rationale: "Argentina are the stronger side, while Cape Verde's low-scoring profile points to a controlled match." }],
  [87, { score: { home: 2, away: 0 }, lean: "home", rationale: "Colombia's group position and defensive profile give them the qualitative edge over Ghana." }],
  [88, { score: { home: 0, away: 1 }, lean: "away", rationale: "Egypt's unbeaten group profile and better scoring form edge Australia in a tight knockout game." }],
]);

async function main() {
  const generatedAt = new Date().toISOString();
  const markov = await readJson(PATHS.markov);
  const rows = markov.matches.map((match) => compareMatch(match));
  const summary = buildSummary(rows);
  const output = {
    artifactKind: "prediction_comparison",
    comparisonId: "assigned-round-of-32-method-comparison-v1",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: {
      comparisonInputPaths: [PATHS.markov],
      outputPath: PATHS.comparison,
      notes: "Comparison artifact for review only. It must not be read by future collectors, model-input builders, or prediction builders.",
    },
    scope: {
      stage: "Round of 32",
      assignedFixturesOnly: true,
      comparedFixtureCount: rows.length,
      groupStageStatus: markov.groupStageStatus,
      ninetyMinuteOnly: true,
    },
    methods: {
      markovChain: {
        source: PATHS.markov,
        description: "Exact 90-minute score distribution from calibrated Markov goal process using assigned fixture team stats.",
      },
      monteCarlo: {
        description: "20,000 seeded samples per fixture from independent Poisson approximations using the Markov expected goals.",
        iterationsPerFixture: 20000,
        seed: 20260628,
      },
      pureLlm: {
        description: "Qualitative LLM-only picks from team quality, group form, knockout caution, and matchup narrative; no numeric model or random simulation.",
      },
    },
    summary,
    matches: rows,
    warnings: [
      "Group stage is still provisional in the source prediction artifact.",
      "All three methods are 90-minute comparisons; extra time and penalties are not modeled.",
      "Monte Carlo uses the same xG baseline as Markov, so differences are sampling/aggregation differences rather than independent data.",
    ],
  };
  await writeJson(PATHS.comparison, output);
  await writeText(PATHS.report, buildReport(output));
  console.log(`Wrote ${PATHS.comparison}`);
  console.log(`Wrote ${PATHS.report}`);
}

function compareMatch(match) {
  const monteCarlo = monteCarloFixture(match, 20000, 20260628 + match.matchNumber);
  const llm = PURE_LLM_PICKS.get(match.matchNumber);
  if (!llm) throw new Error(`Missing pure LLM pick for match ${match.matchNumber}`);
  const markovLean = leanFromProbabilities(match.outcomeProbabilities.homeWin, match.outcomeProbabilities.drawThrough90, match.outcomeProbabilities.awayWin);
  return {
    matchNumber: match.matchNumber,
    fixture: `${match.homeTeam} vs ${match.awayTeam}`,
    date: match.date,
    venue: match.venue,
    markovChain: {
      selectedScore: match.selectedScore,
      lean: markovLean,
      homeWin: match.outcomeProbabilities.homeWin,
      drawThrough90: match.outcomeProbabilities.drawThrough90,
      awayWin: match.outcomeProbabilities.awayWin,
      expectedGoals: match.expectedGoals,
      confidence: match.confidenceLevel,
    },
    monteCarlo,
    pureLlm: {
      selectedScore: llm.score,
      lean: llm.lean,
      rationale: llm.rationale,
    },
    agreement: {
      leanAgreementCount: new Set([markovLean, monteCarlo.lean, llm.lean]).size === 1 ? 3 : new Set([markovLean, monteCarlo.lean, llm.lean]).size === 2 ? 2 : 1,
      markovMonteCarloSameScore: sameScore(match.selectedScore, monteCarlo.selectedScore),
      markovPureLlmSameScore: sameScore(match.selectedScore, llm.score),
      monteCarloPureLlmSameScore: sameScore(monteCarlo.selectedScore, llm.score),
    },
  };
}

function monteCarloFixture(match, iterations, seed) {
  const rng = mulberry32(seed);
  const counts = new Map();
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let homeGoalsTotal = 0;
  let awayGoalsTotal = 0;
  for (let index = 0; index < iterations; index += 1) {
    const home = poisson(match.expectedGoals.home, rng);
    const away = poisson(match.expectedGoals.away, rng);
    homeGoalsTotal += home;
    awayGoalsTotal += away;
    if (home > away) homeWins += 1;
    else if (home < away) awayWins += 1;
    else draws += 1;
    const key = `${home}-${away}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [scoreKey, scoreCount] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const [home, away] = scoreKey.split("-").map(Number);
  const homeWin = round(homeWins / iterations);
  const drawThrough90 = round(draws / iterations);
  const awayWin = round(awayWins / iterations);
  return {
    selectedScore: { home, away },
    selectedScoreProbability: round(scoreCount / iterations),
    lean: leanFromProbabilities(homeWin, drawThrough90, awayWin),
    homeWin,
    drawThrough90,
    awayWin,
    expectedGoals: {
      home: round(homeGoalsTotal / iterations),
      away: round(awayGoalsTotal / iterations),
    },
  };
}

function buildSummary(rows) {
  return {
    comparedFixtures: rows.length,
    unanimousLean: rows.filter((row) => row.agreement.leanAgreementCount === 3).length,
    splitLean: rows.filter((row) => row.agreement.leanAgreementCount < 3).length,
    markovMonteCarloSameScore: rows.filter((row) => row.agreement.markovMonteCarloSameScore).length,
    markovPureLlmSameScore: rows.filter((row) => row.agreement.markovPureLlmSameScore).length,
    monteCarloPureLlmSameScore: rows.filter((row) => row.agreement.monteCarloPureLlmSameScore).length,
    pureLlmDisagreesOnLean: rows
      .filter((row) => row.pureLlm.lean !== row.markovChain.lean || row.pureLlm.lean !== row.monteCarlo.lean)
      .map((row) => ({ matchNumber: row.matchNumber, fixture: row.fixture, pureLlmLean: row.pureLlm.lean, markovLean: row.markovChain.lean, monteCarloLean: row.monteCarlo.lean })),
  };
}

function buildReport(comparison) {
  return [
    "# Assigned Round of 32 Method Comparison",
    "",
    `Generated: ${comparison.generatedAt}`,
    "",
    "## Scope",
    "",
    `- Compared fixtures: ${comparison.summary.comparedFixtures}.`,
    `- Unanimous 90-minute lean: ${comparison.summary.unanimousLean}.`,
    `- Split 90-minute lean: ${comparison.summary.splitLean}.`,
    `- Markov/Monte Carlo exact-score agreement: ${comparison.summary.markovMonteCarloSameScore}/${comparison.summary.comparedFixtures}.`,
    `- Markov/Pure LLM exact-score agreement: ${comparison.summary.markovPureLlmSameScore}/${comparison.summary.comparedFixtures}.`,
    "- Extra time and penalties are not modeled.",
    "",
    "## Comparison Table",
    "",
    "| Match | Markov chain | Monte Carlo | Pure LLM | Lean agreement |",
    "| --- | --- | --- | --- | --- |",
    ...comparison.matches.map((match) => {
      const markov = `${formatScore(match.markovChain.selectedScore)} (${formatWdl(match.markovChain)})`;
      const monteCarlo = `${formatScore(match.monteCarlo.selectedScore)} (${formatWdl(match.monteCarlo)})`;
      const llm = `${formatScore(match.pureLlm.selectedScore)} (${match.pureLlm.lean})`;
      return `| ${match.matchNumber}: ${match.fixture} | ${markov} | ${monteCarlo} | ${llm} | ${match.agreement.leanAgreementCount}/3 |`;
    }),
    "",
    "## Pure LLM Notes",
    "",
    ...comparison.matches.map((match) => `- ${match.matchNumber}: ${match.fixture}: ${match.pureLlm.rationale}`),
    "",
    "## Method Notes",
    "",
    "- Markov chain: exact score distribution from the assigned Round of 32 prediction artifact.",
    "- Monte Carlo: 20,000 seeded score samples per fixture from the Markov expected-goals baseline.",
    "- Pure LLM: qualitative pick only, deliberately not fed back into model inputs.",
    "",
    "## Warnings",
    "",
    ...comparison.warnings.map((warning) => `- ${warning}`),
    "",
  ].join("\n");
}

function leanFromProbabilities(homeWin, draw, awayWin) {
  if (homeWin >= draw && homeWin >= awayWin) return "home";
  if (awayWin >= homeWin && awayWin >= draw) return "away";
  return "draw/extra-time risk";
}

function poisson(lambda, rng) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= rng();
  } while (product > limit);
  return count - 1;
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

function sameScore(a, b) {
  return a.home === b.home && a.away === b.away;
}

function formatScore(score) {
  return `${score.home}-${score.away}`;
}

function formatWdl(row) {
  return `H ${percent(row.homeWin)} / D ${percent(row.drawThrough90)} / A ${percent(row.awayWin)}`;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
