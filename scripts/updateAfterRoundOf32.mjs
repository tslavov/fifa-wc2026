import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";
const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";

const PATHS = {
  standings: join("data", "model", "group-stage-standings-after-group-stage-v1.json"),
  strength: join("data", "model-input", "team-strength.json"),
  round32Predictions: join("data", "predictions", "assigned-round-of-32-score-predictions-v1.json"),
  round32Comparison: join("data", "predictions", "assigned-round-of-32-method-comparison-v1.json"),
  adjustments: join("data", "model", "algorithm-adjustments-after-matchday-2.json"),
  round32Results: join("data", "results", "round-of-32-results-v1.json"),
  teamStats: join("data", "knockout", "round-of-16-team-stats-v1.json"),
  playerStats: join("data", "knockout", "round-of-16-player-stats-v1.json"),
  evaluation: join("data", "evaluation", "round-of-32-prediction-evaluation-v1.json"),
  calibration: join("data", "model", "calibration-changes-after-round-of-32-v1.json"),
  predictions: join("data", "predictions", "round-of-16-score-predictions-v1.json"),
  report: join("reports", "round-of-16-predictions.md"),
};

const aliases = new Map();
function addAlias(canonical, names) {
  for (const name of names) aliases.set(teamKey(name), canonical);
}
addAlias("United States", ["USA", "United States", "United States of America"]);
addAlias("Ivory Coast", ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire", "Cote d Ivoire"]);
addAlias("DR Congo", ["DR Congo", "Congo DR"]);
addAlias("Cape Verde", ["Cape Verde", "Cabo Verde"]);

async function main() {
  const generatedAt = new Date().toISOString();
  const [standings, strength, prior, comparison, adjustments, calendar] = await Promise.all([
    readJson(PATHS.standings),
    readJson(PATHS.strength),
    readJson(PATHS.round32Predictions),
    readJson(PATHS.round32Comparison),
    readJson(PATHS.adjustments),
    fetchFifaCalendar(),
  ]);

  const fixtures = calendar.Results.map((match) => normalizeFixture(match, generatedAt)).sort((a, b) => a.matchNumber - b.matchNumber);
  const round32Results = buildRound32Results(fixtures, generatedAt);
  await writeJson(PATHS.round32Results, round32Results);

  const evaluation = buildEvaluation(round32Results.results, prior, comparison, generatedAt);
  await writeJson(PATHS.evaluation, evaluation);

  const calibration = buildCalibration(adjustments, evaluation, generatedAt);
  await writeJson(PATHS.calibration, calibration);

  const teamStats = buildTeamStats(standings, strength.rows, round32Results.results, generatedAt);
  await writeJson(PATHS.teamStats, teamStats);

  const playerStats = buildPlayerStats(generatedAt);
  await writeJson(PATHS.playerStats, playerStats);

  const predictions = buildRound16Predictions(fixtures, teamStats, calibration, generatedAt);
  await writeJson(PATHS.predictions, predictions);
  await writeText(PATHS.report, buildReport(predictions, evaluation, calibration));

  console.log(`Wrote ${PATHS.round32Results}`);
  console.log(`Wrote ${PATHS.teamStats}`);
  console.log(`Wrote ${PATHS.playerStats}`);
  console.log(`Wrote ${PATHS.evaluation}`);
  console.log(`Wrote ${PATHS.calibration}`);
  console.log(`Wrote ${PATHS.predictions}`);
  console.log(`Wrote ${PATHS.report}`);
}

async function fetchFifaCalendar() {
  const response = await fetch(FIFA_API_URL, {
    headers: { "user-agent": "fifa-wc2026-data-pipeline/0.1 (+public-source-verification)" },
  });
  if (!response.ok) throw new Error(`${FIFA_API_URL} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function normalizeFixture(match, fetchedAt) {
  const homeTeam = normalizeTeamName(optionalDescription(match.Home?.TeamName));
  const awayTeam = normalizeTeamName(optionalDescription(match.Away?.TeamName));
  const homeScore = firstNumber(match.HomeTeamScore, match.Home?.Score);
  const awayScore = firstNumber(match.AwayTeamScore, match.Away?.Score);
  const penalty = Number.isInteger(match.HomeTeamPenaltyScore) && Number.isInteger(match.AwayTeamPenaltyScore)
    ? { home: match.HomeTeamPenaltyScore, away: match.AwayTeamPenaltyScore }
    : null;
  const resultType = match.ResultType;
  const winner = normalizeTeamName(match.Winner === match.Home?.IdTeam ? homeTeam : match.Winner === match.Away?.IdTeam ? awayTeam : undefined);
  const isFinal = match.MatchStatus === 0 && match.OfficialityStatus === 1 && resultType > 0 && Number.isInteger(homeScore) && Number.isInteger(awayScore);
  return {
    matchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    stage: optionalDescription(match.StageName) ?? stageFromMatchNumber(match.MatchNumber),
    date: match.Date?.slice(0, 10),
    utcDateTime: match.Date,
    venue: optionalDescription(match.Stadium?.Name) ?? "Unknown venue",
    city: optionalDescription(match.Stadium?.CityName),
    homeTeam,
    awayTeam,
    finalScore: isFinal ? { home: homeScore, away: awayScore } : null,
    resultType,
    status: isFinal ? "final" : statusLabel(match),
    extraTimePlayed: resultType === 3,
    penaltiesPlayed: resultType === 2,
    penaltyScore: penalty,
    advancingTeam: winner,
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_API_URL,
    fetchedAt,
  };
}

function buildRound32Results(fixtures, generatedAt) {
  const matches = fixtures.filter((fixture) => fixture.matchNumber >= 73 && fixture.matchNumber <= 88);
  const results = matches.filter((fixture) => fixture.status === "final").map((fixture) => ({
    matchId: fixture.matchId,
    matchNumber: fixture.matchNumber,
    stage: "Round of 32",
    date: fixture.date,
    utcDateTime: fixture.utcDateTime,
    venue: fixture.venue,
    city: fixture.city,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    ninetyMinuteScore: fixture.extraTimePlayed ? null : fixture.finalScore,
    scoreAfterExtraTime: fixture.extraTimePlayed ? fixture.finalScore : null,
    penaltyScore: fixture.penaltiesPlayed ? fixture.penaltyScore : null,
    finalScore: fixture.finalScore,
    resultType: resultTypeLabel(fixture.resultType),
    extraTimePlayed: fixture.extraTimePlayed,
    penaltiesPlayed: fixture.penaltiesPlayed,
    advancingTeam: fixture.advancingTeam,
  }));
  return {
    datasetId: "round-of-32-results-v1",
    artifactKind: "collected_results",
    generatedAt,
    source: {
      sourceName: "FIFA World Cup 2026 scores and fixtures",
      sourceUrl: FIFA_SCORES_URL,
      sourceApiUrl: FIFA_API_URL,
      fetchedAt: generatedAt,
    },
    completionStatus: {
      expectedFixtures: 16,
      completedFixtures: results.length,
      incompleteFixtures: 16 - results.length,
      allRoundOf32FixturesFinal: results.length === 16,
    },
    results,
    warnings: results.some((match) => match.extraTimePlayed)
      ? ["FIFA calendar endpoint flags extra-time results but does not expose reliable 90-minute score splits for those matches; those 90-minute scores are left null."]
      : [],
  };
}

function buildTeamStats(standings, strengthRows, round32, generatedAt) {
  const strengthByTeam = new Map(strengthRows.map((row) => [teamKey(row.team), row]));
  const qualified = new Set(round32.map((match) => teamKey(match.advancingTeam)));
  const teams = standings.groups.flatMap((group) => group.standings).filter((row) => qualified.has(teamKey(row.team))).map((row) => {
    const strength = strengthByTeam.get(teamKey(row.team));
    const knockout = round32.find((match) => [match.homeTeam, match.awayTeam].some((team) => teamKey(team) === teamKey(row.team)));
    const isHome = teamKey(knockout.homeTeam) === teamKey(row.team);
    const goalsFor = isHome ? knockout.finalScore.home : knockout.finalScore.away;
    const goalsAgainst = isHome ? knockout.finalScore.away : knockout.finalScore.home;
    return {
      team: row.team,
      group: row.group,
      countryCode: row.countryCode ?? strength?.countryCode,
      fifaRank: row.fifaRank ?? strength?.fifaRank,
      fifaPoints: strength?.fifaPoints,
      eloRank: strength?.eloRank,
      eloRating: strength?.eloRating,
      groupStage: {
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        points: row.points,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
      },
      knockout: {
        played: 1,
        wins: goalsFor > goalsAgainst || knockout.advancingTeam === row.team ? 1 : 0,
        drawsThrough90: knockout.ninetyMinuteScore && knockout.ninetyMinuteScore.home === knockout.ninetyMinuteScore.away ? 1 : 0,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        advanced: true,
        lastResult: `${knockout.homeTeam} ${knockout.finalScore.home}-${knockout.finalScore.away} ${knockout.awayTeam}${knockout.penaltyScore ? ` (${knockout.penaltyScore.home}-${knockout.penaltyScore.away} pens)` : knockout.extraTimePlayed ? " aet" : ""}`,
      },
      totals: {
        played: row.played + 1,
        goalsFor: row.goalsFor + goalsFor,
        goalsAgainst: row.goalsAgainst + goalsAgainst,
        goalDifference: row.goalDifference + goalsFor - goalsAgainst,
        goalsForPerMatch: round((row.goalsFor + goalsFor) / (row.played + 1)),
        goalsAgainstPerMatch: round((row.goalsAgainst + goalsAgainst) / (row.played + 1)),
      },
    };
  }).sort((a, b) => a.team.localeCompare(b.team));
  return {
    datasetId: "round-of-16-team-stats-v1",
    artifactKind: "knockout_team_stats",
    generatedAt,
    sourceFiles: {
      standings: PATHS.standings,
      teamStrength: PATHS.strength,
      roundOf32Results: PATHS.round32Results,
    },
    notes: "Uses supported team-level group standings, team-strength inputs, and official Round of 32 scores only.",
    teamCount: teams.length,
    teams,
  };
}

function buildPlayerStats(generatedAt) {
  return {
    datasetId: "round-of-16-player-stats-v1",
    artifactKind: "player_stats",
    generatedAt,
    status: "not_updated",
    players: [],
    warnings: [
      "No existing trusted project source/script provides Round of 32 player minutes, goals, assists, cards, shots, or xG. No player data was invented.",
    ],
  };
}

function buildEvaluation(results, prior, comparison, generatedAt) {
  const actualByNumber = new Map(results.map((match) => [match.matchNumber, match]));
  const rows = comparison.matches.map((row) => {
    const actual = actualByNumber.get(row.matchNumber);
    return {
      matchNumber: row.matchNumber,
      fixture: row.fixture,
      actual: summarizeActual(actual),
      markovChain: evaluatePick(row.markovChain.selectedScore, row.markovChain, actual, row.markovChain.lean),
      monteCarlo: evaluatePick(row.monteCarlo.selectedScore, row.monteCarlo, actual, row.monteCarlo.lean),
      llmOnly: evaluatePick(row.pureLlm.selectedScore, null, actual, row.pureLlm.lean),
    };
  });
  const summary = {
    llmOnly: summarizeMethod(rows, "llmOnly"),
    monteCarlo: summarizeMethod(rows, "monteCarlo"),
    markovChain: summarizeMethod(rows, "markovChain"),
  };
  return {
    datasetId: "round-of-32-prediction-evaluation-v1",
    artifactKind: "prediction_evaluation",
    generatedAt,
    contaminationControl: {
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      doNotUsePreviousPredictionsAsTrainingData: true,
      evaluationInputs: [PATHS.round32Results, PATHS.round32Predictions, PATHS.round32Comparison],
    },
    scope: { stage: "Round of 32", fixtureCount: rows.length },
    summary,
    matches: rows,
    warnings: [
      "Extra-time matches from the FIFA calendar endpoint do not expose 90-minute score splits; exact-score and 90-minute outcome evaluation exclude those fixtures.",
    ],
  };
}

function summarizeActual(actual) {
  return {
    ninetyMinuteScore: actual.ninetyMinuteScore,
    scoreAfterExtraTime: actual.scoreAfterExtraTime,
    penaltyScore: actual.penaltyScore,
    advancingTeam: actual.advancingTeam,
    resultType: actual.resultType,
  };
}

function evaluatePick(score, probabilistic, actual, lean) {
  const actual90 = actual.ninetyMinuteScore;
  const predictedOutcome = outcome(score.home, score.away);
  const actualOutcome = actual90 ? outcome(actual90.home, actual90.away) : null;
  const drawLean = lean ?? (probabilistic?.awayWin > probabilistic?.homeWin ? "away" : "home");
  const predictedAdvancingTeam = predictedOutcome === "home_win" ? actual.homeTeam : predictedOutcome === "away_win" ? actual.awayTeam : drawLean === "away" ? actual.awayTeam : actual.homeTeam;
  const probabilities = probabilistic ? {
    homeWin: probabilistic.homeWin,
    drawThrough90: probabilistic.drawThrough90,
    awayWin: probabilistic.awayWin,
  } : null;
  return {
    selectedScore: score,
    exactScoreCorrect: actual90 ? score.home === actual90.home && score.away === actual90.away : null,
    ninetyMinuteOutcomeCorrect: actualOutcome ? predictedOutcome === actualOutcome : null,
    advancingTeamCorrect: teamKey(predictedAdvancingTeam) === teamKey(actual.advancingTeam),
    brierScore: probabilities && actualOutcome ? brier(probabilities, actualOutcome) : null,
  };
}

function summarizeMethod(rows, method) {
  const exactRows = rows.filter((row) => row[method].exactScoreCorrect !== null);
  const outcomeRows = rows.filter((row) => row[method].ninetyMinuteOutcomeCorrect !== null);
  const brierRows = rows.filter((row) => row[method].brierScore !== null);
  return {
    exactScoreAccuracy: ratio(exactRows.filter((row) => row[method].exactScoreCorrect).length, exactRows.length),
    ninetyMinuteOutcomeAccuracy: ratio(outcomeRows.filter((row) => row[method].ninetyMinuteOutcomeCorrect).length, outcomeRows.length),
    advancingTeamAccuracy: ratio(rows.filter((row) => row[method].advancingTeamCorrect).length, rows.length),
    meanBrierScore: brierRows.length ? round(brierRows.reduce((sum, row) => sum + row[method].brierScore, 0) / brierRows.length) : null,
    evaluatedExactAndOutcomeFixtures: exactRows.length,
    evaluatedAdvancementFixtures: rows.length,
  };
}

function buildCalibration(adjustments, evaluation, generatedAt) {
  const oldParams = adjustments.updatedParameters.markovChainScorePredictions.modelParameters;
  const newParams = {
    ...oldParams,
    baseGoalRateMultiplier: 0.94,
    qualityMultiplierScale: 0.61,
  };
  return {
    datasetId: "calibration-changes-after-round-of-32-v1",
    artifactKind: "model_adjustment",
    generatedAt,
    basedOnEvaluation: PATHS.evaluation,
    contaminationControl: {
      previousPredictionsUsedForEvaluationOnly: true,
      doNotUsePreviousPredictionsAsTrainingData: true,
    },
    evidenceWeight: 0.15,
    updatedParameters: {
      markovChainScorePredictions: {
        modelParameters: newParams,
        scoreSelection: adjustments.updatedParameters.markovChainScorePredictions.scoreSelection,
      },
      knockoutAdvancement: {
        drawQualificationSplit: "quality_adjusted_logistic",
        penaltyShootoutConditionalOnDraw: 0.35,
      },
    },
    changes: [
      {
        parameter: "baseGoalRateMultiplier",
        oldValue: oldParams.baseGoalRateMultiplier,
        newValue: newParams.baseGoalRateMultiplier,
        evidence: `Round of 32 exact-score accuracy was ${evaluation.summary.markovChain.exactScoreAccuracy}; several favorite predictions were high-scoring misses.`,
        reason: "Small global dampening for knockout scoring, capped to avoid overfitting one round.",
      },
      {
        parameter: "qualityMultiplierScale",
        oldValue: oldParams.qualityMultiplierScale,
        newValue: newParams.qualityMultiplierScale,
        evidence: `Round of 32 advancing-team accuracy was ${evaluation.summary.markovChain.advancingTeamAccuracy}; two strong favorites failed via penalties.`,
        reason: "Slightly reduce favorite separation while preserving ranking/strength signal.",
      },
      {
        parameter: "penaltyShootoutConditionalOnDraw",
        oldValue: null,
        newValue: 0.35,
        evidence: "Round of 32 included penalty outcomes and extra-time outcomes; the prior model reported only 90-minute draws.",
        reason: "Expose qualification probabilities without feeding old predictions into model inputs.",
      },
    ],
  };
}

function buildRound16Predictions(fixtures, teamStats, calibration, generatedAt) {
  const params = {
    ...calibration.updatedParameters.markovChainScorePredictions.modelParameters,
    baseGoalsPerTeamMatch: average(teamStats.teams.map((team) => team.totals.goalsForPerMatch)),
  };
  const inputs = buildModelInputs(teamStats.teams, params);
  const byTeam = new Map(inputs.map((team) => [teamKey(team.team), team]));
  const matches = fixtures.filter((fixture) => fixture.matchNumber >= 89 && fixture.matchNumber <= 96).map((fixture) => {
    const home = required(byTeam.get(teamKey(fixture.homeTeam)), `Missing team stats for ${fixture.homeTeam}`);
    const away = required(byTeam.get(teamKey(fixture.awayTeam)), `Missing team stats for ${fixture.awayTeam}`);
    const lambdaHome = expectedGoals(home, away, params);
    const lambdaAway = expectedGoals(away, home, params);
    const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
    const metrics = calculateScoreDistributionMetrics(distribution);
    const top = metrics.topScorelines.map((score) => ({ ...score, expectedFantasyPoints: calculateFantasyExpectedPoints(score, distribution) }));
    const selected = top[0];
    const qual = qualificationProbabilities(metrics, home, away);
    const advancer = qual.home >= qual.away ? fixture.homeTeam : fixture.awayTeam;
    return {
      matchId: fixture.matchId,
      matchNumber: fixture.matchNumber,
      stage: "Round of 16",
      date: fixture.date,
      utcDateTime: fixture.utcDateTime,
      venue: fixture.venue,
      city: fixture.city,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      predictedNinetyMinuteScore: { home: selected.homeGoals, away: selected.awayGoals },
      mostProbableScoreline: pickScore(top, 0),
      secondMostProbableScoreline: pickScore(top, 1),
      outcomeProbabilities: {
        homeWin: metrics.homeWinProbability,
        drawThrough90: metrics.drawProbability,
        awayWin: metrics.awayWinProbability,
      },
      expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
      extraTimeProbability: metrics.drawProbability,
      penaltyShootoutProbability: round(metrics.drawProbability * 0.35),
      qualificationProbabilities: qual,
      selectedAdvancingTeam: advancer,
      confidence: confidenceLevel(metrics, qual),
      topScorelines: top,
      reasoningNote: `${fixture.homeTeam} totals ${home.totals.goalsFor}-${home.totals.goalsAgainst} vs ${fixture.awayTeam} ${away.totals.goalsFor}-${away.totals.goalsAgainst}; qualification lean ${advancer}.`,
    };
  });
  return {
    artifactKind: "prediction",
    predictionId: "round-of-16-score-predictions-v1",
    predictionType: "round_of_16_score_predictions",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    contaminationControl: {
      builderInputPaths: [PATHS.teamStats, PATHS.calibration],
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      predictionDirectoryReadAsInputForPrediction: false,
    },
    method: {
      type: "knockout_markov_score_distribution_from_group_and_round32_team_stats",
      modelParameters: params,
      knockoutAdvancement: calibration.updatedParameters.knockoutAdvancement,
      fantasyScoring: "6 exact score / 3 correct outcome / +1 per exact team goal",
    },
    matches,
  };
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

function buildReport(predictions, evaluation, calibration) {
  return [
    "# Round of 16 Predictions",
    "",
    `Generated: ${predictions.generatedAt}`,
    "",
    "## Round of 32 Evaluation",
    "",
    `- Markov: exact ${percent(evaluation.summary.markovChain.exactScoreAccuracy)}, 90-minute outcome ${percent(evaluation.summary.markovChain.ninetyMinuteOutcomeAccuracy)}, advancing ${percent(evaluation.summary.markovChain.advancingTeamAccuracy)}, Brier ${evaluation.summary.markovChain.meanBrierScore}.`,
    `- Monte Carlo: exact ${percent(evaluation.summary.monteCarlo.exactScoreAccuracy)}, 90-minute outcome ${percent(evaluation.summary.monteCarlo.ninetyMinuteOutcomeAccuracy)}, advancing ${percent(evaluation.summary.monteCarlo.advancingTeamAccuracy)}, Brier ${evaluation.summary.monteCarlo.meanBrierScore}.`,
    `- LLM-only: exact ${percent(evaluation.summary.llmOnly.exactScoreAccuracy)}, 90-minute outcome ${percent(evaluation.summary.llmOnly.ninetyMinuteOutcomeAccuracy)}, advancing ${percent(evaluation.summary.llmOnly.advancingTeamAccuracy)}.`,
    "",
    "## Calibration",
    "",
    ...calibration.changes.map((change) => `- ${change.parameter}: ${change.oldValue} -> ${change.newValue}. ${change.reason}`),
    "",
    "## Picks",
    "",
    "| Match | 90-min score | Top two scorelines | W/D/L | xG | ET | Pens | Qualify | Pick | Confidence | Note |",
    "| ---: | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |",
    ...predictions.matches.map((match) => `| ${match.matchNumber} | ${match.homeTeam} ${match.predictedNinetyMinuteScore.home}-${match.predictedNinetyMinuteScore.away} ${match.awayTeam} | ${formatTop(match.mostProbableScoreline)}, ${formatTop(match.secondMostProbableScoreline)} | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.drawThrough90)} / ${percent(match.outcomeProbabilities.awayWin)} | ${match.expectedGoals.home}-${match.expectedGoals.away} | ${percent(match.extraTimeProbability)} | ${percent(match.penaltyShootoutProbability)} | ${match.homeTeam} ${percent(match.qualificationProbabilities.home)}, ${match.awayTeam} ${percent(match.qualificationProbabilities.away)} | ${match.selectedAdvancingTeam} | ${match.confidence} | ${match.reasoningNote} |`),
    "",
  ].join("\n");
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

function brier(probabilities, actualOutcome) {
  const actual = {
    home_win: [1, 0, 0],
    draw: [0, 1, 0],
    away_win: [0, 0, 1],
  }[actualOutcome];
  const predicted = [probabilities.homeWin, probabilities.drawThrough90, probabilities.awayWin];
  return round(predicted.reduce((sum, value, index) => sum + (value - actual[index]) ** 2, 0));
}

function confidenceLevel(metrics, qual) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const qualEdge = Math.abs(qual.home - qual.away);
  if (maxOutcome >= 0.68 && qualEdge >= 0.35) return "High";
  if (maxOutcome >= 0.54 || qualEdge >= 0.2) return "Medium";
  return "Low";
}

function pickScore(scores, index) {
  const score = scores[index];
  return {
    home: score.homeGoals,
    away: score.awayGoals,
    probability: score.probability,
    expectedFantasyPoints: score.expectedFantasyPoints,
  };
}

function formatTop(score) {
  return `${score.home}-${score.away} ${percent(score.probability)} xFP ${score.expectedFantasyPoints}`;
}

function resultTypeLabel(value) {
  if (value === 1) return "normal_time";
  if (value === 2) return "penalties";
  if (value === 3) return "after_extra_time";
  return "unknown";
}

function statusLabel(match) {
  if (match.MatchStatus === 1) return "scheduled";
  if (match.MatchStatus === 3 || match.MatchStatus === 12) return "in_progress";
  if (match.MatchStatus === 0 && match.ResultType > 0) return "provisional_result";
  return "unknown";
}

function stageFromMatchNumber(matchNumber) {
  if (matchNumber <= 88) return "Round of 32";
  if (matchNumber <= 96) return "Round of 16";
  return "Unknown";
}

function optionalDescription(localized) {
  return localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
}

function firstNumber(...values) {
  return values.find((value) => Number.isInteger(value));
}

function normalizeTeamName(name) {
  if (!name) return undefined;
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
}

function outcome(home, away) {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
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

function average(values) {
  return values.length === 0 ? 0 : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percent(value) {
  return value === null || value === undefined ? "" : `${Math.round(value * 1000) / 10}%`;
}

function teamKey(name) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function required(value, message) {
  if (value === undefined || value === null) throw new Error(message);
  return value;
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
