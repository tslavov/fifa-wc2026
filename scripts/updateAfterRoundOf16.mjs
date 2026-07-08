import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";
const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

const PATHS = {
  priorTeamStats: join("data", "knockout", "round-of-16-team-stats-v1.json"),
  calibration: join("data", "model", "calibration-changes-after-round-of-32-v1.json"),
  previousPredictions: join("data", "predictions", "round-of-16-enhanced-predictions-v2.json"),
  results: join("data", "results", "round-of-16-results-v1.json"),
  performance: join("data", "context", "round-of-16-performance-context-v1.json"),
  curatedAvailabilityEvidence: join("data", "context", "quarter-final-curated-availability-evidence.json"),
  availability: join("data", "context", "quarter-final-player-availability-v1.json"),
  environment: join("data", "context", "quarter-final-rest-travel-weather-v1.json"),
  teamStats: join("data", "knockout", "quarter-final-team-stats-v1.json"),
  evaluation: join("data", "evaluation", "round-of-16-prediction-evaluation-v1.json"),
  adjustments: join("data", "model", "quarter-final-model-adjustments-v1.json"),
  predictions: join("data", "predictions", "quarter-final-score-predictions-v1.json"),
  report: join("reports", "quarter-final-predictions.md"),
};

const aliases = new Map([
  ["usa", "United States"],
  ["united states of america", "United States"],
]);

const R16_NUMBERS = [89, 90, 91, 92, 93, 94, 95, 96];
const QF_NUMBERS = [97, 98, 99, 100];
const SELECTED_RESIDUAL_EVIDENCE_WEIGHT = 0.05;
const FORM_SIGNAL_SCALE = 0.45;
const EXTRA_TIME_SCORING_RATE = 0.72;
const MARKET_BENCHMARKS = new Map([
  ["France", { qualificationProbability: 0.75, source: "user-provided review benchmark", status: "diagnostic_only" }],
  ["Spain", { qualificationProbability: 0.73, source: "user-provided review benchmark", status: "diagnostic_only" }],
  ["England", { qualificationProbability: 0.65, source: "user-provided review benchmark", status: "diagnostic_only" }],
  ["Argentina", { qualificationProbability: 0.71, source: "user-provided review benchmark", status: "diagnostic_only" }],
]);

async function main() {
  const generatedAt = new Date().toISOString();
  const [priorTeamStats, calibration, previousPredictions, curatedAvailabilityEvidence, calendar] = await Promise.all([
    readJson(PATHS.priorTeamStats),
    readJson(PATHS.calibration),
    readJson(PATHS.previousPredictions),
    readJsonOptional(PATHS.curatedAvailabilityEvidence, { datasetId: "quarter-final-curated-availability-evidence", records: [] }),
    fetchFifaCalendar(),
  ]);
  const fixtures = calendar.Results.map((match) => normalizeFixture(match, generatedAt)).sort((a, b) => a.matchNumber - b.matchNumber);
  const round16Results = buildRound16Results(fixtures, generatedAt);
  const performance = buildPerformanceContext(round16Results.results, generatedAt);
  const availability = buildAvailability(fixtures, generatedAt, curatedAvailabilityEvidence);
  const environment = buildEnvironment(fixtures, round16Results.results, generatedAt);
  const evaluation = buildEvaluation(previousPredictions, round16Results.results, generatedAt);
  const adjustments = buildAdjustments(evaluation, performance, availability, environment, generatedAt);
  const teamStats = buildQuarterFinalTeamStats(priorTeamStats, round16Results.results, adjustments, generatedAt);
  const predictions = buildQuarterFinalPredictions(fixtures, priorTeamStats, teamStats, calibration, adjustments, generatedAt);

  await writeJson(PATHS.results, round16Results);
  await writeJson(PATHS.performance, performance);
  await writeJson(PATHS.availability, availability);
  await writeJson(PATHS.environment, environment);
  await writeJson(PATHS.evaluation, evaluation);
  await writeJson(PATHS.adjustments, adjustments);
  await writeJson(PATHS.teamStats, teamStats);
  await writeJson(PATHS.predictions, predictions);
  await writeText(PATHS.report, buildReport(round16Results, performance, availability, environment, evaluation, adjustments, predictions));

  console.log(`Wrote ${PATHS.results}`);
  console.log(`Wrote ${PATHS.evaluation}`);
  console.log(`Wrote ${PATHS.teamStats}`);
  console.log(`Wrote ${PATHS.predictions}`);
  console.log(`Wrote ${PATHS.report}`);
}

async function fetchFifaCalendar() {
  const response = await fetch(FIFA_API_URL, {
    headers: { "user-agent": "fifa-wc2026-data-pipeline/0.1 (+round-of-16-update)" },
  });
  if (!response.ok) throw new Error(`${FIFA_API_URL} failed: ${response.status} ${response.statusText}`);
  return response.json();
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
    weather: match.Weather ?? null,
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_API_URL,
    fetchedAt,
  };
}

function buildRound16Results(fixtures, generatedAt) {
  const results = fixtures.filter((fixture) => R16_NUMBERS.includes(fixture.matchNumber)).map((fixture) => {
    if (!fixture.finalScore) throw new Error(`Round of 16 match ${fixture.matchNumber} is not final`);
    const penaltiesPlayed = fixture.resultType === 2;
    const extraTimePlayed = fixture.resultType === 2 || fixture.resultType === 3;
    const elapsedClockMinutes = parseElapsedClockMinutes(fixture.matchTime);
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
      regulationScore: fixture.finalScore,
      scoreAfterExtraTime: extraTimePlayed ? fixture.finalScore : null,
      penaltyScore: penaltiesPlayed ? fixture.penaltyScore : null,
      finalScore: fixture.finalScore,
      resultType: penaltiesPlayed ? "penalties" : fixture.resultType === 3 ? "after_extra_time" : "normal_time",
      matchDurationLabel: fixture.matchTime,
      duration: {
        regulationMinutes: 90,
        extraTimeMinutes: extraTimePlayed ? 30 : 0,
        playingMinutes: extraTimePlayed ? 120 : 90,
        penaltyShootout: penaltiesPlayed,
        elapsedClockMinutes,
      },
      extraTimePlayed,
      penaltiesPlayed,
      advancingTeam: fixture.winner,
      source: sourceRecord(FIFA_API_URL, generatedAt, "official", "high", "confirmed"),
      notes: penaltiesPlayed ? "Penalty shootout is recorded separately and not counted as goal-scoring victory." : "",
    };
  });
  return {
    datasetId: "round-of-16-results-v1",
    artifactKind: "collected_results",
    generatedAt,
    source: {
      sourceName: "FIFA World Cup 2026 scores and fixtures",
      sourceUrl: FIFA_SCORES_URL,
      sourceApiUrl: FIFA_API_URL,
      fetchedAt: generatedAt,
    },
    completionStatus: {
      expectedFixtures: 8,
      completedFixtures: results.length,
      incompleteFixtures: 8 - results.length,
      allRoundOf16FixturesFinal: results.length === 8,
    },
    results,
    warnings: ["FIFA calendar confirms result, venue, kickoff and match duration label, but does not expose lineups/events/cards/xG in this endpoint."],
  };
}

function buildPerformanceContext(results, generatedAt) {
  const requestedMetrics = [
    "possession", "in-contest possession", "total attempts", "shots on target", "shots inside penalty area",
    "big chances", "expected goals", "non-penalty expected goals", "expected goals on target", "final-third entries",
    "penalty-area entries/touches", "corners", "set-piece attempts/goals", "progressive passes/carries",
    "passing accuracy", "defensive actions", "recoveries", "goalkeeper saves", "cards", "red cards",
    "substitutions", "starting lineups", "player minutes", "extra-time minutes", "goal timing", "score state",
  ];
  const misleading = new Map([
    [90, "Morocco scored three; chance-quality metrics requested but unavailable, so no scoring-efficiency adjustment is applied."],
    [91, "Norway beat Brazil; xG/shot-quality support for Brazil is requested but unavailable from approved machine source."],
    [92, "England scored three from a reported low-shot profile; source-backed attempts/xG are unavailable in repository data."],
    [93, "Spain 1-0 may understate performance; source-backed xG/territory data unavailable."],
    [94, "Belgium 4-1 is directionally supported by scoreline only; chance-creation metrics unavailable."],
    [95, "Argentina trailed before winning; event timing/score-state data unavailable from the collected feed."],
    [96, "Switzerland-Colombia 0-0 through extra time is treated as low scoring; attacking-value metrics unavailable."],
  ]);
  return {
    datasetId: "round-of-16-performance-context-v1",
    artifactKind: "match_performance_context",
    generatedAt,
    providerPolicy: "No advanced provider values were collected; xG and event metrics remain unavailable and neutral. Do not mix providers.",
    matches: results.map((match) => ({
      matchNumber: match.matchNumber,
      fixture: `${match.homeTeam} vs ${match.awayTeam}`,
      rawScore: match.finalScore,
      adjustedPerformance: {
        nonPenaltyXgDifference: unavailable("non-penalty xG difference", generatedAt),
        scoreStateAdjustedXg: unavailable("score-state-adjusted xG", generatedAt),
        shotQualityDifference: unavailable("shot-quality difference", generatedAt),
        expectedPointsEstimate: unavailable("expected-points estimate", generatedAt),
        finishingOverperformance: unavailable("finishing overperformance", generatedAt),
        goalkeeperOverperformance: unavailable("goalkeeper overperformance", generatedAt),
        opponentAdjustedAttack: unavailable("opponent-adjusted attacking performance", generatedAt),
        opponentAdjustedDefense: unavailable("opponent-adjusted defensive performance", generatedAt),
      },
      requestedMetrics: Object.fromEntries(requestedMetrics.map((metric) => [metric, unavailable(metric, generatedAt)])),
      misleadingScorelineAssessment: misleading.get(match.matchNumber) ?? "No source-backed advanced context collected.",
      appliedToModel: false,
    })),
    warnings: ["Advanced performance data was not available from existing project-approved machine-readable sources; no xG/shot/event values were invented."],
  };
}

function buildAvailability(fixtures, generatedAt, curatedEvidence) {
  const teams = uniqueTeams(fixtures.filter((fixture) => QF_NUMBERS.includes(fixture.matchNumber)));
  const records = Array.isArray(curatedEvidence.records) ? curatedEvidence.records : [];
  return {
    datasetId: "quarter-final-player-availability-v1",
    artifactKind: "player_availability",
    generatedAt,
    teams: teams.map((team) => ({
      team,
      curatedEvidence: records.filter((record) => teamKey(record.team ?? "") === teamKey(team)),
      injuries: [],
      illnesses: [],
      suspensions: [],
      yellowCardStatus: unavailable("yellow-card status", generatedAt),
      redCardSuspensions: [],
      leftPreviousMatchInjured: [],
      expectedReturns: [],
      predictedStartingLineup: unavailable("predicted starting lineup", generatedAt),
      accumulatedTournamentMinutes: unavailable("player accumulated tournament minutes", generatedAt),
      previousSevenDaysMinutes: unavailable("previous seven days player minutes", generatedAt),
      playerStatuses: [],
      modelAdjustment: 1,
      appliedToModel: false,
      notes: records.some((record) => teamKey(record.team ?? "") === teamKey(team))
        ? "Curated human-readable availability evidence stored for review; no model adjustment applied unless validated."
        : "No official/player availability source was collected by the repository for this update; requested focus items remain unknown unless separately sourced.",
    })),
    curatedEvidencePolicy: {
      path: PATHS.curatedAvailabilityEvidence,
      supportedStatuses: ["available", "probable", "doubtful", "unavailable", "suspended", "unknown", "conflicting_reports", "available_but_not_ingested", "unavailable_from_automated_api", "collected_manually"],
      requiredFields: ["team", "player", "status", "source", "publishedAt", "collectedAt", "confidence", "notes"],
    },
    warnings: [
      "Morocco injury concerns, Belgium midfield availability, England suspension/midfield status, Norway illness reports and Swiss fitness concerns were not applied unless present in curated evidence with reliable sources.",
    ],
  };
}

function buildEnvironment(fixtures, results, generatedAt) {
  const resultByTeam = new Map(results.flatMap((match) => [
    [teamKey(match.homeTeam), match],
    [teamKey(match.awayTeam), match],
  ]));
  return {
    datasetId: "quarter-final-rest-travel-weather-v1",
    artifactKind: "rest_travel_weather",
    generatedAt,
    fixtures: fixtures.filter((fixture) => QF_NUMBERS.includes(fixture.matchNumber)).map((fixture) => {
      const homeLast = resultByTeam.get(teamKey(fixture.homeTeam));
      const awayLast = resultByTeam.get(teamKey(fixture.awayTeam));
      return {
        matchNumber: fixture.matchNumber,
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        stadium: sourceValue(fixture.venue, FIFA_API_URL, generatedAt, "official", "high", "confirmed"),
        kickoffUtc: sourceValue(fixture.utcDateTime, FIFA_API_URL, generatedAt, "official", "high", "confirmed"),
        localTimezone: unavailable("local timezone", generatedAt),
        expectedTemperature: unavailable("official match-time temperature forecast", generatedAt),
        apparentTemperature: unavailable("apparent temperature", generatedAt),
        humidity: unavailable("humidity", generatedAt),
        precipitationProbability: unavailable("precipitation probability", generatedAt),
        wind: unavailable("wind", generatedAt),
        roofOpenClosed: unavailable("roof status", generatedAt),
        surfaceType: unavailable("surface type", generatedAt),
        altitude: unavailable("altitude", generatedAt),
        hydrationBreakRisk: unavailable("hydration break risk", generatedAt),
        recovery: {
          home: recoveryRecord(homeLast, fixture, generatedAt),
          away: recoveryRecord(awayLast, fixture, generatedAt),
        },
        travel: {
          home: unavailable("travel origin/destination/distance/time-zone change", generatedAt),
          away: unavailable("travel origin/destination/distance/time-zone change", generatedAt),
        },
        weatherSensitivity: "neutral; official forecast values unavailable.",
      };
    }),
  };
}

function recoveryRecord(last, fixture, generatedAt) {
  return {
    previousMatchDate: sourceValue(last?.utcDateTime ?? null, PATHS.results, generatedAt, "official/project", last ? "high" : "low", last ? "confirmed" : "unavailable"),
    previousMatchDuration: sourceValue(last?.duration ?? null, PATHS.results, generatedAt, "official/project", last ? "high" : "low", last ? "confirmed" : "unavailable"),
    previousExtraTime: sourceValue(Boolean(last?.extraTimePlayed), PATHS.results, generatedAt, "official/project", "high", "confirmed"),
    recoveryHours: sourceValue(last ? round((Date.parse(fixture.utcDateTime) - Date.parse(last.utcDateTime)) / 3600000) : null, "computed from official kickoff times", generatedAt, "project-derived", last ? "medium" : "low", last ? "probable" : "unavailable"),
    accumulatedTeamMinutesEstimate: sourceValue(last ? 4 * 90 + last.duration.playingMinutes : null, "team-level estimate using playingMinutes, not elapsedClockMinutes; player minutes unavailable", generatedAt, "project-derived", "medium", last ? "probable" : "unavailable"),
  };
}

function buildEvaluation(previousPredictions, results, generatedAt) {
  const actualByNumber = new Map(results.map((match) => [match.matchNumber, match]));
  const rows = previousPredictions.matches.map((prediction) => {
    const actual = actualByNumber.get(prediction.matchNumber);
    const actualOutcome = outcome(actual.regulationScore.home, actual.regulationScore.away);
    return {
      matchNumber: prediction.matchNumber,
      fixture: `${actual.homeTeam} vs ${actual.awayTeam}`,
      actual: {
        regulationScore: actual.regulationScore,
        scoreAfterExtraTime: actual.scoreAfterExtraTime,
        penaltyScore: actual.penaltyScore,
        advancingTeam: actual.advancingTeam,
      },
      markov: evaluatePrediction(prediction.picks.markov.score, prediction.outcomeProbabilities, prediction.qualificationProbabilities, actual, prediction.homeTeam, prediction.awayTeam),
      monteCarlo: evaluatePrediction(prediction.picks.monteCarlo.score, prediction.outcomeProbabilities, prediction.qualificationProbabilities, actual, prediction.homeTeam, prediction.awayTeam),
      llmOnly: evaluatePrediction(prediction.picks.llmOnly.score, null, null, actual, prediction.homeTeam, prediction.awayTeam, prediction.picks.llmOnly.advancingTeam),
      errorAttribution: attributeError(prediction, actual, actualOutcome),
    };
  });
  return {
    datasetId: "round-of-16-prediction-evaluation-v1",
    artifactKind: "prediction_evaluation",
    generatedAt,
    contaminationControl: {
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      doNotUsePreviousPredictionsAsTrainingData: true,
      evaluationInputs: [PATHS.previousPredictions, PATHS.results],
    },
    summary: {
      markov: summarizeEvaluation(rows, "markov"),
      monteCarlo: summarizeEvaluation(rows, "monteCarlo"),
      llmOnly: summarizeEvaluation(rows, "llmOnly"),
    },
    matches: rows,
  };
}

function evaluatePrediction(score, probs, qualProbs, actual, homeTeam, awayTeam, overrideQualifier) {
  const predictedOutcome = outcome(score.home, score.away);
  const actualOutcome = outcome(actual.regulationScore.home, actual.regulationScore.away);
  const predictedQualifier = overrideQualifier ?? (predictedOutcome === "home_win" ? homeTeam : predictedOutcome === "away_win" ? awayTeam : (qualProbs?.home ?? 0.5) >= 0.5 ? homeTeam : awayTeam);
  return {
    selectedScore: score,
    exactScoreCorrect: score.home === actual.regulationScore.home && score.away === actual.regulationScore.away,
    outcomeCorrect: predictedOutcome === actualOutcome,
    qualificationCorrect: teamKey(predictedQualifier) === teamKey(actual.advancingTeam),
    brierScore: probs ? brier(probs, actualOutcome) : null,
    logLoss: probs ? logLoss(probs, actualOutcome) : null,
    rankedProbabilityScore: probs ? rankedProbabilityScore(probs, actualOutcome) : null,
    meanAbsoluteGoalError: (Math.abs(score.home - actual.regulationScore.home) + Math.abs(score.away - actual.regulationScore.away)) / 2,
    fantasyScore: fantasyPointsForScoreGuess({ homeGoals: score.home, awayGoals: score.away }, { homeGoals: actual.regulationScore.home, awayGoals: actual.regulationScore.away }),
  };
}

function summarizeEvaluation(rows, method) {
  const values = rows.map((row) => row[method]);
  return {
    exactScoreAccuracy: ratio(values.filter((row) => row.exactScoreCorrect).length, values.length),
    outcomeAccuracy: ratio(values.filter((row) => row.outcomeCorrect).length, values.length),
    qualificationAccuracy: ratio(values.filter((row) => row.qualificationCorrect).length, values.length),
    meanBrierScore: mean(values.map((row) => row.brierScore).filter(Number.isFinite)),
    meanLogLoss: mean(values.map((row) => row.logLoss).filter(Number.isFinite)),
    meanRankedProbabilityScore: mean(values.map((row) => row.rankedProbabilityScore).filter(Number.isFinite)),
    meanAbsoluteGoalError: mean(values.map((row) => row.meanAbsoluteGoalError)),
    meanFantasyScore: mean(values.map((row) => row.fantasyScore)),
  };
}

function attributeError(prediction, actual, actualOutcome) {
  const selectedOutcome = outcome(prediction.picks.markov.score.home, prediction.picks.markov.score.away);
  const tags = [];
  if (selectedOutcome !== actualOutcome) tags.push("90-minute outcome miss");
  if (prediction.picks.markov.advancingTeam !== actual.advancingTeam) tags.push(actual.penaltiesPlayed ? "penalties" : "qualification miss");
  if (!prediction.importantPlayerAbsences || prediction.importantPlayerAbsences.status === "unavailable") tags.push("missing contextual/player information");
  if (Math.max(prediction.outcomeProbabilities.homeWin, prediction.outcomeProbabilities.drawThrough90, prediction.outcomeProbabilities.awayWin) > 0.75 && selectedOutcome !== actualOutcome) tags.push("excessive confidence");
  return tags.length ? tags : ["score selection / finishing variance"];
}

function buildAdjustments(evaluation, performance, availability, environment, generatedAt) {
  return {
    datasetId: "quarter-final-model-adjustments-v1",
    artifactKind: "model_adjustment",
    generatedAt,
    basedOnEvaluation: PATHS.evaluation,
    contaminationControl: {
      previousPredictionsUsedForEvaluationOnly: true,
      doNotUsePreviousPredictionsAsTrainingData: true,
    },
    accepted: [
      {
        feature: "official Round of 16 advancement and residual-only score update",
        status: "accepted_with_residual_shrinkage",
        evidenceWeight: SELECTED_RESIDUAL_EVIDENCE_WEIGHT,
        reason: "Official results define quarter-final teams. Goal-score observations are used only as opponent-adjusted residuals with a small weight because xG/event data is unavailable.",
      },
    ],
    rejected: [
      "advanced xG/shot/event metrics unavailable from approved machine source",
      "player availability unavailable from reliable collected source",
      "travel/weather/altitude unavailable or unvalidated",
      "no coefficient recalibration from only eight Round of 16 matches",
      "external market consensus not collected as odds; review benchmarks stored as diagnostics only and not used as inputs",
    ],
    coefficientsChanged: false,
    scoreUpdateShrinkageWeight: SELECTED_RESIDUAL_EVIDENCE_WEIGHT,
    residualEvidenceWeight: SELECTED_RESIDUAL_EVIDENCE_WEIGHT,
    formSignalScale: FORM_SIGNAL_SCALE,
    performanceContextApplied: false,
    availabilityApplied: false,
    fatigueTravelWeatherApplied: false,
    marketBenchmark: {
      status: "diagnostic_only",
      benchmarks: Object.fromEntries(MARKET_BENCHMARKS.entries()),
      notes: "No existing project-supported market blending or odds collector; review benchmarks are not used as model inputs.",
    },
    validation: {
      previousModel: evaluation.summary.markov,
      updatedDataModel: "accepted official results and residual-only shrunk team stats",
      contextAdjustedCandidate: "neutral because requested features could not be validated from trusted machine sources",
    },
  };
}

function buildQuarterFinalTeamStats(prior, results, adjustments, generatedAt) {
  const priorByTeam = new Map(prior.teams.map((team) => [teamKey(team.team), team]));
  const qfTeams = new Set(results.map((match) => teamKey(match.advancingTeam)));
  const allPriorTeams = prior.teams;
  const priorAvgFor = average(allPriorTeams.map((team) => team.totals.goalsForPerMatch));
  const priorAvgAgainst = average(allPriorTeams.map((team) => team.totals.goalsAgainstPerMatch));
  const weight = adjustments.residualEvidenceWeight;
  const teams = [...qfTeams].map((key) => {
    const priorTeam = priorByTeam.get(key);
    const match = results.find((result) => [result.homeTeam, result.awayTeam].some((team) => teamKey(team) === key));
    const isHome = teamKey(match.homeTeam) === key;
    const opponentName = isHome ? match.awayTeam : match.homeTeam;
    const opponent = priorByTeam.get(teamKey(opponentName));
    const gf = isHome ? match.regulationScore.home : match.regulationScore.away;
    const ga = isHome ? match.regulationScore.away : match.regulationScore.home;
    const opponentDefenceRate = Math.max(opponent?.totals.goalsAgainstPerMatch ?? priorAvgAgainst, priorAvgAgainst * 0.35);
    const opponentAttackRate = Math.max(opponent?.totals.goalsForPerMatch ?? priorAvgFor, priorAvgFor * 0.35);
    const expectedForBefore = round(priorTeam.totals.goalsForPerMatch * opponentDefenceRate / Math.max(0.01, priorAvgAgainst));
    const expectedAgainstBefore = round(priorTeam.totals.goalsAgainstPerMatch * opponentAttackRate / Math.max(0.01, priorAvgFor));
    const attackResidual = round(gf - expectedForBefore);
    const defenseResidual = round(ga - expectedAgainstBefore);
    const updatedAttackRate = Math.max(0.05, priorTeam.totals.goalsForPerMatch + attackResidual * weight);
    const updatedDefensiveRate = Math.max(0.05, priorTeam.totals.goalsAgainstPerMatch + defenseResidual * weight);
    const modelPlayed = priorTeam.totals.played;
    const modelGoalsFor = updatedAttackRate * modelPlayed;
    const modelGoalsAgainst = updatedDefensiveRate * modelPlayed;
    return {
      ...priorTeam,
      roundOf16: {
        matchNumber: match.matchNumber,
        opponent: opponentName,
        regulationGoalsFor: gf,
        regulationGoalsAgainst: ga,
        advanced: true,
        extraTimePlayed: match.extraTimePlayed,
        penaltiesPlayed: match.penaltiesPlayed,
        penaltyScore: match.penaltyScore,
        playingMinutes: match.duration.playingMinutes,
        elapsedClockMinutes: match.duration.elapsedClockMinutes,
      },
      actualTotalsThroughRoundOf16: {
        played: priorTeam.totals.played + 1,
        goalsFor: priorTeam.totals.goalsFor + gf,
        goalsAgainst: priorTeam.totals.goalsAgainst + ga,
        goalDifference: priorTeam.totals.goalDifference + gf - ga,
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
        preTournamentAttackRating: priorTeam.totals.goalsForPerMatch,
        preTournamentDefenceRating: priorTeam.totals.goalsAgainstPerMatch,
        ratingBeforeRoundOf16: {
          attack: priorTeam.totals.goalsForPerMatch,
          defence: priorTeam.totals.goalsAgainstPerMatch,
          source: PATHS.priorTeamStats,
        },
        roundOf16OpponentStrength: opponent ? {
          team: opponent.team,
          attack: opponent.totals.goalsForPerMatch,
          defence: opponent.totals.goalsAgainstPerMatch,
        } : null,
        roundOf16GoalsScored: gf,
        roundOf16GoalsConceded: ga,
        expectedPerformanceBeforeUpdate: {
          goalsFor: expectedForBefore,
          goalsAgainst: expectedAgainstBefore,
        },
        rawScoreResidual: {
          attack: attackResidual,
          defence: defenseResidual,
        },
        shrinkageAppliedToResidual: {
          evidenceWeight: weight,
          attackUpdate: round(attackResidual * weight),
          defenceUpdate: round(defenseResidual * weight),
        },
        updatedAttackRating: round(updatedAttackRate),
        updatedDefenceRating: round(updatedDefensiveRate),
      },
    };
  }).sort((a, b) => a.team.localeCompare(b.team));
  return {
    datasetId: "quarter-final-team-stats-v1",
    artifactKind: "knockout_team_stats",
    generatedAt,
    sourceFiles: {
      priorTeamStats: PATHS.priorTeamStats,
      roundOf16Results: PATHS.results,
      adjustments: PATHS.adjustments,
    },
    notes: "Quarter-final teams use official advancement. Round of 16 score effects are opponent-adjusted residual updates with strong shrinkage; penalty shootout goals are excluded.",
    updatePolicy: {
      selectedEvidenceWeight: weight,
      residualFormula: "newRate = oldRate + (observed - opponentAdjustedExpected) * evidenceWeight",
      fullScoreWeightingRejected: true,
    },
    teamCount: teams.length,
    teams,
  };
}

function buildQuarterFinalPredictions(fixtures, priorTeamStats, teamStats, calibration, adjustments, generatedAt) {
  const params = {
    ...calibration.updatedParameters.markovChainScorePredictions.modelParameters,
    baseGoalsPerTeamMatch: average(priorTeamStats.teams.map((team) => team.totals.goalsForPerMatch)),
    formSignalScale: adjustments.formSignalScale,
    extraTimeScoringRate: EXTRA_TIME_SCORING_RATE,
  };
  const inputs = buildModelInputs(teamStats.teams, params);
  const byTeam = new Map(inputs.map((team) => [teamKey(team.team), team]));
  const matches = fixtures.filter((fixture) => QF_NUMBERS.includes(fixture.matchNumber)).map((fixture) => {
    const prediction = matchupPrediction(fixture.homeTeam, fixture.awayTeam, byTeam, params, 250000, 20260708 + fixture.matchNumber);
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
      ...prediction,
    };
  });
  const bracket = simulateSemifinalBracket(matches, byTeam, params, 250000);
  const modelVariants = buildModelVariants(fixtures, priorTeamStats, teamStats, calibration, adjustments, matches);
  return {
    artifactKind: "prediction",
    predictionId: "quarter-final-score-predictions-v1",
    predictionType: "quarter_final_score_predictions",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    contaminationControl: {
      builderInputPaths: [PATHS.teamStats, PATHS.calibration, PATHS.adjustments],
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      predictionDirectoryReadAsInputForPrediction: false,
    },
    method: {
      type: "quarter_final_markov_score_distribution_with_monte_carlo_progression",
      modelParameters: params,
      scoreUpdateShrinkageWeight: adjustments.scoreUpdateShrinkageWeight,
      scoreUpdateMethod: "opponent_adjusted_residual",
      formSignalScale: adjustments.formSignalScale,
      extraTimeScoringRate: EXTRA_TIME_SCORING_RATE,
      simulationsPerFixture: 250000,
      randomSeedBase: 20260708,
      fantasyScoring: "6 exact score / 3 correct outcome / +1 per exact team goal",
    },
    matches,
    semifinalBracketProbabilities: bracket,
    modelVariants,
  };
}

function buildModelVariants(fixtures, priorTeamStats, selectedTeamStats, calibration, adjustments, selectedMatches) {
  const variants = [
    { id: "original_pre_round_of_16", method: "residual", evidenceWeight: 0, formSignalScale: FORM_SIGNAL_SCALE, source: "prior team stats only" },
    { id: "current_25_percent_full_score_implementation", method: "full_score", evidenceWeight: 0.25, formSignalScale: 1, source: "deprecated diagnostic; reproduces inflated implementation" },
    { id: "corrected_residual_5_percent", method: "residual", evidenceWeight: 0.05, formSignalScale: FORM_SIGNAL_SCALE, source: "selected" },
    { id: "corrected_residual_10_percent", method: "residual", evidenceWeight: 0.10, formSignalScale: FORM_SIGNAL_SCALE, source: "sensitivity" },
    { id: "no_score_update_context_only", method: "residual", evidenceWeight: 0, formSignalScale: FORM_SIGNAL_SCALE, source: "context neutral; no score update" },
    { id: "market_blind_statistical_ensemble", method: "ensemble", evidenceWeight: 0.05, formSignalScale: FORM_SIGNAL_SCALE, source: "average of original and corrected residual statistical variants; no market input" },
  ];
  const qfFixtures = fixtures.filter((fixture) => QF_NUMBERS.includes(fixture.matchNumber));
  const priorParams = {
    ...calibration.updatedParameters.markovChainScorePredictions.modelParameters,
    baseGoalsPerTeamMatch: average(priorTeamStats.teams.map((team) => team.totals.goalsForPerMatch)),
    extraTimeScoringRate: EXTRA_TIME_SCORING_RATE,
  };
  const priorByTeam = new Map(priorTeamStats.teams.map((team) => [teamKey(team.team), team]));
  const selectedByMatch = new Map(selectedMatches.map((match) => [match.matchNumber, match]));
  return variants.map((variant) => {
    let matches;
    if (variant.method === "ensemble") {
      const base = variantPredictionRows(qfFixtures, buildVariantInputs(priorTeamStats, selectedTeamStats, 0, "residual", priorParams, variant.formSignalScale), { ...priorParams, formSignalScale: variant.formSignalScale });
      const corrected = variantPredictionRows(qfFixtures, buildVariantInputs(priorTeamStats, selectedTeamStats, 0.05, "residual", priorParams, variant.formSignalScale), { ...priorParams, formSignalScale: variant.formSignalScale });
      matches = base.map((row, index) => ensembleVariantRow(row, corrected[index], selectedByMatch.get(row.matchNumber)));
    } else {
      matches = variantPredictionRows(qfFixtures, buildVariantInputs(priorTeamStats, selectedTeamStats, variant.evidenceWeight, variant.method, priorParams, variant.formSignalScale), { ...priorParams, formSignalScale: variant.formSignalScale })
        .map((row) => ({ ...row, changeFromOriginal: changeFromOriginal(row, selectedByMatch.get(row.matchNumber)) }));
    }
    return {
      id: variant.id,
      method: variant.method,
      evidenceWeight: variant.evidenceWeight,
      source: variant.source,
      matches,
    };
  });
}

function buildVariantInputs(priorTeamStats, selectedTeamStats, evidenceWeight, method, params, formSignalScale) {
  const priorByTeam = new Map(priorTeamStats.teams.map((team) => [teamKey(team.team), team]));
  const teams = selectedTeamStats.teams.map((team) => {
    const prior = priorByTeam.get(teamKey(team.team));
    if (method === "full_score") {
      const gf = team.roundOf16.regulationGoalsFor;
      const ga = team.roundOf16.regulationGoalsAgainst;
      const played = prior.totals.played + evidenceWeight;
      const goalsFor = prior.totals.goalsFor + gf * evidenceWeight;
      const goalsAgainst = prior.totals.goalsAgainst + ga * evidenceWeight;
      return {
        ...prior,
        modelingTotals: {
          played: round(played),
          goalsFor: round(goalsFor),
          goalsAgainst: round(goalsAgainst),
          goalDifference: round(goalsFor - goalsAgainst),
          goalsForPerMatch: round(goalsFor / played),
          goalsAgainstPerMatch: round(goalsAgainst / played),
        },
      };
    }
    const attackUpdate = (team.expectedGoalTrace.rawScoreResidual.attack ?? 0) * evidenceWeight;
    const defenseUpdate = (team.expectedGoalTrace.rawScoreResidual.defence ?? 0) * evidenceWeight;
    const attack = Math.max(0.05, prior.totals.goalsForPerMatch + attackUpdate);
    const defence = Math.max(0.05, prior.totals.goalsAgainstPerMatch + defenseUpdate);
    return {
      ...prior,
      modelingTotals: {
        played: prior.totals.played,
        goalsFor: round(attack * prior.totals.played),
        goalsAgainst: round(defence * prior.totals.played),
        goalDifference: round((attack - defence) * prior.totals.played),
        goalsForPerMatch: round(attack),
        goalsAgainstPerMatch: round(defence),
      },
    };
  });
  return new Map(buildModelInputs(teams, { ...params, formSignalScale }).map((team) => [teamKey(team.team), team]));
}

function variantPredictionRows(fixtures, byTeam, params) {
  return fixtures.map((fixture) => {
    const home = required(byTeam.get(teamKey(fixture.homeTeam)), `Missing ${fixture.homeTeam}`);
    const away = required(byTeam.get(teamKey(fixture.awayTeam)), `Missing ${fixture.awayTeam}`);
    const lambdaHome = expectedGoals(home, away, params);
    const lambdaAway = expectedGoals(away, home, params);
    const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
    const metrics = calculateScoreDistributionMetrics(distribution);
    const qual = qualificationProbabilities(metrics, extraTimeModel(lambdaHome, lambdaAway, home, away, params));
    const top = metrics.topScorelines[0];
    return {
      matchNumber: fixture.matchNumber,
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
      outcomeProbabilities: { homeWin: metrics.homeWinProbability, drawThrough90: metrics.drawProbability, awayWin: metrics.awayWinProbability },
      mostProbableScore: { home: top.homeGoals, away: top.awayGoals, probability: top.probability },
      qualificationProbabilities: qual,
      totalGoalExpectation: round(metrics.expectedHomeGoals + metrics.expectedAwayGoals),
      over25Probability: round(distribution.filter((score) => score.homeGoals + score.awayGoals > 2.5).reduce((sum, score) => sum + score.probability, 0)),
      bothTeamsToScoreProbability: round(distribution.filter((score) => score.homeGoals > 0 && score.awayGoals > 0).reduce((sum, score) => sum + score.probability, 0)),
    };
  });
}

function ensembleVariantRow(a, b, selected) {
  const row = {
    matchNumber: a.matchNumber,
    fixture: a.fixture,
    expectedGoals: { home: round((a.expectedGoals.home + b.expectedGoals.home) / 2), away: round((a.expectedGoals.away + b.expectedGoals.away) / 2) },
    outcomeProbabilities: {
      homeWin: round((a.outcomeProbabilities.homeWin + b.outcomeProbabilities.homeWin) / 2),
      drawThrough90: round((a.outcomeProbabilities.drawThrough90 + b.outcomeProbabilities.drawThrough90) / 2),
      awayWin: round((a.outcomeProbabilities.awayWin + b.outcomeProbabilities.awayWin) / 2),
    },
    mostProbableScore: b.mostProbableScore,
    qualificationProbabilities: { home: round((a.qualificationProbabilities.home + b.qualificationProbabilities.home) / 2), away: round((a.qualificationProbabilities.away + b.qualificationProbabilities.away) / 2) },
    totalGoalExpectation: round((a.totalGoalExpectation + b.totalGoalExpectation) / 2),
    over25Probability: round((a.over25Probability + b.over25Probability) / 2),
    bothTeamsToScoreProbability: round((a.bothTeamsToScoreProbability + b.bothTeamsToScoreProbability) / 2),
  };
  return { ...row, changeFromOriginal: changeFromOriginal(row, selected) };
}

function changeFromOriginal(row, selected) {
  if (!selected) return null;
  return {
    expectedGoals: {
      home: round(row.expectedGoals.home - selected.expectedGoals.home),
      away: round(row.expectedGoals.away - selected.expectedGoals.away),
    },
    qualificationProbability: {
      home: round(row.qualificationProbabilities.home - selected.qualificationProbabilities.home),
      away: round(row.qualificationProbabilities.away - selected.qualificationProbabilities.away),
    },
  };
}

function matchupPrediction(homeTeam, awayTeam, byTeam, params, iterations, seed) {
  const home = required(byTeam.get(teamKey(homeTeam)), `Missing team ${homeTeam}`);
  const away = required(byTeam.get(teamKey(awayTeam)), `Missing team ${awayTeam}`);
  const lambdaHome = expectedGoals(home, away, params);
  const lambdaAway = expectedGoals(away, home, params);
  const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
  const metrics = calculateScoreDistributionMetrics(distribution);
  const extraTime = extraTimeModel(lambdaHome, lambdaAway, home, away, params);
  const top = metrics.topScorelines.map((score) => ({ ...score, expectedFantasyPoints: calculateFantasyExpectedPoints(score, distribution) }));
  const qual = qualificationProbabilities(metrics, extraTime);
  const selectedQualifier = qual.home >= qual.away ? homeTeam : awayTeam;
  const monteCarlo = monteCarloFixture(metrics, qual, homeTeam, awayTeam, iterations, seed);
  const bestFantasy = [...top].sort((a, b) => b.expectedFantasyPoints - a.expectedFantasyPoints || b.probability - a.probability)[0];
  const warningContext = {
    lambdaHome,
    lambdaAway,
    metrics,
    qual,
    top,
    home,
    away,
    homeTeam,
    awayTeam,
    market: marketComparison(homeTeam, awayTeam, qual),
  };
  const warnings = diagnosticWarnings(warningContext);
  const confidence = confidenceAssessment(metrics, qual, warnings);
  return {
    expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
    expectedGoalTrace: {
      home: fixtureTrace(home, away, params, lambdaHome),
      away: fixtureTrace(away, home, params, lambdaAway),
    },
    selectedScore: { home: top[0].homeGoals, away: top[0].awayGoals },
    mostProbableScore: scoreOut(top[0]),
    alternativeScores: top.slice(1, 5).map(scoreOut),
    topScorelines: top.map(scoreOut),
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
    monteCarlo,
    bestFantasyScore: scoreOut(bestFantasy),
    predictionStrength: confidence.predictionStrength,
    evidenceConfidence: confidence.evidenceConfidence,
    confidence: confidence.evidenceConfidence,
    uncertainty: uncertaintyLevel(metrics, qual),
    scoreDistribution: distribution,
    validation: validateDistribution(distribution, metrics, qual),
    marketComparison: warningContext.market,
    validationWarnings: warnings,
    reasoningNote: `${homeTeam} residual-updated GF/GA ${home.modelingTotals.goalsForPerMatch}-${home.modelingTotals.goalsAgainstPerMatch} vs ${awayTeam} ${away.modelingTotals.goalsForPerMatch}-${away.modelingTotals.goalsAgainstPerMatch}; Round of 16 score update uses ${SELECTED_RESIDUAL_EVIDENCE_WEIGHT * 100}% of opponent-adjusted residual only.`,
  };
}

function simulateSemifinalBracket(qfMatches, byTeam, params, iterations) {
  const rng = mulberry32(2026070801);
  const counts = new Map();
  for (let i = 0; i < iterations; i += 1) {
    const winners = qfMatches.map((match) => sampleQualifier(match, rng));
    const s1 = `${winners[0]} vs ${winners[1]}`;
    const s2 = `${winners[2]} vs ${winners[3]}`;
    increment(counts, `${s1} | ${s2}`);
  }
  return [...counts.entries()].map(([bracket, count]) => ({ bracket, probability: round(count / iterations) })).sort((a, b) => b.probability - a.probability).slice(0, 20);
}

function sampleQualifier(match, rng) {
  const roll = rng();
  return roll < match.qualificationProbabilities.home ? match.homeTeam : match.awayTeam;
}

function monteCarloFixture(metrics, qual, homeTeam, awayTeam, iterations, seed) {
  const rng = mulberry32(seed);
  let homeQual = 0;
  let awayQual = 0;
  const scoreCounts = new Map();
  for (let i = 0; i < iterations; i += 1) {
    const roll = rng();
    let qualifier;
    if (roll < qual.home) {
      qualifier = homeTeam;
      homeQual += 1;
    } else {
      qualifier = awayTeam;
      awayQual += 1;
    }
    increment(scoreCounts, qualifier);
  }
  return {
    iterations,
    seed,
    qualificationProbabilities: {
      home: round(homeQual / iterations),
      away: round(awayQual / iterations),
    },
    selectedAdvancingTeam: homeQual >= awayQual ? homeTeam : awayTeam,
  };
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

function buildReport(results, performance, availability, environment, evaluation, adjustments, predictions) {
  return [
    "# Quarter-Final Predictions",
    "",
    `Generated: ${predictions.generatedAt}`,
    "",
    "## 1. Collection Summary",
    "",
    "- Official Round of 16 results, venues, kickoff times and match duration labels collected from FIFA.",
    "- FIFA calendar endpoint did not expose lineups, cards, event data, player minutes, xG or advanced match metrics.",
    "- Availability, weather and advanced performance features are unavailable/neutral; review market benchmarks are stored only as diagnostics.",
    "",
    "## 2. Data Sources And Timestamps",
    "",
    `- FIFA calendar API: ${FIFA_API_URL}`,
    `- Collected: ${results.generatedAt}`,
    "",
    "## 3. Round Of 16 Actual Results",
    "",
    "| Match | Venue | Kickoff UTC | Result | ET | Pens | Advanced | Playing minutes | Elapsed clock |",
    "| ---: | --- | --- | --- | --- | --- | --- | ---: | ---: |",
    ...results.results.map((match) => `| ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} | ${match.venue} | ${match.utcDateTime} | ${match.regulationScore.home}-${match.regulationScore.away} | ${match.scoreAfterExtraTime ? `${match.scoreAfterExtraTime.home}-${match.scoreAfterExtraTime.away}` : ""} | ${match.penaltyScore ? `${match.penaltyScore.home}-${match.penaltyScore.away}` : ""} | ${match.advancingTeam} | ${match.duration.playingMinutes} | ${match.duration.elapsedClockMinutes ?? ""} |`),
    "",
    "## 4. Previous Prediction Backtest",
    "",
    `- Markov: exact ${percent(evaluation.summary.markov.exactScoreAccuracy)}, outcome ${percent(evaluation.summary.markov.outcomeAccuracy)}, qualification ${percent(evaluation.summary.markov.qualificationAccuracy)}, Brier ${evaluation.summary.markov.meanBrierScore}, log loss ${evaluation.summary.markov.meanLogLoss}, MAE ${evaluation.summary.markov.meanAbsoluteGoalError}, fantasy ${evaluation.summary.markov.meanFantasyScore}.`,
    `- Monte Carlo: exact ${percent(evaluation.summary.monteCarlo.exactScoreAccuracy)}, outcome ${percent(evaluation.summary.monteCarlo.outcomeAccuracy)}, qualification ${percent(evaluation.summary.monteCarlo.qualificationAccuracy)}, Brier ${evaluation.summary.monteCarlo.meanBrierScore}.`,
    `- LLM-only: exact ${percent(evaluation.summary.llmOnly.exactScoreAccuracy)}, outcome ${percent(evaluation.summary.llmOnly.outcomeAccuracy)}, qualification ${percent(evaluation.summary.llmOnly.qualificationAccuracy)}.`,
    "",
    "## 5. Underlying-Performance Analysis",
    "",
    "- Root cause corrected: the previous QF script blended 25% of the full Round of 16 score into already high tournament goals-per-match and recalculated the scoring base from only QF teams. That inflated favourite xG and qualification probabilities.",
    "- Corrected update: `newRate = oldRate + (observed - opponentAdjustedExpected) * evidenceWeight`; selected evidence weight is 5% because only final goals are available.",
    "- Form is shrunk separately from team quality to avoid double-counting tournament scoring and strength ratings.",
    "",
    "## 6. Player Availability",
    "",
    "- No reliable availability source was collected; all injury, illness, suspension and yellow-card fields are neutral/unavailable.",
    "",
    "## 7. Rest, Travel, Fatigue And Weather",
    "",
    "- Previous match duration and recovery hours are recorded. Fatigue uses playing minutes, not FIFA elapsed-clock labels. Switzerland is 120 playing minutes plus a separate shootout flag.",
    "- Travel distance, timezone change, altitude, roof/surface and official weather forecasts remain unavailable and neutral.",
    "",
    "## 8. Accepted And Rejected Model Adjustments",
    "",
    ...adjustments.accepted.map((item) => `- Accepted: ${item.feature}; ${item.reason}`),
    ...adjustments.rejected.map((item) => `- Rejected: ${item}`),
    "",
    "## 9. Quarter-Final Predictions",
    "",
    "| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Strength | Evidence |",
    "| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |",
    ...predictions.matches.map((match) => `| ${match.homeTeam} vs ${match.awayTeam} | ${match.expectedGoals.home}-${match.expectedGoals.away} | ${formatScore(match.mostProbableScore)} (${percent(match.mostProbableScore.probability)}) | ${formatScore(match.selectedScore)} | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.drawThrough90)} / ${percent(match.outcomeProbabilities.awayWin)} | ${percent(match.extraTimeProbability)} | ${percent(match.penaltyShootoutProbability.conditionalOnExtraTime)} / ${percent(match.penaltyShootoutProbability.unconditional)} | ${match.homeTeam} ${percent(match.qualificationProbabilities.home)}, ${match.awayTeam} ${percent(match.qualificationProbabilities.away)} | ${match.predictionStrength} | ${match.evidenceConfidence} |`),
    "",
    "## 10. Score Probability Matrices",
    "",
    ...predictions.matches.map((match) => `- ${match.homeTeam} vs ${match.awayTeam}: ${match.topScorelines.map((score) => `${score.home}-${score.away} ${percent(score.probability)}`).join("; ")}`),
    "",
    "## 11. Qualification Probabilities",
    "",
    ...predictions.matches.map((match) => `- ${match.homeTeam} ${percent(match.qualificationProbabilities.home)} / ${match.awayTeam} ${percent(match.qualificationProbabilities.away)}.`),
    "",
    "## 12. Sensitivity Analysis",
    "",
    "- Weather/travel/player availability sensitivity is neutral because inputs are unavailable.",
    "- Model variants compare original, deprecated 25% full-score update, corrected 5%, corrected 10%, no-score/context-only and market-blind statistical ensemble.",
    ...predictions.modelVariants.map((variant) => `- ${variant.id}: ${variant.matches.map((match) => `${match.fixture} xG ${match.expectedGoals.home}-${match.expectedGoals.away}, qual ${percent(match.qualificationProbabilities.home)}/${percent(match.qualificationProbabilities.away)}`).join("; ")}`),
    "",
    "## 13. Semifinal Bracket Simulation",
    "",
    ...predictions.semifinalBracketProbabilities.slice(0, 8).map((row) => `- ${row.bracket}: ${percent(row.probability)}`),
    "",
    "## 14. Risks And Missing Information",
    "",
    "- Largest risks: missing lineups, suspensions, player minutes, cards, xG/shot data, weather and market sanity checks.",
    "- Penalty shootout wins are separated from regulation scoring.",
    "- Validation warnings:",
    ...predictions.matches.flatMap((match) => match.validationWarnings.map((warning) => `  - ${match.homeTeam} vs ${match.awayTeam}: ${warning}`)),
    "",
    "## 15. Reproducibility Instructions",
    "",
    "- Run: `node scripts/updateAfterRoundOf16.mjs`",
    "- Validate: `npm.cmd run typecheck`",
    "",
    "## Validation",
    "",
    "- Score matrices are normalized to approximately 1.0 in JSON validation fields.",
    "- Qualification probabilities sum to 100% per fixture.",
    "- Extra-time probability equals 90-minute draw probability; penalty probability is split into conditional-on-extra-time and unconditional fields.",
    "",
  ].join("\n");
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
  const homeFromDraw = extraTime.homeWinConditionalOnExtraTime
    + extraTime.drawAfterExtraTimeConditional * extraTime.shootoutWinProbability.home;
  const homeQualifies = metrics.homeWinProbability + draw * homeFromDraw;
  return { home: round(homeQualifies), away: round(1 - homeQualifies) };
}

function marketComparison(homeTeam, awayTeam, qual) {
  const homeMarket = MARKET_BENCHMARKS.get(homeTeam);
  const awayMarket = MARKET_BENCHMARKS.get(awayTeam);
  if (!homeMarket && !awayMarket) {
    return {
      status: "unavailable",
      note: "No legally/technically collected market odds in project sources; no market input used.",
    };
  }
  const homeNormalized = homeMarket ? homeMarket.qualificationProbability : round(1 - awayMarket.qualificationProbability);
  const awayNormalized = round(1 - homeNormalized);
  return {
    status: "diagnostic_only_not_model_input",
    rawOdds: null,
    rawImpliedProbability: null,
    totalOverround: null,
    normalizedProbability: { home: homeNormalized, away: awayNormalized },
    projectProbability: { home: qual.home, away: qual.away },
    differencePercentagePoints: {
      home: round((qual.home - homeNormalized) * 100),
      away: round((qual.away - awayNormalized) * 100),
    },
    source: homeMarket?.source ?? awayMarket?.source,
    warningThresholdPercentagePoints: 10,
  };
}

function diagnosticWarnings(context) {
  const warnings = [];
  const totalXg = context.lambdaHome + context.lambdaAway;
  const market = context.market;
  if (context.lambdaHome > 3 || context.lambdaAway > 3) warnings.push("review: one team exceeds 3.0 regulation xG");
  if (totalXg > 4) warnings.push("review: total regulation xG exceeds 4.0");
  if (context.top[0]?.homeGoals >= 4 || context.top[0]?.awayGoals >= 4) warnings.push("review: most probable exact score contains four or more goals for one team");
  if (market?.differencePercentagePoints && Math.max(Math.abs(market.differencePercentagePoints.home), Math.abs(market.differencePercentagePoints.away)) > 10) warnings.push("review: project qualification probability differs from diagnostic market benchmark by more than ten percentage points");
  warnings.push("review: important lineup, fitness, player-minute and advanced match inputs are missing");
  return warnings;
}

function confidenceAssessment(metrics, qual, warnings) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const edge = Math.abs(qual.home - qual.away);
  const predictionStrength = maxOutcome >= 0.68 && edge >= 0.35 ? "High" : maxOutcome >= 0.54 || edge >= 0.2 ? "Medium" : "Low";
  const evidenceConfidence = warnings.length > 0 ? "Low" : predictionStrength === "High" ? "Medium" : predictionStrength;
  return { predictionStrength, evidenceConfidence };
}

function fixtureTrace(team, opponent, params, lambda) {
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * params.qualityMultiplierScale);
  const rawFormBlend = Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex);
  const formBlend = Math.exp(Math.log(Math.max(0.01, rawFormBlend)) * params.formSignalScale);
  return {
    team: team.team,
    originalPreTournamentAttackRating: team.expectedGoalTrace?.preTournamentAttackRating ?? team.totals.goalsForPerMatch,
    originalPreTournamentDefenceRating: team.expectedGoalTrace?.preTournamentDefenceRating ?? team.totals.goalsAgainstPerMatch,
    ratingImmediatelyBeforeRoundOf16: team.expectedGoalTrace?.ratingBeforeRoundOf16 ?? null,
    roundOf16OpponentStrength: team.expectedGoalTrace?.roundOf16OpponentStrength ?? null,
    roundOf16GoalsScored: team.expectedGoalTrace?.roundOf16GoalsScored ?? null,
    roundOf16GoalsConceded: team.expectedGoalTrace?.roundOf16GoalsConceded ?? null,
    expectedPerformanceBeforeResultUpdate: team.expectedGoalTrace?.expectedPerformanceBeforeUpdate ?? null,
    rawScoreResidual: team.expectedGoalTrace?.rawScoreResidual ?? null,
    shrinkageAppliedToResidual: team.expectedGoalTrace?.shrinkageAppliedToResidual ?? null,
    updatedAttackRating: team.expectedGoalTrace?.updatedAttackRating ?? team.modelingTotals.goalsForPerMatch,
    updatedDefenceRating: team.expectedGoalTrace?.updatedDefenceRating ?? team.modelingTotals.goalsAgainstPerMatch,
    quarterFinalOpponentAdjustment: { opponent: opponent.team, qualityMultiplier: round(qualityMultiplier), rawFormBlend: round(rawFormBlend), shrunkFormBlend: round(formBlend) },
    venueAdjustment: 1,
    contextAdjustment: 1,
    finalLogExpectedGoals: round(Math.log(Math.max(0.0001, lambda))),
    finalExpectedGoals: lambda,
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

function brier(probabilities, actualOutcome) {
  const actual = { home_win: [1, 0, 0], draw: [0, 1, 0], away_win: [0, 0, 1] }[actualOutcome];
  const predicted = [probabilities.homeWin, probabilities.drawThrough90, probabilities.awayWin];
  return round(predicted.reduce((sum, value, index) => sum + (value - actual[index]) ** 2, 0));
}

function logLoss(probabilities, actualOutcome) {
  const probability = actualOutcome === "home_win" ? probabilities.homeWin : actualOutcome === "away_win" ? probabilities.awayWin : probabilities.drawThrough90;
  return round(-Math.log(Math.max(1e-9, probability)));
}

function rankedProbabilityScore(probabilities, actualOutcome) {
  const actual = { home_win: [1, 0, 0], draw: [0, 1, 0], away_win: [0, 0, 1] }[actualOutcome];
  const predicted = [probabilities.homeWin, probabilities.drawThrough90, probabilities.awayWin];
  let score = 0;
  for (let i = 0; i < 2; i += 1) {
    score += (predicted.slice(0, i + 1).reduce((s, v) => s + v, 0) - actual.slice(0, i + 1).reduce((s, v) => s + v, 0)) ** 2;
  }
  return round(score / 2);
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
    extraTimeIsDrawProbability: true,
    penaltyProbabilityLabel: "unconditional penalty probability = regulation draw probability * extra-time draw probability",
  };
}

function confidenceLevel(metrics, qual) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const edge = Math.abs(qual.home - qual.away);
  if (maxOutcome >= 0.68 && edge >= 0.35) return "High";
  if (maxOutcome >= 0.54 || edge >= 0.2) return "Medium";
  return "Low";
}

function uncertaintyLevel(metrics, qual) {
  const edge = Math.abs(qual.home - qual.away);
  if (edge < 0.12 || metrics.drawProbability > 0.27) return "High";
  if (edge < 0.3) return "Medium";
  return "Low";
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

function unavailable(label, generatedAt) {
  return sourceValue(null, `No trusted source collected for ${label}`, generatedAt, "unavailable", "low", "unavailable");
}

function sourceValue(value, sourceUrlOrId, collectedAt, sourceType, confidence, status) {
  return { value, sourceUrlOrId, collectedAt, sourceType, confidence, status };
}

function sourceRecord(sourceUrlOrId, collectedAt, sourceType, confidence, status) {
  return { sourceUrlOrId, collectedAt, sourceType, confidence, status };
}

function uniqueTeams(fixtures) {
  return [...new Set(fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
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

function normalizeTeamName(name) {
  if (!name) return undefined;
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
}

function optionalDescription(localized) {
  return localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
}

function firstNumber(...values) {
  return values.find((value) => Number.isInteger(value));
}

function parseElapsedClockMinutes(label) {
  if (typeof label !== "string") return null;
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : null;
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

function mean(values) {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function percent(value) {
  return value === null || value === undefined ? "n/a" : `${Math.round(value * 1000) / 10}%`;
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

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonOptional(path, fallback) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
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
