import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";

const PATHS = {
  teamStats: join("data", "knockout", "round-of-16-team-stats-v1.json"),
  calibration: join("data", "model", "calibration-changes-after-round-of-32-v1.json"),
  round16: join("data", "predictions", "round-of-16-enhanced-predictions-v2.json"),
  simulation: join("data", "predictions", "world-cup-2026-full-knockout-simulation.json"),
  stageProbabilities: join("data", "predictions", "world-cup-2026-stage-probabilities.json"),
  finalPairings: join("data", "predictions", "world-cup-2026-possible-final-pairings.json"),
  report: join("reports", "world-cup-2026-full-tournament-prediction.md"),
};

const STAGE_BY_MATCH = new Map([
  [89, "round_of_16"], [90, "round_of_16"], [91, "round_of_16"], [92, "round_of_16"],
  [93, "round_of_16"], [94, "round_of_16"], [95, "round_of_16"], [96, "round_of_16"],
  [97, "quarter_final"], [98, "quarter_final"], [99, "quarter_final"], [100, "quarter_final"],
  [101, "semi_final"], [102, "semi_final"],
  [103, "third_place"], [104, "final"],
]);

const aliases = new Map([
  ["usa", "United States"],
  ["united states of america", "United States"],
]);

async function main() {
  const generatedAt = new Date().toISOString();
  const [teamStats, calibration, round16Artifact, calendar] = await Promise.all([
    readJson(PATHS.teamStats),
    readJson(PATHS.calibration),
    readJson(PATHS.round16),
    fetchFifaCalendar(),
  ]);
  const fixtures = calendar.Results
    .filter((match) => match.MatchNumber >= 89 && match.MatchNumber <= 104)
    .map((match) => normalizeFixture(match))
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const params = {
    ...calibration.updatedParameters.markovChainScorePredictions.modelParameters,
    baseGoalsPerTeamMatch: average(teamStats.teams.map((team) => team.totals.goalsForPerMatch)),
  };
  const modelTeams = buildModelInputs(teamStats.teams, params);
  const teamByName = new Map(modelTeams.map((team) => [teamKey(team.team), team]));
  const fixtureByNumber = new Map(fixtures.map((fixture) => [fixture.matchNumber, fixture]));
  const matchupCache = new Map();

  const simulation = runTournamentSimulation(fixtureByNumber, teamByName, params, matchupCache, 50000);
  const primaryPath = buildDeterministicPath(fixtureByNumber, teamByName, params, matchupCache, "most_likely");
  const alternativePath = buildDeterministicPath(fixtureByNumber, teamByName, params, matchupCache, "second_likely");
  const selectedTournamentPrediction = buildSelectedTournamentPrediction(simulation, primaryPath, teamByName, params, matchupCache);
  const stageProbabilities = buildStageProbabilities(simulation, generatedAt);
  const finalPairings = buildFinalPairings(simulation, generatedAt);
  const output = {
    artifactKind: "knockout_simulation",
    predictionId: "world-cup-2026-full-knockout-simulation",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    contaminationControl: {
      builderInputPaths: [PATHS.teamStats, PATHS.calibration, PATHS.round16],
      previousPredictionArtifactsUsedForEvaluationOnly: false,
      noFutureResultsUsed: true,
    },
    method: {
      markov: "Score distributions for every matchup.",
      monteCarlo: "50,000 seeded full-bracket simulations using Markov qualification probabilities.",
      llmOnly: "Separate qualitative comparison from team quality and tournament totals only.",
      modelParameters: params,
    },
    officialBracket: fixtures,
    mostLikelyPath: primaryPath,
    alternativePath,
    selectedTournamentPrediction,
    summary: simulation.summary,
    matchups: [...matchupCache.values()].sort((a, b) => a.homeTeam.localeCompare(b.homeTeam) || a.awayTeam.localeCompare(b.awayTeam)),
  };
  await writeJson(PATHS.simulation, output);
  await writeJson(PATHS.stageProbabilities, stageProbabilities);
  await writeJson(PATHS.finalPairings, finalPairings);
  await writeText(PATHS.report, buildReport(output, stageProbabilities, finalPairings, round16Artifact));

  console.log(`Wrote ${PATHS.simulation}`);
  console.log(`Wrote ${PATHS.stageProbabilities}`);
  console.log(`Wrote ${PATHS.finalPairings}`);
  console.log(`Wrote ${PATHS.report}`);
}

async function fetchFifaCalendar() {
  const response = await fetch(FIFA_API_URL, { headers: { "user-agent": "fifa-wc2026-data-pipeline/0.1 (+full-knockout-simulation)" } });
  if (!response.ok) throw new Error(`${FIFA_API_URL} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function runTournamentSimulation(fixtures, teamByName, params, matchupCache, iterations) {
  const rng = mulberry32(20260704);
  const stageCounts = new Map();
  const finalPairings = new Map();
  const runnerUpCounts = new Map();
  const thirdCounts = new Map();
  const championCounts = new Map();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const resolved = new Map();
    for (const matchNumber of [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102]) {
      const match = resolveFixture(fixtures.get(matchNumber), resolved);
      const prediction = matchupPrediction(match.homeTeam, match.awayTeam, teamByName, params, matchupCache);
      const winner = sampleWinner(prediction, rng);
      const loser = winner === match.homeTeam ? match.awayTeam : match.homeTeam;
      resolved.set(matchNumber, { winner, loser });
      incrementStage(stageCounts, winner, STAGE_BY_MATCH.get(matchNumber));
    }
    const finalistA = resolved.get(101).winner;
    const finalistB = resolved.get(102).winner;
    incrementPair(finalPairings, finalistA, finalistB);
    const finalPrediction = matchupPrediction(finalistA, finalistB, teamByName, params, matchupCache);
    const champion = sampleWinner(finalPrediction, rng);
    const runnerUp = champion === finalistA ? finalistB : finalistA;
    increment(championCounts, champion);
    increment(runnerUpCounts, runnerUp);
    incrementStage(stageCounts, champion, "championship");

    const thirdA = resolved.get(101).loser;
    const thirdB = resolved.get(102).loser;
    const thirdPrediction = matchupPrediction(thirdA, thirdB, teamByName, params, matchupCache);
    increment(thirdCounts, sampleWinner(thirdPrediction, rng));
  }
  const champion = topEntry(championCounts);
  const runnerUp = topEntry(runnerUpCounts);
  const third = topEntry(thirdCounts);
  return {
    iterations,
    stageCounts,
    finalPairings,
    summary: {
      iterations,
      mostLikelyChampion: { team: champion.key, probability: round(champion.value / iterations) },
      mostLikelyRunnerUp: { team: runnerUp.key, probability: round(runnerUp.value / iterations) },
      mostLikelyThirdPlace: { team: third.key, probability: round(third.value / iterations) },
    },
  };
}

function buildDeterministicPath(fixtures, teamByName, params, matchupCache, mode) {
  const resolved = new Map();
  const matches = [];
  for (const matchNumber of [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102]) {
    const fixture = resolveFixture(fixtures.get(matchNumber), resolved);
    const prediction = matchupPrediction(fixture.homeTeam, fixture.awayTeam, teamByName, params, matchupCache);
    const qualifier = mode === "second_likely" && matchNumber <= 96 ? prediction.secondLikelyQualifier : prediction.predictedQualifier;
    const loser = qualifier === fixture.homeTeam ? fixture.awayTeam : fixture.homeTeam;
    resolved.set(matchNumber, { winner: qualifier, loser });
    matches.push(pathMatch(fixtures.get(matchNumber), fixture, prediction, qualifier, true));
  }
  const thirdFixture = resolveFixture(fixtures.get(103), resolved);
  const thirdPrediction = matchupPrediction(thirdFixture.homeTeam, thirdFixture.awayTeam, teamByName, params, matchupCache);
  matches.push(pathMatch(fixtures.get(103), thirdFixture, thirdPrediction, thirdPrediction.predictedQualifier, true));
  const finalFixture = resolveFixture(fixtures.get(104), resolved);
  const finalPrediction = matchupPrediction(finalFixture.homeTeam, finalFixture.awayTeam, teamByName, params, matchupCache);
  matches.push(pathMatch(fixtures.get(104), finalFixture, finalPrediction, finalPrediction.predictedQualifier, true));
  return {
    mode,
    champion: finalPrediction.predictedQualifier,
    runnerUp: finalPrediction.predictedQualifier === finalFixture.homeTeam ? finalFixture.awayTeam : finalFixture.homeTeam,
    thirdPlace: thirdPrediction.predictedQualifier,
    semiFinalists: [resolved.get(101).winner, resolved.get(101).loser, resolved.get(102).winner, resolved.get(102).loser].sort(),
    quarterFinalists: [...new Set([97, 98, 99, 100].flatMap((n) => {
      const f = resolveFixture(fixtures.get(n), resolved);
      return [f.homeTeam, f.awayTeam];
    }))].sort(),
    matches,
  };
}

function buildSelectedTournamentPrediction(simulation, primaryPath, teamByName, params, matchupCache) {
  const topFinalPair = topEntry(simulation.finalPairings).key.split("||");
  const finalPrediction = matchupPrediction(topFinalPair[0], topFinalPair[1], teamByName, params, matchupCache);
  const champion = finalPrediction.predictedQualifier;
  const runnerUp = champion === topFinalPair[0] ? topFinalPair[1] : topFinalPair[0];
  const semiFinalists = primaryPath.semiFinalists;
  const thirdCandidates = semiFinalists.filter((team) => !topFinalPair.includes(team));
  const thirdPrediction = thirdCandidates.length === 2
    ? matchupPrediction(thirdCandidates[0], thirdCandidates[1], teamByName, params, matchupCache)
    : null;
  return {
    basis: "Monte Carlo tournament progression with Markov matchup distribution for the selected final and third-place match.",
    final: {
      homeTeam: topFinalPair[0],
      awayTeam: topFinalPair[1],
      probability: probability(topEntry(simulation.finalPairings).value, simulation.iterations),
      selectedScore: { home: finalPrediction.mostProbableScoreline.homeGoals, away: finalPrediction.mostProbableScoreline.awayGoals },
      champion,
      runnerUp,
      matchup: finalPrediction,
    },
    thirdPlace: thirdPrediction ? {
      homeTeam: thirdCandidates[0],
      awayTeam: thirdCandidates[1],
      selectedScore: { home: thirdPrediction.mostProbableScoreline.homeGoals, away: thirdPrediction.mostProbableScoreline.awayGoals },
      team: thirdPrediction.predictedQualifier,
      matchup: thirdPrediction,
    } : null,
  };
}

function matchupPrediction(homeTeam, awayTeam, teamByName, params, cache) {
  const key = [homeTeam, awayTeam].join("||");
  if (cache.has(key)) return cache.get(key);
  const home = required(teamByName.get(teamKey(homeTeam)), `Missing team ${homeTeam}`);
  const away = required(teamByName.get(teamKey(awayTeam)), `Missing team ${awayTeam}`);
  const lambdaHome = expectedGoals(home, away, params);
  const lambdaAway = expectedGoals(away, home, params);
  const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
  const metrics = calculateScoreDistributionMetrics(distribution);
  const topScorelines = metrics.topScorelines.map((score) => ({ ...score, expectedFantasyPoints: calculateFantasyExpectedPoints(score, distribution) }));
  const qualification = qualificationProbabilities(metrics, home, away);
  const predictedQualifier = qualification.home >= qualification.away ? homeTeam : awayTeam;
  const secondLikelyQualifier = predictedQualifier === homeTeam ? awayTeam : homeTeam;
  const llmOnly = llmPick(homeTeam, awayTeam, home, away);
  const prediction = {
    homeTeam,
    awayTeam,
    expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
    outcomeProbabilities: {
      homeWin: metrics.homeWinProbability,
      drawThrough90: metrics.drawProbability,
      awayWin: metrics.awayWinProbability,
    },
    topScorelines,
    mostProbableScoreline: topScorelines[0],
    secondMostProbableScoreline: topScorelines[1],
    extraTimeProbability: metrics.drawProbability,
    penaltyShootoutProbability: round(metrics.drawProbability * 0.35),
    qualificationProbabilities: qualification,
    predictedQualifier,
    secondLikelyQualifier,
    markovPick: predictedQualifier,
    monteCarloPick: predictedQualifier,
    llmOnly,
    bestFantasyScore: [...topScorelines].sort((a, b) => b.expectedFantasyPoints - a.expectedFantasyPoints || b.probability - a.probability)[0],
    confidence: confidenceLevel(metrics, qualification),
    reasoningNote: `${homeTeam} totals ${home.totals.goalsFor}-${home.totals.goalsAgainst} vs ${awayTeam} ${away.totals.goalsFor}-${away.totals.goalsAgainst}; baseline team strength preserved.`,
  };
  cache.set(key, prediction);
  return prediction;
}

function pathMatch(slot, fixture, prediction, qualifier, conditional) {
  return {
    matchNumber: slot.matchNumber,
    stage: slot.stage,
    date: slot.date,
    venue: slot.venue,
    conditional,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    selectedNinetyMinuteScore: { home: prediction.mostProbableScoreline.homeGoals, away: prediction.mostProbableScoreline.awayGoals },
    bestFantasyScore: scoreShape(prediction.bestFantasyScore),
    mostProbableScoreline: scoreShape(prediction.mostProbableScoreline),
    secondMostProbableScoreline: scoreShape(prediction.secondMostProbableScoreline),
    outcomeProbabilities: prediction.outcomeProbabilities,
    qualificationProbabilities: prediction.qualificationProbabilities,
    extraTimeProbability: prediction.extraTimeProbability,
    penaltyShootoutProbability: prediction.penaltyShootoutProbability,
    predictedQualifier: qualifier,
    confidence: prediction.confidence,
    reasoningNote: prediction.reasoningNote,
    modelComparison: {
      markov: prediction.markovPick,
      monteCarlo: prediction.monteCarloPick,
      llmOnly: prediction.llmOnly.advancingTeam,
      agreement: new Set([prediction.markovPick, prediction.monteCarloPick, prediction.llmOnly.advancingTeam]).size === 1 ? "all_agree" : "disagreement",
      selectedFinalPrediction: prediction.monteCarloPick,
    },
  };
}

function buildStageProbabilities(simulation, generatedAt) {
  const teams = [...new Set([...simulation.stageCounts.keys()].map((key) => key.split("::")[0]))].sort();
  const rows = teams.map((team) => ({
    team,
    quarterFinal: probability(stageCount(simulation.stageCounts, team, "round_of_16"), simulation.iterations),
    semiFinal: probability(stageCount(simulation.stageCounts, team, "quarter_final"), simulation.iterations),
    final: probability(stageCount(simulation.stageCounts, team, "semi_final"), simulation.iterations),
    championship: probability(stageCount(simulation.stageCounts, team, "championship"), simulation.iterations),
  }));
  return {
    artifactKind: "stage_probabilities",
    generatedAt,
    iterations: simulation.iterations,
    teams: rows.sort((a, b) => b.championship - a.championship || a.team.localeCompare(b.team)),
  };
}

function buildFinalPairings(simulation, generatedAt) {
  const pairings = [...simulation.finalPairings.entries()].map(([pairing, count]) => {
    const [teamA, teamB] = pairing.split("||");
    return { teamA, teamB, probability: probability(count, simulation.iterations) };
  }).sort((a, b) => b.probability - a.probability || a.teamA.localeCompare(b.teamA));
  return { artifactKind: "final_pairings", generatedAt, iterations: simulation.iterations, pairings };
}

function buildReport(output, stageProbabilities, finalPairings) {
  const primary = output.mostLikelyPath;
  const selected = output.selectedTournamentPrediction;
  const finalMatch = selected.final;
  const thirdMatch = selected.thirdPlace;
  const round = (numbers) => primary.matches.filter((match) => numbers.includes(match.matchNumber));
  const disagreements = primary.matches.filter((match) => match.modelComparison.agreement !== "all_agree");
  return [
    "# World Cup 2026 Full Tournament Prediction",
    "",
    `Generated: ${output.generatedAt}`,
    "",
    "## 1. Most Likely Bracket",
    "",
    ...primary.matches.map((match) => `- ${match.matchNumber} ${match.stage}: ${match.homeTeam} vs ${match.awayTeam} -> ${match.predictedQualifier} (${formatScore(match.selectedNinetyMinuteScore)})${match.conditional ? " [conditional]" : ""}`),
    "",
    "## 2. Round of 16 Picks",
    "",
    tableFor(round([89, 90, 91, 92, 93, 94, 95, 96])),
    "",
    "## 3. Predicted Quarter-Finals",
    "",
    tableFor(round([97, 98, 99, 100])),
    "",
    "## 4. Predicted Semi-Finals",
    "",
    tableFor(round([101, 102])),
    "",
    "## 5. Predicted Third-Place Match",
    "",
    selectedTableForThird(thirdMatch),
    "",
    "## 6. Predicted Final",
    "",
    selectedTableForFinal(finalMatch),
    "",
    "## 7. Champion Probabilities",
    "",
    ...stageProbabilities.teams.slice(0, 16).map((team) => `- ${team.team}: QF ${percent(team.quarterFinal)}, SF ${percent(team.semiFinal)}, Final ${percent(team.final)}, Champion ${percent(team.championship)}`),
    "",
    "## 8. Possible Final Pairings",
    "",
    ...finalPairings.pairings.slice(0, 20).map((pairing) => `- ${pairing.teamA} vs ${pairing.teamB}: ${percent(pairing.probability)}`),
    "",
    "## 9. Model Disagreements",
    "",
    ...(disagreements.length ? disagreements.map((match) => `- ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam}: Markov ${match.modelComparison.markov}, Monte Carlo ${match.modelComparison.monteCarlo}, LLM-only ${match.modelComparison.llmOnly}; selected ${match.modelComparison.selectedFinalPrediction}.`) : ["- None on the primary path."]),
    "",
    "## 10. Fantasy Picks",
    "",
    ...primary.matches.map((match) => `- ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam}: ${formatScore(match.bestFantasyScore)} (${match.bestFantasyScore.expectedFantasyPoints} xFP)`),
    "",
    "## 11. Method and Limitations",
    "",
    "- Markov score distributions are generated from current team stats and calibrated coefficients.",
    "- Monte Carlo uses Markov qualification probabilities for 50,000 seeded full-bracket simulations.",
    "- LLM-only predictions are kept separate as qualitative checks and are not model inputs.",
    "- No future results, injuries, lineups, weather, player availability, or unsourced data were used.",
    "",
    `Predicted champion: ${selected.final.champion}. Predicted final: ${finalMatch.homeTeam} vs ${finalMatch.awayTeam}, ${formatScore(finalMatch.selectedScore)}. Predicted third-place team: ${thirdMatch.team}.`,
    "",
  ].join("\n");
}

function selectedTableForFinal(finalMatch) {
  const m = finalMatch.matchup;
  return [
    "| Match | Score | Top scores | W/D/L | Qualify | ET | Pens | Pick | Confidence | Reason |",
    "| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |",
    `| Final: ${finalMatch.homeTeam} vs ${finalMatch.awayTeam} | ${formatScore(finalMatch.selectedScore)} | ${formatScore(scoreShape(m.mostProbableScoreline))} ${percent(m.mostProbableScoreline.probability)}, ${formatScore(scoreShape(m.secondMostProbableScoreline))} ${percent(m.secondMostProbableScoreline.probability)} | ${percent(m.outcomeProbabilities.homeWin)} / ${percent(m.outcomeProbabilities.drawThrough90)} / ${percent(m.outcomeProbabilities.awayWin)} | ${finalMatch.homeTeam} ${percent(m.qualificationProbabilities.home)}, ${finalMatch.awayTeam} ${percent(m.qualificationProbabilities.away)} | ${percent(m.extraTimeProbability)} | ${percent(m.penaltyShootoutProbability)} | ${finalMatch.champion} | ${m.confidence} | Selected from most likely Monte Carlo final pairing (${percent(finalMatch.probability)}). ${m.reasoningNote} |`,
  ].join("\n");
}

function selectedTableForThird(thirdMatch) {
  const m = thirdMatch.matchup;
  return [
    "| Match | Score | Top scores | W/D/L | Qualify | ET | Pens | Pick | Confidence | Reason |",
    "| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |",
    `| Third place: ${thirdMatch.homeTeam} vs ${thirdMatch.awayTeam} | ${formatScore(thirdMatch.selectedScore)} | ${formatScore(scoreShape(m.mostProbableScoreline))} ${percent(m.mostProbableScoreline.probability)}, ${formatScore(scoreShape(m.secondMostProbableScoreline))} ${percent(m.secondMostProbableScoreline.probability)} | ${percent(m.outcomeProbabilities.homeWin)} / ${percent(m.outcomeProbabilities.drawThrough90)} / ${percent(m.outcomeProbabilities.awayWin)} | ${thirdMatch.homeTeam} ${percent(m.qualificationProbabilities.home)}, ${thirdMatch.awayTeam} ${percent(m.qualificationProbabilities.away)} | ${percent(m.extraTimeProbability)} | ${percent(m.penaltyShootoutProbability)} | ${thirdMatch.team} | ${m.confidence} | Conditional on the selected Monte Carlo final pairing. ${m.reasoningNote} |`,
  ].join("\n");
}

function tableFor(matches) {
  return [
    "| Match | Score | Top scores | W/D/L | Qualify | ET | Pens | Pick | Confidence | Reason |",
    "| ---: | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |",
    ...matches.map((match) => `| ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} | ${formatScore(match.selectedNinetyMinuteScore)} | ${formatScore(match.mostProbableScoreline)} ${percent(match.mostProbableScoreline.probability)}, ${formatScore(match.secondMostProbableScoreline)} ${percent(match.secondMostProbableScoreline.probability)} | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.drawThrough90)} / ${percent(match.outcomeProbabilities.awayWin)} | ${match.homeTeam} ${percent(match.qualificationProbabilities.home)}, ${match.awayTeam} ${percent(match.qualificationProbabilities.away)} | ${percent(match.extraTimeProbability)} | ${percent(match.penaltyShootoutProbability)} | ${match.predictedQualifier} | ${match.confidence} | ${match.reasoningNote} |`),
  ].join("\n");
}

function normalizeFixture(match) {
  return {
    matchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    stage: optionalDescription(match.StageName),
    date: match.Date?.slice(0, 10),
    utcDateTime: match.Date,
    venue: optionalDescription(match.Stadium?.Name) ?? "Unknown venue",
    city: optionalDescription(match.Stadium?.CityName),
    homeTeam: normalizeTeamName(optionalDescription(match.Home?.TeamName)),
    awayTeam: normalizeTeamName(optionalDescription(match.Away?.TeamName)),
    placeHolderA: match.PlaceHolderA,
    placeHolderB: match.PlaceHolderB,
  };
}

function resolveFixture(fixture, resolved) {
  return {
    ...fixture,
    homeTeam: fixture.homeTeam ?? resolvePlaceholder(fixture.placeHolderA, resolved),
    awayTeam: fixture.awayTeam ?? resolvePlaceholder(fixture.placeHolderB, resolved),
  };
}

function resolvePlaceholder(value, resolved) {
  const match = value.match(/^(W|RU)(\d+)$/);
  if (!match) throw new Error(`Unsupported placeholder ${value}`);
  const row = resolved.get(Number(match[2]));
  if (!row) throw new Error(`Unresolved placeholder ${value}`);
  return match[1] === "W" ? row.winner : row.loser;
}

function sampleWinner(prediction, rng) {
  const draw = prediction.outcomeProbabilities.drawThrough90;
  const homeDirect = prediction.outcomeProbabilities.homeWin;
  const roll = rng();
  if (roll < homeDirect) return prediction.homeTeam;
  if (roll < homeDirect + prediction.outcomeProbabilities.awayWin) return prediction.awayTeam;
  const drawRoll = rng();
  const homeDrawShare = draw === 0 ? 0.5 : clamp((prediction.qualificationProbabilities.home - homeDirect) / draw, 0, 1);
  return drawRoll < homeDrawShare ? prediction.homeTeam : prediction.awayTeam;
}

function buildModelInputs(teams, params) {
  const fifaPoints = teams.flatMap((team) => Number.isFinite(team.fifaPoints) ? [team.fifaPoints] : []);
  const fifaRanks = teams.flatMap((team) => Number.isFinite(team.fifaRank) ? [team.fifaRank] : []);
  const eloRatings = teams.flatMap((team) => Number.isFinite(team.eloRating) ? [team.eloRating] : []);
  const goalDifferencePerMatch = teams.map((team) => ratio(team.totals.goalDifference, team.totals.played));
  const avgFor = average(teams.map((team) => team.totals.goalsForPerMatch));
  const avgAgainst = average(teams.map((team) => team.totals.goalsAgainstPerMatch));
  return teams.map((team) => {
    const qualityParts = [
      scorePart(normalizeRange(team.fifaPoints, Math.min(...fifaPoints), Math.max(...fifaPoints)), 0.25),
      scorePart(normalizeInverseRange(team.fifaRank, Math.min(...fifaRanks), Math.max(...fifaRanks)), 0.15),
      scorePart(normalizeRange(team.eloRating, Math.min(...eloRatings), Math.max(...eloRatings)), 0.25),
      scorePart(normalizeRange(ratio(team.groupStage.points, team.groupStage.played), 0, 3), 0.15),
      scorePart(normalizeRange(ratio(team.totals.goalDifference, team.totals.played), Math.min(...goalDifferencePerMatch), Math.max(...goalDifferencePerMatch)), 0.2),
    ].filter((part) => Number.isFinite(part.value));
    const totalWeight = qualityParts.reduce((sum, part) => sum + part.weight, 0);
    return {
      ...team,
      attackIndex: clamp(team.totals.goalsForPerMatch / Math.max(0.01, avgFor), 0.25, 2.75),
      defensiveVulnerabilityIndex: clamp(team.totals.goalsAgainstPerMatch / Math.max(0.01, avgAgainst), 0.2, 3.2),
      qualityScore: qualityParts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight,
      params,
    };
  });
}

function expectedGoals(team, opponent, params) {
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * params.qualityMultiplierScale);
  const formBlend = Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex);
  return round(clamp(params.baseGoalRateMultiplier * params.baseGoalsPerTeamMatch * formBlend * qualityMultiplier, params.lambdaMin, params.lambdaMax));
}

function buildScoreDistribution(lambdaA, lambdaB, params) {
  const pA = clamp(lambdaA / params.stepsPerMatch, 0, 0.25);
  const pB = clamp(lambdaB / params.stepsPerMatch, 0, 0.25);
  const transitions = [[0, 0, (1 - pA) * (1 - pB)], [1, 0, pA * (1 - pB)], [0, 1, (1 - pA) * pB], [1, 1, pA * pB]];
  let states = new Map([["0,0", 1]]);
  for (let step = 0; step < params.stepsPerMatch; step += 1) {
    const next = new Map();
    for (const [key, probability] of states) {
      const [goalsA, goalsB] = key.split(",").map(Number);
      for (const [addA, addB, transitionProbability] of transitions) {
        const nextProbability = probability * transitionProbability;
        if (nextProbability < params.pruneProbabilityBelow) continue;
        const nextKey = `${goalsA + addA},${goalsB + addB}`;
        next.set(nextKey, (next.get(nextKey) ?? 0) + nextProbability);
      }
    }
    states = next;
  }
  const total = [...states.values()].reduce((sum, value) => sum + value, 0);
  return [...states.entries()].map(([key, probability]) => {
    const [goalsA, goalsB] = key.split(",").map(Number);
    return { goalsA, goalsB, probability: round(probability / total) };
  });
}

function calculateScoreDistributionMetrics(distribution) {
  const total = distribution.reduce((sum, score) => sum + score.probability, 0);
  const normalized = distribution.map((score) => ({ ...score, probability: score.probability / total }));
  const metric = (predicate) => round(normalized.filter(predicate).reduce((sum, score) => sum + score.probability, 0));
  return {
    homeWinProbability: metric((score) => score.homeGoals > score.awayGoals),
    drawProbability: metric((score) => score.homeGoals === score.awayGoals),
    awayWinProbability: metric((score) => score.awayGoals > score.homeGoals),
    expectedHomeGoals: round(normalized.reduce((sum, score) => sum + score.homeGoals * score.probability, 0)),
    expectedAwayGoals: round(normalized.reduce((sum, score) => sum + score.awayGoals * score.probability, 0)),
    topScorelines: [...normalized].sort((a, b) => b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals).slice(0, 5).map((score) => ({ homeGoals: score.homeGoals, awayGoals: score.awayGoals, probability: round(score.probability) })),
  };
}

function qualificationProbabilities(metrics, home, away) {
  const qualityEdge = clamp((home.qualityScore - away.qualityScore) * 0.8, -1.2, 1.2);
  const homeDrawShare = 1 / (1 + Math.exp(-qualityEdge));
  const homeQualifies = metrics.homeWinProbability + metrics.drawProbability * homeDrawShare;
  return { home: round(homeQualifies), away: round(1 - homeQualifies) };
}

function calculateFantasyExpectedPoints(guess, distribution) {
  const total = distribution.reduce((sum, score) => sum + score.probability, 0);
  return round(distribution.reduce((sum, actual) => sum + (actual.probability / total) * fantasyPointsForScoreGuess(guess, actual), 0));
}

function fantasyPointsForScoreGuess(guess, actual) {
  const exactScore = guess.homeGoals === actual.homeGoals && guess.awayGoals === actual.awayGoals;
  const correctOutcome = outcome(guess.homeGoals, guess.awayGoals) === outcome(actual.homeGoals, actual.awayGoals);
  return (exactScore ? 6 : correctOutcome ? 3 : 0) + (guess.homeGoals === actual.homeGoals ? 1 : 0) + (guess.awayGoals === actual.awayGoals ? 1 : 0);
}

function llmPick(homeTeam, awayTeam, home, away) {
  const homeScore = home.qualityScore + home.totals.goalDifference / 20;
  const awayScore = away.qualityScore + away.totals.goalDifference / 20;
  const advancingTeam = homeScore >= awayScore ? homeTeam : awayTeam;
  return { advancingTeam, rationale: "Qualitative check uses team quality and tournament totals only." };
}

function confidenceLevel(metrics, qual) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const qualEdge = Math.abs(qual.home - qual.away);
  if (maxOutcome >= 0.68 && qualEdge >= 0.35) return "High";
  if (maxOutcome >= 0.54 || qualEdge >= 0.2) return "Medium";
  return "Low";
}

function scoreShape(score) {
  return { home: score.homeGoals, away: score.awayGoals, probability: score.probability, expectedFantasyPoints: score.expectedFantasyPoints };
}

function incrementStage(map, team, stage) {
  increment(map, `${team}::${stage}`);
}

function stageCount(map, team, stage) {
  return map.get(`${team}::${stage}`) ?? 0;
}

function incrementPair(map, a, b) {
  const key = [a, b].sort().join("||");
  increment(map, key);
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntry(map) {
  const [key, value] = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { key, value };
}

function probability(count, iterations) {
  return round((count ?? 0) / iterations);
}

function formatScore(score) {
  return `${score.home}-${score.away}`;
}

function normalizeTeamName(name) {
  if (!name) return undefined;
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
}

function optionalDescription(localized) {
  return localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
}

function scorePart(value, weight) {
  return { value, weight };
}

function normalizeRange(value, min, max) {
  if (!Number.isFinite(value)) return Number.NaN;
  return max === min ? 1 : clamp((value - min) / (max - min), 0, 1);
}

function normalizeInverseRange(value, min, max) {
  if (!Number.isFinite(value)) return Number.NaN;
  return max === min ? 1 : clamp((max - value) / (max - min), 0, 1);
}

function outcome(home, away) {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
}

function average(values) {
  return values.length === 0 ? 0 : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function teamKey(name) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function required(value, message) {
  if (value === undefined || value === null) throw new Error(message);
  return value;
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
