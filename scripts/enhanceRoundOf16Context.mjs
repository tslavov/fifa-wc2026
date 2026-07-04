import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";
const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";

const PATHS = {
  baselinePredictions: join("data", "predictions", "round-of-16-score-predictions-v1.json"),
  round32Predictions: join("data", "predictions", "assigned-round-of-32-score-predictions-v1.json"),
  round32Comparison: join("data", "predictions", "assigned-round-of-32-method-comparison-v1.json"),
  round32Results: join("data", "results", "round-of-32-results-v1.json"),
  groupResults: join("data", "results", "group-stage-results-v1.json"),
  teamStats: join("data", "knockout", "round-of-16-team-stats-v1.json"),
  calibration: join("data", "model", "calibration-changes-after-round-of-32-v1.json"),
  teamContext: join("data", "context", "round-of-16-team-context-v1.json"),
  playerContext: join("data", "context", "round-of-16-player-availability-v1.json"),
  weatherLocation: join("data", "context", "round-of-16-weather-location-v1.json"),
  featureAdjustments: join("data", "model", "round-of-16-feature-adjustments-v1.json"),
  evaluation: join("data", "evaluation", "round-of-16-enhancement-old-vs-new-evaluation-v1.json"),
  predictions: join("data", "predictions", "round-of-16-score-predictions-enhanced-v1.json"),
  report: join("reports", "round-of-16-enhanced-predictions.md"),
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
  const [baseline, round32Predictions, round32Comparison, round32Results, groupResults, teamStats, calibration, calendar] = await Promise.all([
    readJson(PATHS.baselinePredictions),
    readJson(PATHS.round32Predictions),
    readJson(PATHS.round32Comparison),
    readJson(PATHS.round32Results),
    readJson(PATHS.groupResults),
    readJson(PATHS.teamStats),
    readJson(PATHS.calibration),
    fetchFifaCalendar(),
  ]);

  const fixtures = calendar.Results.map((match) => normalizeFixture(match, generatedAt)).sort((a, b) => a.matchNumber - b.matchNumber);
  const round16Fixtures = fixtures.filter((fixture) => fixture.matchNumber >= 89 && fixture.matchNumber <= 96);
  const round32Fixtures = fixtures.filter((fixture) => fixture.matchNumber >= 73 && fixture.matchNumber <= 88);

  const teamContext = buildTeamContext(round16Fixtures, teamStats, round32Results.results, groupResults.results, generatedAt);
  await writeJson(PATHS.teamContext, teamContext);

  const playerContext = buildPlayerContext(round16Fixtures, generatedAt);
  await writeJson(PATHS.playerContext, playerContext);

  const weatherLocation = buildWeatherLocation(round16Fixtures, generatedAt);
  await writeJson(PATHS.weatherLocation, weatherLocation);

  const evaluation = buildOldVsNewEvaluation(round32Predictions, round32Comparison, round32Results.results, groupResults.results, round32Fixtures);
  await writeJson(PATHS.evaluation, evaluation);

  const featureAdjustments = buildFeatureAdjustments(round16Fixtures, teamContext, playerContext, weatherLocation, evaluation, generatedAt);
  await writeJson(PATHS.featureAdjustments, featureAdjustments);

  const predictions = buildEnhancedPredictions(round16Fixtures, teamStats, calibration, baseline, featureAdjustments, generatedAt);
  await writeJson(PATHS.predictions, predictions);
  await writeText(PATHS.report, buildReport(predictions, featureAdjustments, evaluation, playerContext));

  console.log(`Wrote ${PATHS.teamContext}`);
  console.log(`Wrote ${PATHS.playerContext}`);
  console.log(`Wrote ${PATHS.weatherLocation}`);
  console.log(`Wrote ${PATHS.featureAdjustments}`);
  console.log(`Wrote ${PATHS.evaluation}`);
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
    homeTactics: match.Home?.Tactics ?? null,
    awayTactics: match.Away?.Tactics ?? null,
    matchStatus: match.MatchStatus,
    resultType: match.ResultType,
    weather: match.Weather ?? null,
    stadium: match.Stadium ?? null,
    fetchedAt,
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_API_URL,
  };
}

function buildTeamContext(fixtures, teamStats, round32, groupResults, generatedAt) {
  const byTeam = new Map(teamStats.teams.map((team) => [teamKey(team.team), team]));
  const lastMatchByTeam = buildLastMatchByTeam([...groupResults, ...round32.map((match) => ({
    date: match.date,
    matchNumber: match.matchNumber,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    resultType: match.resultType,
    extraTimePlayed: match.extraTimePlayed,
    finalScore: match.finalScore,
  }))]);
  const teams = [...new Set(fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]).map(teamKey))].map((key) => {
    const team = byTeam.get(key);
    const lastMatch = lastMatchByTeam.get(key);
    const nextFixture = fixtures.find((fixture) => [fixture.homeTeam, fixture.awayTeam].some((name) => teamKey(name) === key));
    return {
      team: team.team,
      sourceFiles: [PATHS.teamStats, PATHS.round32Results, PATHS.groupResults],
      collectedAt: generatedAt,
      tournamentPerformance: {
        played: team.totals.played,
        goalsFor: team.totals.goalsFor,
        goalsAgainst: team.totals.goalsAgainst,
        goalDifference: team.totals.goalDifference,
        goalsForPerMatch: team.totals.goalsForPerMatch,
        goalsAgainstPerMatch: team.totals.goalsAgainstPerMatch,
        groupPoints: team.groupStage.points,
        roundOf32Result: team.knockout.lastResult,
      },
      formSignalPolicy: "Already included in baseline team quality/form inputs; contextual form multiplier remains neutral to avoid double counting.",
      fatigue: {
        previousMatchNumber: lastMatch?.matchNumber ?? null,
        previousMatchDate: lastMatch?.date ?? null,
        nextMatchNumber: nextFixture?.matchNumber ?? null,
        nextMatchDate: nextFixture?.date ?? null,
        restDays: lastMatch && nextFixture ? daysBetween(lastMatch.date, nextFixture.date) : null,
        previousExtraTime: lastMatch?.extraTimePlayed ?? false,
        accumulatedTeamMatchMinutesEstimate: team.totals.played * 90 + (lastMatch?.extraTimePlayed ? 30 : 0),
      },
      missingFields: ["player minutes", "expected lineups", "injuries", "suspensions", "yellow-card availability", "shots", "xG", "xA", "chances created", "saves", "defensive actions"],
    };
  }).sort((a, b) => a.team.localeCompare(b.team));

  return {
    datasetId: "round-of-16-team-context-v1",
    artifactKind: "team_context",
    generatedAt,
    sourceFiles: [PATHS.teamStats, PATHS.round32Results, PATHS.groupResults],
    teams,
  };
}

function buildPlayerContext(fixtures, generatedAt) {
  return {
    datasetId: "round-of-16-player-availability-v1",
    artifactKind: "player_stats_and_availability",
    generatedAt,
    source: {
      sourceName: "Project-supported player sources",
      sourceFilesChecked: ["data/squads/squad-quality.json", "data/form/team-form.json", FIFA_API_URL],
      collectedAt: generatedAt,
    },
    fixtures: fixtures.map((fixture) => ({
      matchNumber: fixture.matchNumber,
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      expectedLineups: null,
      startingProbabilities: [],
      importantAbsences: [],
      topScorersWeighted: [],
      playerStats: [],
      missingFields: ["expected lineups", "starting probabilities", "minutes", "goals", "assists", "shots", "xG", "xA", "chances created", "saves", "defensive actions", "injuries", "suspensions", "yellow-card availability"],
    })),
    warnings: [
      "No existing trusted project source/script provides Round of 16 expected lineups, player event data, injuries, suspensions, or yellow-card availability. Multipliers are neutral for these fields.",
    ],
  };
}

function buildWeatherLocation(fixtures, generatedAt) {
  return {
    datasetId: "round-of-16-weather-location-v1",
    artifactKind: "fixture_weather_location",
    generatedAt,
    source: {
      sourceName: "Official FIFA calendar API",
      sourceUrl: FIFA_API_URL,
      collectedAt: generatedAt,
    },
    fixtures: fixtures.map((fixture) => {
      const weather = fixture.weather ?? {};
      return {
        matchId: fixture.matchId,
        matchNumber: fixture.matchNumber,
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        date: fixture.date,
        utcDateTime: fixture.utcDateTime,
        venue: fixture.venue,
        city: fixture.city,
        country: fixture.country,
        stadiumLatitude: fixture.stadium?.Latitude ?? null,
        stadiumLongitude: fixture.stadium?.Longitude ?? null,
        venueAltitudeMeters: null,
        homeTravelDistanceKm: null,
        awayTravelDistanceKm: null,
        weather: {
          temperatureC: weather.Temperature ?? null,
          humidityPct: weather.Humidity ?? null,
          windSpeed: weather.WindSpeed ?? null,
          precipitation: null,
          type: weather.Type ?? null,
          typeLocalized: optionalDescription(weather.TypeLocalized) ?? null,
        },
        missingFields: ["stadium latitude", "stadium longitude", "venue altitude", "team base locations", "travel distance", "temperature", "humidity", "wind", "precipitation"],
      };
    }),
  };
}

function buildOldVsNewEvaluation(round32Predictions, round32Comparison, round32Results, groupResults, round32Fixtures) {
  const oldRows = round32Comparison.matches;
  const resultsByNumber = new Map(round32Results.map((match) => [match.matchNumber, match]));
  const oldSummary = evaluateRound32Rows(oldRows, resultsByNumber, "markovChain");
  const candidateRows = oldRows.map((row) => {
    const fixture = round32Fixtures.find((item) => item.matchNumber === row.matchNumber);
    const homeFatigue = fatigueMultiplierForBacktest(fixture.homeTeam, fixture.date, groupResults);
    const awayFatigue = fatigueMultiplierForBacktest(fixture.awayTeam, fixture.date, groupResults);
    const adjusted = adjustExpectedGoals(row.markovChain.expectedGoals.home, row.markovChain.expectedGoals.away, homeFatigue.cappedMultiplier, awayFatigue.cappedMultiplier);
    const distribution = buildScoreDistribution(adjusted.home, adjusted.away, round32Predictions.method.modelParameters).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
    const metrics = calculateScoreDistributionMetrics(distribution);
    return {
      ...row,
      markovChain: {
        ...row.markovChain,
        selectedScore: { home: metrics.topScorelines[0].homeGoals, away: metrics.topScorelines[0].awayGoals },
        lean: leanFromProbabilities(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability),
        homeWin: metrics.homeWinProbability,
        drawThrough90: metrics.drawProbability,
        awayWin: metrics.awayWinProbability,
        expectedGoals: adjusted,
      },
      contextualBacktest: { homeFatigue, awayFatigue },
    };
  });
  const candidateSummary = evaluateRound32Rows(candidateRows, resultsByNumber, "markovChain");
  const keepFatigue = candidateSummary.ninetyMinuteOutcomeAccuracy >= oldSummary.ninetyMinuteOutcomeAccuracy
    && candidateSummary.meanBrierScore <= oldSummary.meanBrierScore
    && candidateSummary.exactScoreExpectedFantasyPoints >= oldSummary.exactScoreExpectedFantasyPoints;
  return {
    datasetId: "round-of-16-enhancement-old-vs-new-evaluation-v1",
    artifactKind: "model_evaluation",
    generatedAt: new Date().toISOString(),
    scope: "Round of 32 backtest for candidate contextual fatigue multiplier.",
    contaminationControl: {
      roundOf32PredictionsUsedForEvaluationOnly: true,
      doNotUseOldPredictionsAsModelInputs: true,
    },
    currentModel: oldSummary,
    candidateEnhancedModel: candidateSummary,
    decisions: {
      fatigueMultiplierKept: keepFatigue,
      reason: keepFatigue
        ? "Candidate did not reduce outcome accuracy, calibration, or expected fantasy points on Round of 32 backtest."
        : "Candidate failed at least one keep criterion; fatigue values are reported for Round of 16 but not applied to expected goals.",
      unavailableFeatureMultipliersKeptNeutral: ["lineup/availability", "player form", "location/travel", "weather"],
    },
  };
}

function buildFeatureAdjustments(fixtures, teamContext, playerContext, weatherLocation, evaluation, generatedAt) {
  const teamByName = new Map(teamContext.teams.map((team) => [teamKey(team.team), team]));
  const weatherByMatch = new Map(weatherLocation.fixtures.map((fixture) => [fixture.matchNumber, fixture]));
  const applyFatigue = evaluation.decisions.fatigueMultiplierKept;
  return {
    datasetId: "round-of-16-feature-adjustments-v1",
    artifactKind: "feature_adjustment",
    generatedAt,
    sourceFiles: [PATHS.teamContext, PATHS.playerContext, PATHS.weatherLocation, PATHS.evaluation],
    caps: {
      lineupAvailability: 0.15,
      form: 0.10,
      fatigue: 0.07,
      locationTravel: 0.05,
      weather: 0.04,
    },
    adjustmentPolicy: "Baseline team strength is preserved. Form is neutral because tournament performance is already in the baseline; unsourced player, availability, travel, altitude and weather fields are neutral.",
    fixtures: fixtures.map((fixture) => {
      const home = teamByName.get(teamKey(fixture.homeTeam));
      const away = teamByName.get(teamKey(fixture.awayTeam));
      const weather = weatherByMatch.get(fixture.matchNumber);
      const homeFatigue = fatigueAdjustment(home.fatigue, applyFatigue);
      const awayFatigue = fatigueAdjustment(away.fatigue, applyFatigue);
      return {
        matchNumber: fixture.matchNumber,
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        expectedLineupStrength: {
          home: { raw: null, cappedMultiplier: 1, missing: true },
          away: { raw: null, cappedMultiplier: 1, missing: true },
        },
        importantAbsences: { home: [], away: [], missing: true },
        adjustments: {
          form: neutralAdjustment("already_in_baseline", "Tournament form/performance is already used in baseline team stats to avoid double counting."),
          lineupAvailability: neutralAdjustment("missing_source", "No trusted expected lineup, injury, suspension or card source is available in the project."),
          fatigue: {
            home: homeFatigue,
            away: awayFatigue,
            applied: applyFatigue,
          },
          locationTravel: neutralAdjustment("missing_source", "FIFA calendar has venue/city but no stadium coordinates, altitude, team bases or travel distances."),
          weather: neutralAdjustment("missing_source", weather?.weather.temperatureC === null ? "FIFA calendar weather fields are null for this fixture." : "Weather present but no adjustment rule triggered."),
        },
        combinedMultiplier: {
          homeAttack: round(homeFatigue.cappedMultiplier),
          awayAttack: round(awayFatigue.cappedMultiplier),
        },
      };
    }),
    warnings: playerContext.warnings,
  };
}

function buildEnhancedPredictions(fixtures, teamStats, calibration, baseline, featureAdjustments, generatedAt) {
  const params = baseline.method.modelParameters;
  const inputs = buildModelInputs(teamStats.teams, params);
  const byTeam = new Map(inputs.map((team) => [teamKey(team.team), team]));
  const adjustmentByMatch = new Map(featureAdjustments.fixtures.map((fixture) => [fixture.matchNumber, fixture]));
  const comparisonByMatch = new Map(baseline.matches.map((match) => [match.matchNumber, match]));
  const matches = fixtures.map((fixture) => {
    const home = required(byTeam.get(teamKey(fixture.homeTeam)), `Missing team stats for ${fixture.homeTeam}`);
    const away = required(byTeam.get(teamKey(fixture.awayTeam)), `Missing team stats for ${fixture.awayTeam}`);
    const adjustment = adjustmentByMatch.get(fixture.matchNumber);
    const baseHome = expectedGoals(home, away, params);
    const baseAway = expectedGoals(away, home, params);
    const lambdaHome = round(clamp(baseHome * adjustment.combinedMultiplier.homeAttack, params.lambdaMin, params.lambdaMax));
    const lambdaAway = round(clamp(baseAway * adjustment.combinedMultiplier.awayAttack, params.lambdaMin, params.lambdaMax));
    const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
    const metrics = calculateScoreDistributionMetrics(distribution);
    const top = metrics.topScorelines.map((score) => ({ ...score, expectedFantasyPoints: calculateFantasyExpectedPoints(score, distribution) }));
    const bestFantasy = [...top].sort((a, b) => b.expectedFantasyPoints - a.expectedFantasyPoints || b.probability - a.probability)[0];
    const qual = qualificationProbabilities(metrics, home, away);
    const markovPick = qual.home >= qual.away ? fixture.homeTeam : fixture.awayTeam;
    const monteCarlo = monteCarloFixture(lambdaHome, lambdaAway, 20000, 20260704 + fixture.matchNumber, fixture.homeTeam, fixture.awayTeam);
    const llmOnly = llmPick(fixture, home, away, adjustment);
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
      baselineComparison: comparisonByMatch.get(fixture.matchNumber)?.expectedGoals ?? null,
      context: {
        expectedLineupStrength: adjustment.expectedLineupStrength,
        importantAbsences: adjustment.importantAbsences,
        adjustments: adjustment.adjustments,
      },
      adjustedExpectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
      predictedNinetyMinuteScore: { home: top[0].homeGoals, away: top[0].awayGoals },
      topScorelines: top,
      outcomeProbabilities: {
        homeWin: metrics.homeWinProbability,
        drawThrough90: metrics.drawProbability,
        awayWin: metrics.awayWinProbability,
      },
      extraTimeProbability: metrics.drawProbability,
      penaltyShootoutProbability: round(metrics.drawProbability * calibration.updatedParameters.knockoutAdvancement.penaltyShootoutConditionalOnDraw),
      qualificationProbabilities: qual,
      picks: {
        markov: { score: { home: top[0].homeGoals, away: top[0].awayGoals }, advancingTeam: markovPick },
        monteCarlo,
        llmOnly,
      },
      bestFantasyScore: {
        home: bestFantasy.homeGoals,
        away: bestFantasy.awayGoals,
        probability: bestFantasy.probability,
        expectedFantasyPoints: bestFantasy.expectedFantasyPoints,
      },
      confidence: confidenceLevel(metrics, qual),
      reasoningNote: reasoningNote(fixture, adjustment, metrics, qual),
    };
  });
  return {
    artifactKind: "prediction",
    predictionId: "round-of-16-score-predictions-enhanced-v1",
    predictionType: "round_of_16_context_enhanced_score_predictions",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    contaminationControl: {
      builderInputPaths: [PATHS.baselinePredictions, PATHS.teamStats, PATHS.featureAdjustments],
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      predictionDirectoryReadAsInputForPrediction: false,
    },
    method: {
      baseline: PATHS.baselinePredictions,
      type: "baseline_markov_with_sourced_contextual_capped_multipliers",
      modelParameters: params,
      note: "Only sourced and backtest-kept contextual multipliers are applied. Missing contextual fields are neutral.",
    },
    matches,
  };
}

function buildReport(predictions, adjustments, evaluation, playerContext) {
  return [
    "# Enhanced Round of 16 Predictions",
    "",
    `Generated: ${predictions.generatedAt}`,
    "",
    "## Context Coverage",
    "",
    "- Team tournament performance and rest/fatigue context collected from existing results artifacts.",
    "- Player stats, expected lineups, injuries, suspensions, card availability, travel distance, altitude and match-time weather were unavailable from trusted project/FIFA sources and left neutral.",
    `- Fatigue multiplier kept: ${evaluation.decisions.fatigueMultiplierKept ? "yes" : "no"} (${evaluation.decisions.reason})`,
    "",
    "## Old vs Enhanced Round of 32 Backtest",
    "",
    `- Current Markov: outcome ${percent(evaluation.currentModel.ninetyMinuteOutcomeAccuracy)}, Brier ${evaluation.currentModel.meanBrierScore}, xFP ${evaluation.currentModel.exactScoreExpectedFantasyPoints}.`,
    `- Candidate enhanced: outcome ${percent(evaluation.candidateEnhancedModel.ninetyMinuteOutcomeAccuracy)}, Brier ${evaluation.candidateEnhancedModel.meanBrierScore}, xFP ${evaluation.candidateEnhancedModel.exactScoreExpectedFantasyPoints}.`,
    "",
    "## Picks",
    "",
    "| Match | Adjusted xG | Top five | W/D/L | ET | Pens | Qualify | Markov | Monte Carlo | LLM-only | Fantasy | Confidence | Context |",
    "| ---: | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |",
    ...predictions.matches.map((match) => `| ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} | ${match.adjustedExpectedGoals.home}-${match.adjustedExpectedGoals.away} | ${match.topScorelines.map(formatTop).join("; ")} | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.drawThrough90)} / ${percent(match.outcomeProbabilities.awayWin)} | ${percent(match.extraTimeProbability)} | ${percent(match.penaltyShootoutProbability)} | ${match.homeTeam} ${percent(match.qualificationProbabilities.home)}, ${match.awayTeam} ${percent(match.qualificationProbabilities.away)} | ${formatScore(match.picks.markov.score)} ${match.picks.markov.advancingTeam} | ${formatScore(match.picks.monteCarlo.score)} ${match.picks.monteCarlo.advancingTeam} | ${formatScore(match.picks.llmOnly.score)} ${match.picks.llmOnly.advancingTeam} | ${formatScore(match.bestFantasyScore)} xFP ${match.bestFantasyScore.expectedFantasyPoints} | ${match.confidence} | lineup neutral; absences none sourced; form neutral; fatigue ${match.context.adjustments.fatigue.applied ? "applied" : "neutral"}; location/weather neutral. |`),
    "",
    "## Missing Player Data",
    "",
    ...playerContext.warnings.map((warning) => `- ${warning}`),
    "",
  ].join("\n");
}

function buildLastMatchByTeam(matches) {
  const byTeam = new Map();
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      const key = teamKey(normalizeTeamName(team));
      const current = byTeam.get(key);
      if (!current || (match.date ?? "") > (current.date ?? "")) byTeam.set(key, match);
    }
  }
  return byTeam;
}

function fatigueMultiplierForBacktest(team, nextDate, groupResults) {
  const teamMatches = groupResults.filter((match) => [match.homeTeam, match.awayTeam].some((name) => teamKey(name) === teamKey(team)));
  const last = [...teamMatches].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  const restDays = last ? daysBetween(last.date, nextDate) : null;
  return fatigueMultiplierFromValues(restDays, false, true);
}

function fatigueAdjustment(fatigue, apply) {
  return fatigueMultiplierFromValues(fatigue.restDays, fatigue.previousExtraTime, apply);
}

function fatigueMultiplierFromValues(restDays, previousExtraTime, apply) {
  const restPenalty = restDays === null ? 0 : Math.max(0, 4 - restDays) * -0.015;
  const extraTimePenalty = previousExtraTime ? -0.03 : 0;
  const raw = round(restPenalty + extraTimePenalty);
  const capped = clamp(raw, -0.07, 0.07);
  return {
    raw,
    capped,
    cappedMultiplier: apply ? round(1 + capped) : 1,
    restDays,
    previousExtraTime,
    source: "official fixture dates and result type",
  };
}

function neutralAdjustment(reason, evidence) {
  return { raw: 0, capped: 0, cappedMultiplier: 1, reason, evidence };
}

function evaluateRound32Rows(rows, actualByNumber, method) {
  const evaluated = rows.map((row) => {
    const actual = actualByNumber.get(row.matchNumber);
    const pick = row[method];
    const actual90 = actual.ninetyMinuteScore;
    const actualOutcome = actual90 ? outcome(actual90.home, actual90.away) : null;
    const predictedOutcome = outcome(pick.selectedScore.home, pick.selectedScore.away);
    return {
      exact: actual90 ? sameScore(pick.selectedScore, actual90) : null,
      outcome: actualOutcome ? predictedOutcome === actualOutcome : null,
      brier: actualOutcome ? brier({ homeWin: pick.homeWin, drawThrough90: pick.drawThrough90, awayWin: pick.awayWin }, actualOutcome) : null,
      fantasy: actual90 ? fantasyPointsForScoreGuess({ homeGoals: pick.selectedScore.home, awayGoals: pick.selectedScore.away }, { homeGoals: actual90.home, awayGoals: actual90.away }) : null,
    };
  });
  const exactRows = evaluated.filter((row) => row.exact !== null);
  const outcomeRows = evaluated.filter((row) => row.outcome !== null);
  const brierRows = evaluated.filter((row) => row.brier !== null);
  const fantasyRows = evaluated.filter((row) => row.fantasy !== null);
  return {
    exactScoreAccuracy: ratio(exactRows.filter((row) => row.exact).length, exactRows.length),
    ninetyMinuteOutcomeAccuracy: ratio(outcomeRows.filter((row) => row.outcome).length, outcomeRows.length),
    meanBrierScore: brierRows.length ? round(brierRows.reduce((sum, row) => sum + row.brier, 0) / brierRows.length) : null,
    exactScoreExpectedFantasyPoints: round(fantasyRows.reduce((sum, row) => sum + row.fantasy, 0) / fantasyRows.length),
    evaluatedFixtures: outcomeRows.length,
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

function expectedGoals(team, opponent, params) {
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * params.qualityMultiplierScale);
  const formBlend = Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex);
  return round(clamp(params.baseGoalRateMultiplier * params.baseGoalsPerTeamMatch * formBlend * qualityMultiplier, params.lambdaMin, params.lambdaMax));
}

function adjustExpectedGoals(home, away, homeMultiplier, awayMultiplier) {
  return { home: round(home * homeMultiplier), away: round(away * awayMultiplier) };
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

function monteCarloFixture(lambdaHome, lambdaAway, iterations, seed, homeTeam, awayTeam) {
  const rng = mulberry32(seed);
  const counts = new Map();
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  for (let index = 0; index < iterations; index += 1) {
    const home = poisson(lambdaHome, rng);
    const away = poisson(lambdaAway, rng);
    if (home > away) homeWins += 1;
    else if (away > home) awayWins += 1;
    else draws += 1;
    const key = `${home}-${away}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [scoreKey] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const [home, away] = scoreKey.split("-").map(Number);
  const homeWin = homeWins / iterations;
  const awayWin = awayWins / iterations;
  return {
    score: { home, away },
    homeWin: round(homeWin),
    drawThrough90: round(draws / iterations),
    awayWin: round(awayWin),
    advancingTeam: homeWin >= awayWin ? homeTeam : awayTeam,
  };
}

function llmPick(fixture, home, away, adjustment) {
  const homeScore = home.qualityScore + home.totals.goalDifference / 20;
  const awayScore = away.qualityScore + away.totals.goalDifference / 20;
  const advancingTeam = homeScore >= awayScore ? fixture.homeTeam : fixture.awayTeam;
  const score = advancingTeam === fixture.homeTeam
    ? { home: homeScore - awayScore > 0.25 ? 2 : 1, away: homeScore - awayScore > 0.25 ? 0 : 1 }
    : { home: awayScore - homeScore > 0.25 ? 0 : 1, away: awayScore - homeScore > 0.25 ? 2 : 1 };
  return {
    score,
    advancingTeam,
    rationale: `Qualitative pick uses baseline team quality and tournament totals only; player/availability/weather fields are neutral because unsourced. Fatigue applied: ${adjustment.adjustments.fatigue.applied}.`,
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

function confidenceLevel(metrics, qual) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const qualEdge = Math.abs(qual.home - qual.away);
  if (maxOutcome >= 0.68 && qualEdge >= 0.35) return "High";
  if (maxOutcome >= 0.54 || qualEdge >= 0.2) return "Medium";
  return "Low";
}

function reasoningNote(fixture, adjustment, metrics, qual) {
  const lean = qual.home >= qual.away ? fixture.homeTeam : fixture.awayTeam;
  return `${lean} by adjusted distribution; sourced context changes are ${adjustment.adjustments.fatigue.applied ? "fatigue only" : "neutral"} with player, travel and weather fields missing.`;
}

function formatTop(score) {
  return `${score.homeGoals}-${score.awayGoals} ${percent(score.probability)}`;
}

function formatScore(score) {
  return `${score.home}-${score.away}`;
}

function leanFromProbabilities(homeWin, draw, awayWin) {
  if (homeWin >= draw && homeWin >= awayWin) return "home";
  if (awayWin >= homeWin && awayWin >= draw) return "away";
  return "draw/extra-time risk";
}

function sameScore(a, b) {
  return a.home === b.home && a.away === b.away;
}

function daysBetween(start, end) {
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
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

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percent(value) {
  return value === null || value === undefined ? "" : `${Math.round(value * 1000) / 10}%`;
}

function optionalDescription(localized) {
  return localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
}

function normalizeTeamName(name) {
  if (!name) return undefined;
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
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
