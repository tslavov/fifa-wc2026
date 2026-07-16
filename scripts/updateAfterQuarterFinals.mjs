import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";
const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

const PATHS = {
  priorTeamStats: join("data", "knockout", "quarter-final-team-stats-v1.json"),
  calibration: join("data", "model", "calibration-changes-after-round-of-32-v1.json"),
  quarterFinalAdjustments: join("data", "model", "quarter-final-model-adjustments-v1.json"),
  lastMinuteContext: join("data", "context", "semi-final-last-minute-context-v1.json"),
  results: join("data", "results", "quarter-final-results-v1.json"),
  teamStats: join("data", "knockout", "semi-final-team-stats-v1.json"),
  predictions: join("data", "predictions", "remaining-knockout-score-predictions-v1.json"),
  report: join("reports", "remaining-knockout-predictions.md"),
};

const QF_NUMBERS = [97, 98, 99, 100];
const SEMI_NUMBERS = [101, 102];
const FINAL_NUMBER = 104;
const THIRD_PLACE_NUMBER = 103;
const SIMULATIONS_PER_FIXTURE = 250_000;
const BRACKET_SIMULATIONS = 250_000;
const RANDOM_SEED_BASE = 20260713;
const EXTRA_TIME_SCORING_RATE = 0.72;
const SCORE_SELECTION = {
  nearEqualRelativeBand: 0.05,
  nearEqualAbsoluteProbabilityBand: 0.03,
  higherScoreTiebreak: true,
};
const LAST_MINUTE_MULTIPLIER_MIN = 0.95;
const LAST_MINUTE_MULTIPLIER_MAX = 1.05;

const aliases = new Map([
  ["usa", "United States"],
  ["united states of america", "United States"],
]);

async function main() {
  const generatedAt = new Date().toISOString();
  const [priorTeamStats, calibration, quarterFinalAdjustments, lastMinuteContext, calendar] = await Promise.all([
    readJson(PATHS.priorTeamStats),
    readJson(PATHS.calibration),
    readJson(PATHS.quarterFinalAdjustments),
    readJsonOptional(PATHS.lastMinuteContext, null),
    fetchFifaCalendar(),
  ]);
  const fixtures = calendar.Results.map((match) => normalizeFixture(match, generatedAt)).sort((a, b) => a.matchNumber - b.matchNumber);
  const quarterFinalResults = buildQuarterFinalResults(fixtures, generatedAt);
  const teamStats = buildSemiFinalTeamStats(priorTeamStats, quarterFinalResults.results, quarterFinalAdjustments, generatedAt);
  const predictions = buildRemainingPredictions(fixtures, priorTeamStats, teamStats, calibration, quarterFinalAdjustments, quarterFinalResults, lastMinuteContext, generatedAt);

  await writeJson(PATHS.results, quarterFinalResults);
  await writeJson(PATHS.teamStats, teamStats);
  await writeJson(PATHS.predictions, predictions);
  await writeText(PATHS.report, buildReport(quarterFinalResults, teamStats, predictions));

  console.log(`Wrote ${PATHS.results}`);
  console.log(`Wrote ${PATHS.teamStats}`);
  console.log(`Wrote ${PATHS.predictions}`);
  console.log(`Wrote ${PATHS.report}`);
}

async function fetchFifaCalendar() {
  const response = await fetch(FIFA_API_URL, {
    headers: { "user-agent": "fifa-wc2026-data-pipeline/0.1 (+quarter-final-update)" },
  });
  if (!response.ok) throw new Error(`${FIFA_API_URL} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function buildQuarterFinalResults(fixtures, generatedAt) {
  const results = fixtures.filter((fixture) => QF_NUMBERS.includes(fixture.matchNumber)).map((fixture) => {
    if (!fixture.finalScore) throw new Error(`Quarter-final match ${fixture.matchNumber} is not final.`);
    const penaltiesPlayed = fixture.resultType === 2;
    const extraTimePlayed = fixture.resultType === 2 || fixture.resultType === 3;
    return {
      matchId: fixture.matchId,
      matchNumber: fixture.matchNumber,
      stage: "Quarter-final",
      date: fixture.date,
      utcDateTime: fixture.utcDateTime,
      venue: fixture.venue,
      city: fixture.city,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      finalScore: fixture.finalScore,
      scoreAfterExtraTime: extraTimePlayed ? fixture.finalScore : null,
      penaltyScore: penaltiesPlayed ? fixture.penaltyScore : null,
      resultType: penaltiesPlayed ? "penalties" : fixture.resultType === 3 ? "after_extra_time" : "normal_time",
      matchDurationLabel: fixture.matchTime,
      duration: {
        regulationMinutes: 90,
        extraTimeMinutes: extraTimePlayed ? 30 : 0,
        playingMinutes: extraTimePlayed ? 120 : 90,
        penaltyShootout: penaltiesPlayed,
        elapsedClockMinutes: parseElapsedClockMinutes(fixture.matchTime),
      },
      extraTimePlayed,
      penaltiesPlayed,
      advancingTeam: fixture.winner,
      source: sourceRecord(FIFA_API_URL, generatedAt, "official", "high", "confirmed"),
      notes: penaltiesPlayed ? "Penalty shootout is recorded separately and not counted as goal scoring." : "",
    };
  });
  return {
    datasetId: "quarter-final-results-v1",
    artifactKind: "collected_results",
    generatedAt,
    source: {
      sourceName: "FIFA World Cup 2026 scores and fixtures",
      sourceUrl: FIFA_SCORES_URL,
      sourceApiUrl: FIFA_API_URL,
      fetchedAt: generatedAt,
    },
    completionStatus: {
      expectedFixtures: QF_NUMBERS.length,
      completedFixtures: results.length,
      incompleteFixtures: QF_NUMBERS.length - results.length,
      allQuarterFinalFixturesFinal: results.length === QF_NUMBERS.length,
    },
    results,
    warnings: ["FIFA calendar confirms result, venue, kickoff and match duration label, but does not expose lineups/events/cards/xG in this endpoint."],
  };
}

function buildSemiFinalTeamStats(prior, results, adjustments, generatedAt) {
  const priorByTeam = new Map(prior.teams.map((team) => [teamKey(team.team), team]));
  const advancingKeys = results.map((match) => teamKey(match.advancingTeam));
  const priorRates = prior.teams.map((team) => rateSource(team));
  const priorAvgFor = average(priorRates.map((team) => team.goalsForPerMatch));
  const priorAvgAgainst = average(priorRates.map((team) => team.goalsAgainstPerMatch));
  const weight = adjustments.residualEvidenceWeight ?? adjustments.scoreUpdateShrinkageWeight ?? 0.05;

  const teams = advancingKeys.map((key) => {
    const priorTeam = required(priorByTeam.get(key), `Missing prior stats for ${key}.`);
    const match = required(results.find((result) => [result.homeTeam, result.awayTeam].some((team) => teamKey(team) === key)), `Missing QF result for ${priorTeam.team}.`);
    const isHome = teamKey(match.homeTeam) === key;
    const opponentName = isHome ? match.awayTeam : match.homeTeam;
    const opponent = priorByTeam.get(teamKey(opponentName));
    const priorRate = rateSource(priorTeam);
    const opponentRate = rateSource(opponent);
    const gf = isHome ? match.finalScore.home : match.finalScore.away;
    const ga = isHome ? match.finalScore.away : match.finalScore.home;
    const opponentDefenceRate = Math.max(opponentRate?.goalsAgainstPerMatch ?? priorAvgAgainst, priorAvgAgainst * 0.35);
    const opponentAttackRate = Math.max(opponentRate?.goalsForPerMatch ?? priorAvgFor, priorAvgFor * 0.35);
    const expectedForBefore = round(priorRate.goalsForPerMatch * opponentDefenceRate / Math.max(0.01, priorAvgAgainst));
    const expectedAgainstBefore = round(priorRate.goalsAgainstPerMatch * opponentAttackRate / Math.max(0.01, priorAvgFor));
    const attackResidual = round(gf - expectedForBefore);
    const defenseResidual = round(ga - expectedAgainstBefore);
    const updatedAttackRate = Math.max(0.05, priorRate.goalsForPerMatch + attackResidual * weight);
    const updatedDefensiveRate = Math.max(0.05, priorRate.goalsAgainstPerMatch + defenseResidual * weight);
    const modelPlayed = priorRate.played;
    const modelGoalsFor = updatedAttackRate * modelPlayed;
    const modelGoalsAgainst = updatedDefensiveRate * modelPlayed;
    const actualBase = priorTeam.actualTotalsThroughRoundOf16 ?? priorTeam.totals;
    return {
      ...priorTeam,
      quarterFinal: {
        matchNumber: match.matchNumber,
        opponent: opponentName,
        goalsFor: gf,
        goalsAgainst: ga,
        advanced: true,
        extraTimePlayed: match.extraTimePlayed,
        penaltiesPlayed: match.penaltiesPlayed,
        penaltyScore: match.penaltyScore,
        playingMinutes: match.duration.playingMinutes,
        elapsedClockMinutes: match.duration.elapsedClockMinutes,
      },
      actualTotalsThroughQuarterFinal: {
        played: actualBase.played + 1,
        goalsFor: actualBase.goalsFor + gf,
        goalsAgainst: actualBase.goalsAgainst + ga,
        goalDifference: actualBase.goalDifference + gf - ga,
      },
      modelingTotals: {
        updateMethod: "opponent_adjusted_residual",
        residualEvidenceWeight: weight,
        played: round(modelPlayed),
        goalsFor: round(modelGoalsFor),
        goalsAgainst: round(modelGoalsAgainst),
        goalDifference: round(modelGoalsFor - modelGoalsAgainst),
        goalsForPerMatch: round(modelGoalsFor / modelPlayed),
        goalsAgainstPerMatch: round(modelGoalsAgainst / modelPlayed),
      },
      expectedGoalTrace: {
        ...(priorTeam.expectedGoalTrace ?? {}),
        ratingBeforeQuarterFinal: {
          attack: priorRate.goalsForPerMatch,
          defence: priorRate.goalsAgainstPerMatch,
          source: PATHS.priorTeamStats,
        },
        quarterFinalOpponentStrength: opponent ? {
          team: opponent.team,
          attack: opponentRate.goalsForPerMatch,
          defence: opponentRate.goalsAgainstPerMatch,
        } : null,
        quarterFinalGoalsScored: gf,
        quarterFinalGoalsConceded: ga,
        expectedPerformanceBeforeQuarterFinalUpdate: {
          goalsFor: expectedForBefore,
          goalsAgainst: expectedAgainstBefore,
        },
        quarterFinalRawScoreResidual: {
          attack: attackResidual,
          defence: defenseResidual,
        },
        quarterFinalShrinkageAppliedToResidual: {
          evidenceWeight: weight,
          attackUpdate: round(attackResidual * weight),
          defenceUpdate: round(defenseResidual * weight),
        },
        updatedAttackRatingAfterQuarterFinal: round(updatedAttackRate),
        updatedDefenceRatingAfterQuarterFinal: round(updatedDefensiveRate),
      },
    };
  });

  return {
    datasetId: "semi-final-team-stats-v1",
    artifactKind: "knockout_team_stats",
    generatedAt,
    sourceFiles: {
      priorTeamStats: PATHS.priorTeamStats,
      quarterFinalResults: PATHS.results,
      adjustments: PATHS.quarterFinalAdjustments,
    },
    notes: "Semi-final teams use official quarter-final advancement. Quarter-final score effects are opponent-adjusted residual updates with strong shrinkage; penalty shootout goals are excluded.",
    updatePolicy: {
      selectedEvidenceWeight: weight,
      residualFormula: "newRate = oldRate + (observed - opponentAdjustedExpected) * evidenceWeight",
      fullScoreWeightingRejected: true,
    },
    teamCount: teams.length,
    teams,
  };
}

function buildRemainingPredictions(fixtures, priorTeamStats, teamStats, calibration, adjustments, quarterFinalResults, lastMinuteContext, generatedAt) {
  const params = {
    ...calibration.updatedParameters.markovChainScorePredictions.modelParameters,
    baseGoalsPerTeamMatch: average(priorTeamStats.teams.map((team) => rateSource(team).goalsForPerMatch)),
    formSignalScale: adjustments.formSignalScale ?? 0.45,
    extraTimeScoringRate: EXTRA_TIME_SCORING_RATE,
    residualEvidenceWeight: adjustments.residualEvidenceWeight ?? adjustments.scoreUpdateShrinkageWeight ?? 0.05,
  };
  const inputs = buildModelInputs(teamStats.teams, params);
  const byTeam = new Map(inputs.map((team) => [teamKey(team.team), team]));
  const semifinalMatches = fixtures.filter((fixture) => SEMI_NUMBERS.includes(fixture.matchNumber)).map((fixture) => {
    if (!fixture.homeTeam || !fixture.awayTeam) throw new Error(`Semi-final match ${fixture.matchNumber} is not assigned.`);
    return predictionRow(fixture, byTeam, params, SIMULATIONS_PER_FIXTURE, RANDOM_SEED_BASE + fixture.matchNumber, findFixtureContext(lastMinuteContext, fixture));
  });
  const [semiA, semiB] = semifinalMatches;
  const finalFixture = resolveConditionalFixture(fixtures, FINAL_NUMBER, semiA.selectedAdvancingTeam, semiB.selectedAdvancingTeam);
  const thirdFixture = resolveConditionalFixture(fixtures, THIRD_PLACE_NUMBER, loser(semiA), loser(semiB));
  const finalPrediction = predictionRow(finalFixture, byTeam, params, SIMULATIONS_PER_FIXTURE, RANDOM_SEED_BASE + FINAL_NUMBER, findFixtureContext(lastMinuteContext, finalFixture));
  const thirdPlacePrediction = predictionRow(thirdFixture, byTeam, params, SIMULATIONS_PER_FIXTURE, RANDOM_SEED_BASE + THIRD_PLACE_NUMBER, findFixtureContext(lastMinuteContext, thirdFixture));
  const bracketSimulation = simulateRemainingBracket(semifinalMatches, byTeam, params, BRACKET_SIMULATIONS);

  return {
    artifactKind: "prediction",
    predictionId: "remaining-knockout-score-predictions-v1",
    predictionType: "remaining_knockout_score_predictions",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    contaminationControl: {
      builderInputPaths: [PATHS.teamStats, PATHS.calibration, PATHS.quarterFinalAdjustments, PATHS.results, ...(lastMinuteContext ? [PATHS.lastMinuteContext] : [])],
      previousPredictionArtifactsUsedForEvaluationOnly: false,
      predictionDirectoryReadAsInputForPrediction: false,
      noFutureResultsUsed: true,
    },
    method: {
      type: "remaining_knockout_markov_score_distribution_with_monte_carlo_progression",
      modelParameters: params,
      scoreUpdateMethod: "opponent_adjusted_residual",
      scoreUpdateShrinkageWeight: adjustments.scoreUpdateShrinkageWeight ?? adjustments.residualEvidenceWeight ?? 0.05,
      lastMinuteContextPolicy: {
        sourcePath: lastMinuteContext ? PATHS.lastMinuteContext : null,
        expectedGoalsMultiplierBounds: [LAST_MINUTE_MULTIPLIER_MIN, LAST_MINUTE_MULTIPLIER_MAX],
        notes: "Only sourced, fixture-specific factors with explicit multipliers are applied numerically. Unconfirmed lineups, vague injuries and weather without on-field impact remain context only.",
      },
      scoreSelection: SCORE_SELECTION,
      simulationsPerFixture: SIMULATIONS_PER_FIXTURE,
      bracketSimulations: BRACKET_SIMULATIONS,
      randomSeedBase: RANDOM_SEED_BASE,
      noInventedInputs: true,
      unavailableInputsOmitted: ["confirmed lineups", "player minutes", "xG", "event data", "complete card logs", "detailed travel logistics"],
    },
    lastMinuteContext: lastMinuteContext ? summarizeLastMinuteContext(lastMinuteContext) : null,
    officialQuarterFinalResults: quarterFinalResults.results,
    semiFinalPredictions: semifinalMatches,
    selectedPath: {
      basis: "Most likely semi-final qualifiers by Markov qualification probability; final and third-place scores are conditional on that path.",
      semiFinals: semifinalMatches,
      thirdPlace: thirdPlacePrediction,
      final: finalPrediction,
      champion: finalPrediction.selectedAdvancingTeam,
      runnerUp: loser(finalPrediction),
      thirdPlaceTeam: thirdPlacePrediction.selectedAdvancingTeam,
    },
    bracketSimulation,
  };
}

function predictionRow(fixture, byTeam, params, iterations, seed, fixtureContext) {
  return {
    matchId: fixture.matchId,
    matchNumber: fixture.matchNumber,
    stage: fixture.stage,
    date: fixture.date,
    utcDateTime: fixture.utcDateTime,
    venue: fixture.venue,
    city: fixture.city,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    ...matchupPrediction(fixture.homeTeam, fixture.awayTeam, byTeam, params, iterations, seed, fixtureContext),
  };
}

function matchupPrediction(homeTeam, awayTeam, byTeam, params, iterations, seed, fixtureContext = null) {
  const home = required(byTeam.get(teamKey(homeTeam)), `Missing team ${homeTeam}.`);
  const away = required(byTeam.get(teamKey(awayTeam)), `Missing team ${awayTeam}.`);
  const baseLambdaHome = expectedGoals(home, away, params);
  const baseLambdaAway = expectedGoals(away, home, params);
  const contextAdjustment = buildContextAdjustment(fixtureContext, homeTeam, awayTeam);
  const lambdaHome = round(clamp(baseLambdaHome * contextAdjustment.home.expectedGoalsMultiplier, params.lambdaMin, params.lambdaMax));
  const lambdaAway = round(clamp(baseLambdaAway * contextAdjustment.away.expectedGoalsMultiplier, params.lambdaMin, params.lambdaMax));
  const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
  const metrics = calculateScoreDistributionMetrics(distribution);
  const extraTime = extraTimeModel(lambdaHome, lambdaAway, home, away, params);
  const top = metrics.topScorelines.map((score) => ({ ...score, expectedFantasyPoints: calculateFantasyExpectedPoints(score, distribution) }));
  const selected = selectScoreline(distribution, home, away);
  const qual = qualificationProbabilities(metrics, extraTime);
  const selectedQualifier = qual.home >= qual.away ? homeTeam : awayTeam;
  const warnings = diagnosticWarnings({ lambdaHome, lambdaAway, metrics, qual, top });
  const confidence = confidenceAssessment(metrics, qual, warnings);
  const bestFantasy = [...top].sort((a, b) => b.expectedFantasyPoints - a.expectedFantasyPoints || b.probability - a.probability)[0];
  return {
    homeTeam,
    awayTeam,
    lastMinuteContext: contextAdjustment,
    expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
    baseExpectedGoalsBeforeLastMinuteContext: { home: baseLambdaHome, away: baseLambdaAway },
    selectedScore: { home: selected.homeGoals, away: selected.awayGoals, probability: selected.probability },
    mostProbableScore: scoreOut(top[0]),
    alternativeScores: top.slice(1, 5).map(scoreOut),
    topScorelines: top.map(scoreOut),
    higherScoreTiebreakApplied: selected.homeGoals + selected.awayGoals > top[0].homeGoals + top[0].awayGoals,
    selectedScoreReason: selected.homeGoals === top[0].homeGoals && selected.awayGoals === top[0].awayGoals
      ? "Selected score is the most probable Markov bucket."
      : `Selected score remains inside the near-equal band and has more total goals than the most probable ${top[0].homeGoals}-${top[0].awayGoals}.`,
    outcomeProbabilities: {
      homeWin: metrics.homeWinProbability,
      drawThrough90: metrics.drawProbability,
      awayWin: metrics.awayWinProbability,
    },
    extraTimeProbability: metrics.drawProbability,
    penaltyShootoutProbability: {
      conditionalOnExtraTime: extraTime.penaltiesConditionalOnExtraTime,
      unconditional: extraTime.penaltiesUnconditional,
    },
    shootoutWinProbability: extraTime.shootoutWinProbability,
    qualificationProbabilities: qual,
    selectedAdvancingTeam: selectedQualifier,
    monteCarlo: monteCarloFixture(qual, homeTeam, awayTeam, iterations, seed),
    bestFantasyScore: scoreOut(bestFantasy),
    predictionStrength: confidence.predictionStrength,
    evidenceConfidence: confidence.evidenceConfidence,
    confidence: confidence.evidenceConfidence,
    uncertainty: uncertaintyLevel(metrics, qual),
    scoreDistribution: distribution,
    validation: validateDistribution(distribution, metrics, qual),
    validationWarnings: warnings,
    reasoningNote: `${homeTeam} residual-updated GF/GA ${home.modelingTotals.goalsForPerMatch}-${home.modelingTotals.goalsAgainstPerMatch} vs ${awayTeam} ${away.modelingTotals.goalsForPerMatch}-${away.modelingTotals.goalsAgainstPerMatch}; quarter-final score update uses ${Math.round((params.residualEvidenceWeight ?? 0.05) * 100)}% of opponent-adjusted residual only.${contextAdjustment.appliedToModel ? ` Last-minute xG multipliers: ${homeTeam} ${contextAdjustment.home.expectedGoalsMultiplier}, ${awayTeam} ${contextAdjustment.away.expectedGoalsMultiplier}.` : " No sourced last-minute numeric adjustment for this fixture."}`,
  };
}

function simulateRemainingBracket(semifinals, byTeam, params, iterations) {
  const rng = mulberry32(RANDOM_SEED_BASE + 900);
  const matchupCache = new Map();
  const championCounts = new Map();
  const runnerUpCounts = new Map();
  const thirdCounts = new Map();
  const finalPairings = new Map();
  for (let i = 0; i < iterations; i += 1) {
    const semi1Winner = sampleQualifier(semifinals[0], rng);
    const semi2Winner = sampleQualifier(semifinals[1], rng);
    const semi1Loser = semi1Winner === semifinals[0].homeTeam ? semifinals[0].awayTeam : semifinals[0].homeTeam;
    const semi2Loser = semi2Winner === semifinals[1].homeTeam ? semifinals[1].awayTeam : semifinals[1].homeTeam;
    incrementPair(finalPairings, semi1Winner, semi2Winner);
    const finalPrediction = cachedMatchup(semi1Winner, semi2Winner, byTeam, params, matchupCache);
    const champion = sampleWinner(finalPrediction, rng);
    const runnerUp = champion === semi1Winner ? semi2Winner : semi1Winner;
    increment(championCounts, champion);
    increment(runnerUpCounts, runnerUp);
    const thirdPrediction = cachedMatchup(semi1Loser, semi2Loser, byTeam, params, matchupCache);
    increment(thirdCounts, sampleWinner(thirdPrediction, rng));
  }
  return {
    iterations,
    championProbabilities: probabilityRows(championCounts, iterations),
    runnerUpProbabilities: probabilityRows(runnerUpCounts, iterations),
    thirdPlaceProbabilities: probabilityRows(thirdCounts, iterations),
    finalPairings: [...finalPairings.entries()].map(([pairing, count]) => {
      const [teamA, teamB] = pairing.split("||");
      return { teamA, teamB, probability: round(count / iterations), count };
    }).sort((a, b) => b.probability - a.probability || a.teamA.localeCompare(b.teamA) || a.teamB.localeCompare(b.teamB)),
  };
}

function cachedMatchup(homeTeam, awayTeam, byTeam, params, cache) {
  const key = `${homeTeam}||${awayTeam}`;
  if (!cache.has(key)) cache.set(key, matchupPrediction(homeTeam, awayTeam, byTeam, params, 0, 0));
  return cache.get(key);
}

function findFixtureContext(lastMinuteContext, fixture) {
  const contexts = lastMinuteContext?.fixtureContexts;
  if (!Array.isArray(contexts)) return null;
  return contexts.find((context) => context.matchNumber === fixture.matchNumber)
    ?? contexts.find((context) => {
      const teams = String(context.fixture ?? "").split(/\s+vs\s+/i).map(teamKey);
      return teams.length === 2 && teams.includes(teamKey(fixture.homeTeam)) && teams.includes(teamKey(fixture.awayTeam));
    })
    ?? null;
}

function buildContextAdjustment(fixtureContext, homeTeam, awayTeam) {
  const home = teamContextAdjustment(fixtureContext, homeTeam);
  const away = teamContextAdjustment(fixtureContext, awayTeam);
  return {
    sourceDatasetId: fixtureContext?.datasetId ?? undefined,
    summary: fixtureContext?.summary ?? "No fixture-specific last-minute context available.",
    appliedToModel: home.appliedToModel || away.appliedToModel,
    home,
    away,
    sourceRefs: fixtureContext?.sourceRefs ?? [],
    contextOnlyFactors: fixtureContext?.contextOnlyFactors ?? [],
  };
}

function teamContextAdjustment(fixtureContext, team) {
  const adjustment = fixtureContext?.teamAdjustments?.find((item) => teamKey(item.team) === teamKey(team));
  const rawMultiplier = Number(adjustment?.expectedGoalsMultiplier ?? 1);
  const multiplier = Number.isFinite(rawMultiplier) ? clamp(rawMultiplier, LAST_MINUTE_MULTIPLIER_MIN, LAST_MINUTE_MULTIPLIER_MAX) : 1;
  return {
    team,
    expectedGoalsMultiplier: round(multiplier),
    appliedToModel: Boolean(adjustment?.appliedToModel) && multiplier !== 1,
    rationale: adjustment?.rationale ?? "No sourced numeric last-minute adjustment.",
  };
}

function summarizeLastMinuteContext(lastMinuteContext) {
  return {
    datasetId: lastMinuteContext.datasetId,
    generatedAt: lastMinuteContext.generatedAt,
    sourcePath: PATHS.lastMinuteContext,
    applicationPolicy: lastMinuteContext.applicationPolicy,
    globalFactors: lastMinuteContext.globalFactors ?? [],
    fixtureContexts: (lastMinuteContext.fixtureContexts ?? []).map((context) => ({
      matchNumber: context.matchNumber,
      fixture: context.fixture,
      summary: context.summary,
      teamAdjustments: context.teamAdjustments ?? [],
      contextOnlyFactors: context.contextOnlyFactors ?? [],
      sourceRefs: context.sourceRefs ?? [],
    })),
    warnings: lastMinuteContext.warnings ?? [],
  };
}

function sampleQualifier(match, rng) {
  return rng() < match.qualificationProbabilities.home ? match.homeTeam : match.awayTeam;
}

function sampleWinner(prediction, rng) {
  const roll = rng();
  if (roll < prediction.outcomeProbabilities.homeWin) return prediction.homeTeam;
  if (roll < prediction.outcomeProbabilities.homeWin + prediction.outcomeProbabilities.awayWin) return prediction.awayTeam;
  const draw = prediction.outcomeProbabilities.drawThrough90;
  const homeDrawShare = draw === 0 ? 0.5 : clamp((prediction.qualificationProbabilities.home - prediction.outcomeProbabilities.homeWin) / draw, 0, 1);
  return rng() < homeDrawShare ? prediction.homeTeam : prediction.awayTeam;
}

function buildModelInputs(teams, params) {
  const fifaPoints = teams.flatMap((team) => Number.isFinite(team.fifaPoints) ? [team.fifaPoints] : []);
  const fifaRanks = teams.flatMap((team) => Number.isFinite(team.fifaRank) ? [team.fifaRank] : []);
  const eloRatings = teams.flatMap((team) => Number.isFinite(team.eloRating) ? [team.eloRating] : []);
  const goalDifferencePerMatch = teams.map((team) => ratio(team.modelingTotals.goalDifference, team.modelingTotals.played));
  const avgFor = average(teams.map((team) => team.modelingTotals.goalsForPerMatch));
  const avgAgainst = average(teams.map((team) => team.modelingTotals.goalsAgainstPerMatch));
  return teams.map((team) => {
    const qualityParts = [
      scorePart(normalizeRange(team.fifaPoints, Math.min(...fifaPoints), Math.max(...fifaPoints)), 0.25),
      scorePart(normalizeInverseRange(team.fifaRank, Math.min(...fifaRanks), Math.max(...fifaRanks)), 0.15),
      scorePart(normalizeRange(team.eloRating, Math.min(...eloRatings), Math.max(...eloRatings)), 0.25),
      scorePart(normalizeRange(ratio(team.groupStage.points, team.groupStage.played), 0, 3), 0.15),
      scorePart(normalizeRange(ratio(team.modelingTotals.goalDifference, team.modelingTotals.played), Math.min(...goalDifferencePerMatch), Math.max(...goalDifferencePerMatch)), 0.2),
    ].filter((part) => Number.isFinite(part.value));
    const totalWeight = qualityParts.reduce((sum, part) => sum + part.weight, 0);
    return {
      ...team,
      attackIndex: clamp(team.modelingTotals.goalsForPerMatch / Math.max(0.01, avgFor), 0.25, 2.75),
      defensiveVulnerabilityIndex: clamp(team.modelingTotals.goalsAgainstPerMatch / Math.max(0.01, avgAgainst), 0.2, 3.2),
      qualityScore: qualityParts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight,
      params,
    };
  });
}

function expectedGoals(team, opponent, params) {
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * params.qualityMultiplierScale);
  const rawFormBlend = Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex);
  const formBlend = Math.exp(Math.log(Math.max(0.01, rawFormBlend)) * (params.formSignalScale ?? 1));
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
    topScorelines: [...normalized].sort((a, b) => b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals).slice(0, 10).map((score) => ({ homeGoals: score.homeGoals, awayGoals: score.awayGoals, probability: round(score.probability) })),
  };
}

function selectScoreline(distribution, home, away) {
  const sorted = [...distribution].sort((a, b) => b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals);
  const top = sorted[0];
  const nearEqual = sorted.filter((score) =>
    score.probability >= top.probability * (1 - SCORE_SELECTION.nearEqualRelativeBand)
    || top.probability - score.probability <= SCORE_SELECTION.nearEqualAbsoluteProbabilityBand
  );
  const homeStronger = home.qualityScore >= away.qualityScore;
  return [...nearEqual].sort((a, b) =>
    (b.homeGoals + b.awayGoals) - (a.homeGoals + a.awayGoals)
    || strongerTeamWins(b, homeStronger) - strongerTeamWins(a, homeStronger)
    || drawScore(b) - drawScore(a)
    || b.probability - a.probability
    || a.homeGoals - b.homeGoals
    || a.awayGoals - b.awayGoals
  )[0];
}

function strongerTeamWins(score, homeStronger) {
  if (homeStronger && score.homeGoals > score.awayGoals) return 1;
  if (!homeStronger && score.awayGoals > score.homeGoals) return 1;
  return 0;
}

function drawScore(score) {
  return score.homeGoals === score.awayGoals ? 1 : 0;
}

function extraTimeModel(lambdaHome, lambdaAway, home, away, params) {
  const extraHome = Math.max(0.01, lambdaHome * (30 / 90) * params.extraTimeScoringRate);
  const extraAway = Math.max(0.01, lambdaAway * (30 / 90) * params.extraTimeScoringRate);
  const distribution = buildScoreDistribution(extraHome, extraAway, { ...params, stepsPerMatch: 30 }).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
  const metrics = calculateScoreDistributionMetrics(distribution);
  const qualityEdge = clamp((home.qualityScore - away.qualityScore) * 0.55, -0.9, 0.9);
  const homeShootout = round(1 / (1 + Math.exp(-qualityEdge)));
  return {
    expectedGoals: { home: round(extraHome), away: round(extraAway) },
    homeWinConditionalOnExtraTime: metrics.homeWinProbability,
    drawAfterExtraTimeConditional: metrics.drawProbability,
    awayWinConditionalOnExtraTime: metrics.awayWinProbability,
    penaltiesConditionalOnExtraTime: metrics.drawProbability,
    penaltiesUnconditional: null,
    shootoutWinProbability: { home: homeShootout, away: round(1 - homeShootout) },
    distribution,
  };
}

function qualificationProbabilities(metrics, extraTime) {
  const draw = metrics.drawProbability;
  extraTime.penaltiesUnconditional = round(draw * extraTime.penaltiesConditionalOnExtraTime);
  const homeFromDraw = extraTime.homeWinConditionalOnExtraTime + extraTime.drawAfterExtraTimeConditional * extraTime.shootoutWinProbability.home;
  const homeQualifies = metrics.homeWinProbability + draw * homeFromDraw;
  return { home: round(homeQualifies), away: round(1 - homeQualifies) };
}

function monteCarloFixture(qual, homeTeam, awayTeam, iterations, seed) {
  const rng = mulberry32(seed);
  let homeQual = 0;
  let awayQual = 0;
  for (let i = 0; i < iterations; i += 1) {
    if (rng() < qual.home) homeQual += 1;
    else awayQual += 1;
  }
  return {
    iterations,
    seed,
    qualificationProbabilities: {
      home: round(homeQual / Math.max(1, iterations)),
      away: round(awayQual / Math.max(1, iterations)),
    },
    selectedAdvancingTeam: homeQual >= awayQual ? homeTeam : awayTeam,
  };
}

function confidenceAssessment(metrics, qual, warnings) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const edge = Math.abs(qual.home - qual.away);
  const predictionStrength = maxOutcome >= 0.68 && edge >= 0.35 ? "High" : maxOutcome >= 0.54 || edge >= 0.2 ? "Medium" : "Low";
  const evidenceConfidence = warnings.length > 0 ? "Low" : predictionStrength === "High" ? "Medium" : predictionStrength;
  return { predictionStrength, evidenceConfidence };
}

function uncertaintyLevel(metrics, qual) {
  const edge = Math.abs(qual.home - qual.away);
  if (edge < 0.12 || metrics.drawProbability > 0.27) return "High";
  if (edge < 0.3) return "Medium";
  return "Low";
}

function diagnosticWarnings() {
  return ["review: important lineup, fitness, player-minute, cards, weather and advanced match inputs are missing"];
}

function validateDistribution(distribution, metrics, qual) {
  const scoreSum = round(distribution.reduce((sum, score) => sum + score.probability, 0));
  const wdlSum = round(metrics.homeWinProbability + metrics.drawProbability + metrics.awayWinProbability);
  const qualSum = round(qual.home + qual.away);
  return {
    scoreMatrixSumsToOne: Math.abs(scoreSum - 1) <= 0.001,
    scoreProbabilitySum: scoreSum,
    wdlSumsToOne: Math.abs(wdlSum - 1) <= 0.001,
    wdlProbabilitySum: wdlSum,
    qualificationSumsToOne: Math.abs(qualSum - 1) <= 0.001,
    qualificationProbabilitySum: qualSum,
  };
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

function outcome(home, away) {
  if (home > away) return "home_win";
  if (away > home) return "away_win";
  return "draw";
}

function loser(match) {
  return match.selectedAdvancingTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
}

function resolveConditionalFixture(fixtures, matchNumber, homeTeam, awayTeam) {
  const fixture = required(fixtures.find((item) => item.matchNumber === matchNumber), `Missing match ${matchNumber}.`);
  return { ...fixture, homeTeam, awayTeam };
}

function normalizeFixture(match, fetchedAt) {
  const homeTeam = normalizeTeamName(optionalDescription(match.Home?.TeamName));
  const awayTeam = normalizeTeamName(optionalDescription(match.Away?.TeamName));
  const homeScore = firstNumber(match.HomeTeamScore, match.Home?.Score);
  const awayScore = firstNumber(match.AwayTeamScore, match.Away?.Score);
  const isFinal = match.MatchStatus === 0 && match.OfficialityStatus === 1 && match.ResultType > 0 && Number.isInteger(homeScore) && Number.isInteger(awayScore);
  return {
    matchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    stage: optionalDescription(match.StageName),
    date: match.Date?.slice(0, 10),
    utcDateTime: match.Date,
    venue: optionalDescription(match.Stadium?.Name) ?? "Unknown venue",
    city: optionalDescription(match.Stadium?.CityName),
    country: match.Stadium?.IdCountry,
    homeTeam,
    awayTeam,
    finalScore: isFinal ? { home: homeScore, away: awayScore } : null,
    penaltyScore: Number.isInteger(match.HomeTeamPenaltyScore) && Number.isInteger(match.AwayTeamPenaltyScore)
      ? { home: match.HomeTeamPenaltyScore, away: match.AwayTeamPenaltyScore }
      : null,
    resultType: match.ResultType,
    matchStatus: match.MatchStatus,
    officialityStatus: match.OfficialityStatus,
    matchTime: match.MatchTime ?? null,
    winner: normalizeTeamName(match.Winner === match.Home?.IdTeam ? homeTeam : match.Winner === match.Away?.IdTeam ? awayTeam : undefined),
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_API_URL,
    fetchedAt,
  };
}

function buildReport(results, teamStats, predictions) {
  const path = predictions.selectedPath;
  return [
    "# Remaining Knockout Predictions",
    "",
    `Generated: ${predictions.generatedAt}`,
    "",
    "## 1. Collection Summary",
    "",
    "- Official quarter-final results, venues, kickoff times and match duration labels collected from FIFA.",
    "- FIFA calendar endpoint did not expose lineups, cards, event data, player minutes, xG or advanced match metrics.",
    "- Semi-final teams are fixed from official quarter-final advancement; final and third-place fixtures are conditional on predicted semi-final winners.",
    "",
    "## 2. Data Sources And Timestamps",
    "",
    `- FIFA calendar API: ${FIFA_API_URL}`,
    `- Collected: ${results.generatedAt}`,
    `- Team stats: ${PATHS.teamStats}`,
    `- Prediction artifact: ${PATHS.predictions}`,
    `- Last-minute context: ${predictions.lastMinuteContext ? PATHS.lastMinuteContext : "none"}`,
    "",
    "## 3. Quarter-Final Actual Results",
    "",
    "| Match | Venue | Kickoff UTC | Result | ET | Pens | Advanced | Playing minutes |",
    "| ---: | --- | --- | --- | --- | --- | --- | ---: |",
    ...results.results.map((match) => `| ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} | ${match.venue} | ${match.utcDateTime} | ${match.finalScore.home}-${match.finalScore.away} | ${match.scoreAfterExtraTime ? `${match.scoreAfterExtraTime.home}-${match.scoreAfterExtraTime.away}` : ""} | ${match.penaltyScore ? `${match.penaltyScore.home}-${match.penaltyScore.away}` : ""} | ${match.advancingTeam} | ${match.duration.playingMinutes} |`),
    "",
    "## 4. Last-Minute Context Applied",
    "",
    ...lastMinuteContextLines(predictions.lastMinuteContext),
    "",
    "## 5. Semi-Final Predictions",
    "",
    predictionTable(predictions.semiFinalPredictions),
    "",
    "## 6. Conditional Third-Place Match",
    "",
    predictionTable([path.thirdPlace]),
    "",
    "## 7. Conditional Final",
    "",
    predictionTable([path.final]),
    "",
    "## 8. Champion Probabilities",
    "",
    ...predictions.bracketSimulation.championProbabilities.map((row) => `- ${row.team}: ${percent(row.probability)}`),
    "",
    "## 9. Possible Final Pairings",
    "",
    ...predictions.bracketSimulation.finalPairings.map((row) => `- ${row.teamA} vs ${row.teamB}: ${percent(row.probability)}`),
    "",
    "## 10. Score Probability Matrices",
    "",
    ...[...predictions.semiFinalPredictions, path.thirdPlace, path.final].map((match) => `- ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam}: ${match.topScorelines.map((score) => `${score.home}-${score.away} ${percent(score.probability)}`).join("; ")}`),
    "",
    "## 11. Method And Limitations",
    "",
    "- Markov score distributions use semi-final team stats after a 5% opponent-adjusted residual update from official quarter-final scores.",
    "- Monte Carlo simulates the remaining bracket from the two official semi-finals.",
    "- Sourced last-minute context is applied through tiny, capped expected-goals multipliers only where the context file explicitly marks it for model use.",
    "- Near-equal scorelines are resolved with the higher-scoring tiebreak requested for score predictions.",
    "- LLM reasoning is only used to explain and sanity-check; no lineups, xG, player minutes, tactical news, or unsourced availability data are invented.",
    "",
    `Predicted champion: ${path.champion}. Predicted final: ${path.final.homeTeam} vs ${path.final.awayTeam}, ${formatScore(path.final.selectedScore)}. Predicted third-place team: ${path.thirdPlaceTeam}.`,
    "",
  ].join("\n");
}

function predictionTable(matches) {
  return [
    "| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Pick | Confidence | Reason |",
    "| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |",
    ...matches.map((match) => `| ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} | ${match.expectedGoals.home}-${match.expectedGoals.away} | ${formatScore(match.mostProbableScore)} (${percent(match.mostProbableScore.probability)}) | ${formatScore(match.selectedScore)} | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.drawThrough90)} / ${percent(match.outcomeProbabilities.awayWin)} | ${percent(match.extraTimeProbability)} | ${percent(match.penaltyShootoutProbability.conditionalOnExtraTime)} / ${percent(match.penaltyShootoutProbability.unconditional)} | ${match.homeTeam} ${percent(match.qualificationProbabilities.home)}, ${match.awayTeam} ${percent(match.qualificationProbabilities.away)} | ${match.selectedAdvancingTeam} | ${match.predictionStrength} / evidence ${match.evidenceConfidence} | ${match.selectedScoreReason} ${match.reasoningNote} |`),
  ].join("\n");
}

function lastMinuteContextLines(lastMinuteContext) {
  if (!lastMinuteContext) return ["- No sourced last-minute context file was available for this run."];
  return [
    `- Context dataset: ${lastMinuteContext.datasetId} (${lastMinuteContext.generatedAt}).`,
    ...lastMinuteContext.globalFactors.map((factor) => `- Global: ${factor.summary} ${factor.modelEffect}`),
    "",
    "| Match | Applied xG multipliers | Context summary | Sources |",
    "| --- | --- | --- | --- |",
    ...lastMinuteContext.fixtureContexts.map((context) => {
      const multipliers = context.teamAdjustments.map((item) => `${item.team} ${item.expectedGoalsMultiplier}`).join(", ");
      const sources = context.sourceRefs.map((source) => `[${source.sourceName}](${source.sourceUrl})`).join("; ");
      return `| ${context.matchNumber}: ${context.fixture} | ${multipliers || "none"} | ${context.summary} | ${sources} |`;
    }),
    ...(lastMinuteContext.warnings.length ? ["", ...lastMinuteContext.warnings.map((warning) => `- Warning: ${warning}`)] : []),
  ];
}

function rateSource(team) {
  if (!team) return undefined;
  return team.modelingTotals ?? team.totals;
}

function scoreOut(score) {
  return {
    home: score.homeGoals,
    away: score.awayGoals,
    probability: score.probability,
    expectedFantasyPoints: score.expectedFantasyPoints,
  };
}

function formatScore(score) {
  return `${score.home}-${score.away}`;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function probabilityRows(counts, iterations) {
  return [...counts.entries()].map(([team, count]) => ({ team, count, probability: round(count / iterations) })).sort((a, b) => b.probability - a.probability || a.team.localeCompare(b.team));
}

function incrementPair(map, teamA, teamB) {
  map.set(`${teamA}||${teamB}`, (map.get(`${teamA}||${teamB}`) ?? 0) + 1);
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function parseElapsedClockMinutes(value) {
  const matches = String(value ?? "").match(/\d+/g);
  return matches ? Number(matches[matches.length - 1]) : null;
}

function optionalDescription(value) {
  if (Array.isArray(value)) return (value.find((item) => item.Locale === "en-GB") ?? value[0])?.Description;
  if (typeof value === "object" && value !== null) return value.Description ?? value.ShortClubName;
  return typeof value === "string" ? value : undefined;
}

function firstNumber(...values) {
  for (const value of values) if (Number.isInteger(value)) return value;
  return undefined;
}

function sourceRecord(sourceUrlOrId, collectedAt, sourceType, confidence, status) {
  return { sourceUrlOrId, collectedAt, sourceType, confidence, status };
}

function scorePart(value, weight) {
  return { value, weight };
}

function normalizeRange(value, min, max) {
  if (!Number.isFinite(value) || max === min) return 1;
  return clamp((value - min) / (max - min), 0, 1);
}

function normalizeInverseRange(value, min, max) {
  if (!Number.isFinite(value) || max === min) return 1;
  return clamp((max - value) / (max - min), 0, 1);
}

function ratio(value, denominator) {
  return denominator === 0 ? 0 : value / denominator;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function required(value, message) {
  if (value === undefined || value === null) throw new Error(message);
  return value;
}

function normalizeTeamName(name) {
  if (!name) return undefined;
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
}

function teamKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonOptional(path, fallback) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${value}\n`, "utf8");
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
