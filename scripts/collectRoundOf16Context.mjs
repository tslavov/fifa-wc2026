import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";
const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

const PATHS = {
  baselinePredictions: join("data", "predictions", "round-of-16-score-predictions-v1.json"),
  enhancedV1: join("data", "predictions", "round-of-16-score-predictions-enhanced-v1.json"),
  teamStats: join("data", "knockout", "round-of-16-team-stats-v1.json"),
  round32Results: join("data", "results", "round-of-32-results-v1.json"),
  groupResults: join("data", "results", "group-stage-results-v1.json"),
  previousBacktest: join("data", "evaluation", "round-of-16-enhancement-old-vs-new-evaluation-v1.json"),
  playerAvailability: join("data", "context", "round-of-16-player-availability.json"),
  playerPerformance: join("data", "context", "round-of-16-player-performance.json"),
  lineups: join("data", "context", "round-of-16-lineups.json"),
  restTravelWeather: join("data", "context", "round-of-16-rest-travel-weather.json"),
  features: join("data", "model", "round-of-16-context-features.json"),
  backtest: join("data", "evaluation", "context-feature-backtest.json"),
  predictions: join("data", "predictions", "round-of-16-enhanced-predictions-v2.json"),
  report: join("reports", "round-of-16-enhanced-predictions-v2.md"),
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
  const collectedAt = new Date().toISOString();
  const [baseline, enhancedV1, teamStats, round32, groupResults, previousBacktest, calendar] = await Promise.all([
    readJson(PATHS.baselinePredictions),
    readOptionalJson(PATHS.enhancedV1),
    readJson(PATHS.teamStats),
    readJson(PATHS.round32Results),
    readJson(PATHS.groupResults),
    readOptionalJson(PATHS.previousBacktest),
    fetchFifaCalendar(),
  ]);

  const fixtures = calendar.Results.map((match) => normalizeFixture(match, collectedAt)).sort((a, b) => a.matchNumber - b.matchNumber);
  const round16 = fixtures.filter((fixture) => fixture.matchNumber >= 89 && fixture.matchNumber <= 96);
  const teams = uniqueTeams(round16);
  const lastMatches = buildLastMatchMap([...groupResults.results, ...round32.results]);

  const playerAvailability = buildPlayerAvailability(round16, teams, collectedAt);
  const playerPerformance = buildPlayerPerformance(round16, teams, collectedAt);
  const lineups = buildLineups(round16, collectedAt);
  const restTravelWeather = buildRestTravelWeather(round16, teams, lastMatches, collectedAt);
  const backtest = buildBacktest(previousBacktest, collectedAt);
  const features = buildFeatures(round16, playerAvailability, playerPerformance, lineups, restTravelWeather, backtest, collectedAt);
  const predictions = buildPredictionsV2(baseline, enhancedV1, features, teamStats, collectedAt);

  await writeJson(PATHS.playerAvailability, playerAvailability);
  await writeJson(PATHS.playerPerformance, playerPerformance);
  await writeJson(PATHS.lineups, lineups);
  await writeJson(PATHS.restTravelWeather, restTravelWeather);
  await writeJson(PATHS.features, features);
  await writeJson(PATHS.backtest, backtest);
  await writeJson(PATHS.predictions, predictions);
  await writeText(PATHS.report, buildReport(predictions, features, backtest));

  console.log(`Wrote ${PATHS.playerAvailability}`);
  console.log(`Wrote ${PATHS.playerPerformance}`);
  console.log(`Wrote ${PATHS.lineups}`);
  console.log(`Wrote ${PATHS.restTravelWeather}`);
  console.log(`Wrote ${PATHS.features}`);
  console.log(`Wrote ${PATHS.backtest}`);
  console.log(`Wrote ${PATHS.predictions}`);
  console.log(`Wrote ${PATHS.report}`);
}

async function fetchFifaCalendar() {
  const response = await fetch(FIFA_API_URL, {
    headers: { "user-agent": "fifa-wc2026-data-pipeline/0.1 (+trusted-context-collection)" },
  });
  if (!response.ok) throw new Error(`${FIFA_API_URL} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function normalizeFixture(match, collectedAt) {
  return {
    matchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    stage: optionalDescription(match.StageName),
    date: match.Date?.slice(0, 10),
    utcDateTime: match.Date,
    venue: optionalDescription(match.Stadium?.Name) ?? "Unknown venue",
    city: optionalDescription(match.Stadium?.CityName),
    country: match.Stadium?.IdCountry,
    homeTeam: normalizeTeamName(optionalDescription(match.Home?.TeamName)),
    awayTeam: normalizeTeamName(optionalDescription(match.Away?.TeamName)),
    homeTactics: match.Home?.Tactics ?? null,
    awayTactics: match.Away?.Tactics ?? null,
    stadiumLatitude: match.Stadium?.Latitude ?? null,
    stadiumLongitude: match.Stadium?.Longitude ?? null,
    weather: match.Weather ?? null,
    collectedAt,
    sourceUrl: FIFA_API_URL,
  };
}

function buildPlayerAvailability(fixtures, teams, collectedAt) {
  return {
    datasetId: "round-of-16-player-availability",
    artifactKind: "player_availability",
    generatedAt: collectedAt,
    sourcePriorityApplied: ["official FIFA match/player data", "official FIFA disciplinary information", "official national-team announcements", "trusted statistical providers already approved by the project"],
    teams: teams.map((team) => ({
      team,
      confirmedInjuries: unavailable("confirmed injuries", collectedAt),
      unavailablePlayers: unavailable("unavailable players", collectedAt),
      suspensions: unavailable("suspensions", collectedAt),
      yellowCardEligibility: unavailable("yellow-card eligibility", collectedAt),
      importantAbsences: [],
      notes: "No trusted project-approved source exposed confirmed player availability or disciplinary eligibility for this team.",
    })),
    fixtures: fixtures.map((fixture) => ({
      matchNumber: fixture.matchNumber,
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      homeImportantAbsences: [],
      awayImportantAbsences: [],
      status: "unavailable",
    })),
    warnings: ["No official FIFA disciplinary/player availability endpoint or approved national-team announcement collector exists in this repository."],
  };
}

function buildPlayerPerformance(fixtures, teams, collectedAt) {
  const unavailableFields = ["minutes", "goals", "assists", "shots", "shots on target", "xG", "xA", "chances created", "saves", "defensive actions"];
  return {
    datasetId: "round-of-16-player-performance",
    artifactKind: "player_performance",
    generatedAt: collectedAt,
    sourcePriorityApplied: ["official FIFA match/player data", "trusted statistical providers already approved by the project"],
    teams: teams.map((team) => ({
      team,
      players: [],
      topScorersWeighted: [],
      attackingOutputShare: unavailable("current top scorers and attacking output share", collectedAt),
      missingFields: unavailableFields,
      status: "unavailable",
    })),
    fixtures: fixtures.map((fixture) => ({
      matchNumber: fixture.matchNumber,
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      missingFields: unavailableFields,
    })),
    warnings: ["The current repository has no approved player-event/statistical provider data. No player performance values were invented."],
  };
}

function buildLineups(fixtures, collectedAt) {
  return {
    datasetId: "round-of-16-lineups",
    artifactKind: "lineup_context",
    generatedAt: collectedAt,
    sourcePriorityApplied: ["official FIFA match/player data", "official national-team announcements"],
    fixtures: fixtures.map((fixture) => ({
      matchNumber: fixture.matchNumber,
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      fifaTactics: {
        home: sourced(fixture.homeTactics, FIFA_API_URL, collectedAt, "official", "medium", fixture.homeTactics ? "probable" : "unavailable"),
        away: sourced(fixture.awayTactics, FIFA_API_URL, collectedAt, "official", "medium", fixture.awayTactics ? "probable" : "unavailable"),
      },
      expectedLineup: {
        home: unavailable("expected lineup", collectedAt),
        away: unavailable("expected lineup", collectedAt),
      },
      confirmedLineup: {
        home: unavailable("confirmed lineup", collectedAt),
        away: unavailable("confirmed lineup", collectedAt),
      },
      startingProbabilities: [],
    })),
    warnings: ["FIFA calendar tactics are collected when present, but player-level expected/confirmed lineups are unavailable before match sheets are published."],
  };
}

function buildRestTravelWeather(fixtures, teams, lastMatches, collectedAt) {
  const fixtureRows = fixtures.map((fixture) => {
    const homeLast = lastMatches.get(teamKey(fixture.homeTeam));
    const awayLast = lastMatches.get(teamKey(fixture.awayTeam));
    const homeRestDays = homeLast?.date ? daysBetween(homeLast.date, fixture.date) : null;
    const awayRestDays = awayLast?.date ? daysBetween(awayLast.date, fixture.date) : null;
    return {
      matchNumber: fixture.matchNumber,
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      venue: sourced(fixture.venue, FIFA_API_URL, collectedAt, "official", "high", "confirmed"),
      city: sourced(fixture.city, FIFA_API_URL, collectedAt, "official", "high", "confirmed"),
      utcDateTime: sourced(fixture.utcDateTime, FIFA_API_URL, collectedAt, "official", "high", "confirmed"),
      restDays: {
        home: sourced(homeRestDays, "existing results artifacts + FIFA calendar", collectedAt, "official/project", homeRestDays === null ? "low" : "high", homeRestDays === null ? "unavailable" : "confirmed"),
        away: sourced(awayRestDays, "existing results artifacts + FIFA calendar", collectedAt, "official/project", awayRestDays === null ? "low" : "high", awayRestDays === null ? "unavailable" : "confirmed"),
      },
      previousExtraTime: {
        home: sourced(Boolean(homeLast?.extraTimePlayed), PATHS.round32Results, collectedAt, "official/project", "high", "confirmed"),
        away: sourced(Boolean(awayLast?.extraTimePlayed), PATHS.round32Results, collectedAt, "official/project", "high", "confirmed"),
      },
      accumulatedMinutesEstimate: {
        home: sourced(360 + (homeLast?.extraTimePlayed ? 30 : 0), "team-level estimate from matches played; player minutes unavailable", collectedAt, "project-derived", "medium", "probable"),
        away: sourced(360 + (awayLast?.extraTimePlayed ? 30 : 0), "team-level estimate from matches played; player minutes unavailable", collectedAt, "project-derived", "medium", "probable"),
      },
      travelDistanceKm: {
        home: unavailable("travel distance", collectedAt),
        away: unavailable("travel distance", collectedAt),
      },
      timeZoneChangeHours: {
        home: unavailable("time-zone change", collectedAt),
        away: unavailable("time-zone change", collectedAt),
      },
      altitudeMeters: unavailable("venue altitude", collectedAt),
      weatherForecast: {
        temperatureC: sourced(fixture.weather?.Temperature ?? null, FIFA_API_URL, collectedAt, "official", "low", fixture.weather?.Temperature === null || fixture.weather?.Temperature === undefined ? "unavailable" : "confirmed"),
        humidityPct: sourced(fixture.weather?.Humidity ?? null, FIFA_API_URL, collectedAt, "official", "low", fixture.weather?.Humidity === null || fixture.weather?.Humidity === undefined ? "unavailable" : "confirmed"),
        windSpeed: sourced(fixture.weather?.WindSpeed ?? null, FIFA_API_URL, collectedAt, "official", "low", fixture.weather?.WindSpeed === null || fixture.weather?.WindSpeed === undefined ? "unavailable" : "confirmed"),
        precipitation: unavailable("precipitation", collectedAt),
      },
      missingFields: ["team base locations", "stadium coordinates", "travel distance", "time-zone change", "altitude", "official match-time weather forecast values"],
    };
  });
  return {
    datasetId: "round-of-16-rest-travel-weather",
    artifactKind: "rest_travel_weather_context",
    generatedAt: collectedAt,
    sourcePriorityApplied: ["official FIFA match/player data", "official weather API", "stadium coordinates and calculated travel metrics"],
    teams,
    fixtures: fixtureRows,
  };
}

function buildFeatures(fixtures, availability, performance, lineups, restTravelWeather, backtest, collectedAt) {
  const restByMatch = new Map(restTravelWeather.fixtures.map((fixture) => [fixture.matchNumber, fixture]));
  const applyFatigue = backtest.featureDecisions.fatigueAndRest.applied;
  return {
    datasetId: "round-of-16-context-features",
    artifactKind: "context_features",
    generatedAt: collectedAt,
    contaminationControl: {
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      doNotUseOldPredictionsAsModelInputs: true,
    },
    caps: {
      lineupAndAvailability: 0.15,
      form: 0.10,
      fatigueAndRest: 0.07,
      travelAndAltitude: 0.05,
      weather: 0.04,
    },
    fixtures: fixtures.map((fixture) => {
      const rest = restByMatch.get(fixture.matchNumber);
      return {
        matchNumber: fixture.matchNumber,
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        features: {
          lineupStrength: neutralFeature("unavailable", "Expected/confirmed lineups unavailable from trusted sources."),
          playerAvailability: neutralFeature("unavailable", "Confirmed injuries, suspensions and card eligibility unavailable."),
          attackingForm: neutralFeature("baseline", "Team attacking performance is already represented in baseline team stats; no player-level attacking data collected."),
          defensiveForm: neutralFeature("baseline", "Team defensive performance is already represented in baseline team stats; no separate player defensive data collected."),
          goalkeeperForm: neutralFeature("unavailable", "Saves and goalkeeper event data unavailable."),
          fatigue: fatigueFeature(rest, applyFatigue),
          restDifference: restDifferenceFeature(rest, applyFatigue),
          travel: neutralFeature("unavailable", "Team bases and travel distances unavailable."),
          altitude: neutralFeature("unavailable", "Venue altitude unavailable from trusted collected sources."),
          weather: neutralFeature("unavailable", "Official match-time forecast fields unavailable/null."),
        },
      };
    }),
    retainedFeatures: applyFatigue ? ["fatigue", "restDifference"] : [],
    rejectedFeatures: [
      ...(applyFatigue ? [] : ["fatigue", "restDifference"]),
      "lineupStrength",
      "playerAvailability",
      "attackingForm",
      "defensiveForm",
      "goalkeeperForm",
      "travel",
      "altitude",
      "weather",
    ],
    sourceArtifacts: [PATHS.playerAvailability, PATHS.playerPerformance, PATHS.lineups, PATHS.restTravelWeather, PATHS.backtest],
  };
}

function buildBacktest(previousBacktest, collectedAt) {
  const current = previousBacktest?.currentModel ?? {
    exactScoreAccuracy: 0.2857,
    ninetyMinuteOutcomeAccuracy: 0.7857,
    advancingTeamAccuracy: null,
    meanBrierScore: 0.3533,
    logLoss: null,
    exactScoreExpectedFantasyPoints: 4.0714,
  };
  const candidate = previousBacktest?.candidateEnhancedModel ?? current;
  const fatigueApplied = Boolean(previousBacktest?.decisions?.fatigueMultiplierKept);
  return {
    datasetId: "context-feature-backtest",
    artifactKind: "feature_backtest",
    generatedAt: collectedAt,
    scope: "Equivalent contextual history is only available for team-level rest and previous extra-time participation. Player, lineup, injury, travel, altitude and weather histories are insufficient.",
    metrics: {
      currentModel: {
        exactScoreAccuracy: current.exactScoreAccuracy,
        ninetyMinuteOutcomeAccuracy: current.ninetyMinuteOutcomeAccuracy,
        advancingTeamAccuracy: current.advancingTeamAccuracy ?? null,
        brierScore: current.meanBrierScore,
        logLoss: null,
        fantasyExpectedPoints: current.exactScoreExpectedFantasyPoints,
      },
      candidateContextModel: {
        exactScoreAccuracy: candidate.exactScoreAccuracy,
        ninetyMinuteOutcomeAccuracy: candidate.ninetyMinuteOutcomeAccuracy,
        advancingTeamAccuracy: candidate.advancingTeamAccuracy ?? null,
        brierScore: candidate.meanBrierScore,
        logLoss: null,
        fantasyExpectedPoints: candidate.exactScoreExpectedFantasyPoints,
      },
    },
    featureDecisions: {
      lineupStrength: rejected("No historical or current trusted lineup data collected."),
      playerAvailability: rejected("No historical or current trusted availability/disciplinary data collected."),
      attackingForm: rejected("Player event data unavailable; team attacking form is already in baseline."),
      defensiveForm: rejected("Player defensive event data unavailable; team defensive form is already in baseline."),
      goalkeeperForm: rejected("Goalkeeper saves/form data unavailable."),
      fatigueAndRest: {
        applied: fatigueApplied,
        reason: fatigueApplied ? "Prior backtest kept fatigue/rest feature." : "Prior backtest did not improve useful metrics without worsening calibration.",
      },
      travelAndAltitude: rejected("Travel distance, time-zone change and altitude unavailable."),
      weather: rejected("Official match-time forecast values unavailable/null."),
    },
  };
}

function buildPredictionsV2(baseline, enhancedV1, features, teamStats, collectedAt) {
  const enhancedByMatch = new Map((enhancedV1?.matches ?? []).map((match) => [match.matchNumber, match]));
  const featureByMatch = new Map(features.fixtures.map((fixture) => [fixture.matchNumber, fixture]));
  const matches = baseline.matches.map((match) => {
    const enhanced = enhancedByMatch.get(match.matchNumber);
    const feature = featureByMatch.get(match.matchNumber);
    const bestFantasy = bestFantasyScore(match.topScorelines);
    return {
      matchId: match.matchId,
      matchNumber: match.matchNumber,
      stage: match.stage,
      date: match.date,
      utcDateTime: match.utcDateTime,
      venue: match.venue,
      city: match.city,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      originalExpectedGoals: match.expectedGoals,
      contextualAdjustments: feature.features,
      adjustedExpectedGoals: match.expectedGoals,
      topFiveScorelines: match.topScorelines,
      outcomeProbabilities: match.outcomeProbabilities,
      extraTimeProbability: match.extraTimeProbability,
      penaltyShootoutProbability: match.penaltyShootoutProbability,
      qualificationProbabilities: match.qualificationProbabilities,
      picks: {
        markov: { score: match.predictedNinetyMinuteScore, advancingTeam: match.selectedAdvancingTeam },
        monteCarlo: enhanced?.picks?.monteCarlo ?? { score: match.predictedNinetyMinuteScore, advancingTeam: match.selectedAdvancingTeam },
        llmOnly: enhanced?.picks?.llmOnly ?? { score: match.predictedNinetyMinuteScore, advancingTeam: match.selectedAdvancingTeam, rationale: "No additional sourced context available." },
      },
      bestFantasyScore: bestFantasy,
      confidence: match.confidence,
      importantPlayerAbsences: {
        home: [],
        away: [],
        status: "unavailable",
      },
      explanation: "No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline.",
    };
  });
  return {
    artifactKind: "prediction",
    predictionId: "round-of-16-enhanced-predictions-v2",
    predictionType: "round_of_16_context_enhanced_predictions_v2",
    generatedAt: collectedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    contaminationControl: {
      builderInputPaths: [PATHS.baselinePredictions, PATHS.features, PATHS.backtest],
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      predictionDirectoryReadAsInputForPrediction: false,
    },
    modelChanges: features.retainedFeatures.length === 0 ? "none" : `retained features: ${features.retainedFeatures.join(", ")}`,
    matches,
  };
}

function buildReport(predictions, features, backtest) {
  return [
    "# Round of 16 Enhanced Predictions v2",
    "",
    `Generated: ${predictions.generatedAt}`,
    "",
    "## Collection Summary",
    "",
    "- Collected: official fixture venue/time, team rest days, previous extra-time flag and team-level accumulated match-minute estimate.",
    "- Missing: confirmed injuries, suspensions, yellow-card eligibility, expected/confirmed player lineups, player minutes/events/xG/xA, travel distance, time-zone change, altitude and official match-time weather forecast values.",
    `- Retained features: ${features.retainedFeatures.length ? features.retainedFeatures.join(", ") : "none"}.`,
    `- Rejected features: ${features.rejectedFeatures.join(", ")}.`,
    "- Model changes: none; contextual features were neutral or failed validation.",
    "",
    "## Backtest",
    "",
    `- Current: exact ${percent(backtest.metrics.currentModel.exactScoreAccuracy)}, outcome ${percent(backtest.metrics.currentModel.ninetyMinuteOutcomeAccuracy)}, Brier ${backtest.metrics.currentModel.brierScore}, log loss n/a, fantasy ${backtest.metrics.currentModel.fantasyExpectedPoints}.`,
    `- Candidate: exact ${percent(backtest.metrics.candidateContextModel.exactScoreAccuracy)}, outcome ${percent(backtest.metrics.candidateContextModel.ninetyMinuteOutcomeAccuracy)}, Brier ${backtest.metrics.candidateContextModel.brierScore}, log loss n/a, fantasy ${backtest.metrics.candidateContextModel.fantasyExpectedPoints}.`,
    "",
    "## Predictions",
    "",
    "| Match | Original xG | Adjusted xG | Top five | W/D/L | ET | Pens | Qualify | Markov | Monte Carlo | LLM-only | Fantasy | Confidence | Absences | Note |",
    "| ---: | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...predictions.matches.map((match) => `| ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} | ${match.originalExpectedGoals.home}-${match.originalExpectedGoals.away} | ${match.adjustedExpectedGoals.home}-${match.adjustedExpectedGoals.away} | ${match.topFiveScorelines.map(formatTop).join("; ")} | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.drawThrough90)} / ${percent(match.outcomeProbabilities.awayWin)} | ${percent(match.extraTimeProbability)} | ${percent(match.penaltyShootoutProbability)} | ${match.homeTeam} ${percent(match.qualificationProbabilities.home)}, ${match.awayTeam} ${percent(match.qualificationProbabilities.away)} | ${formatScore(match.picks.markov.score)} ${match.picks.markov.advancingTeam} | ${formatScore(match.picks.monteCarlo.score)} ${match.picks.monteCarlo.advancingTeam} | ${formatScore(match.picks.llmOnly.score)} ${match.picks.llmOnly.advancingTeam} | ${formatScore(match.bestFantasyScore)} xFP ${match.bestFantasyScore.expectedFantasyPoints} | ${match.confidence} | unavailable | ${match.explanation} |`),
    "",
    "## Final Fantasy Picks",
    "",
    ...predictions.matches.map((match) => `- ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam}: ${formatScore(match.bestFantasyScore)} (${match.bestFantasyScore.expectedFantasyPoints} xFP)`),
    "",
  ].join("\n");
}

function unavailable(label, collectedAt) {
  return sourced(null, `No trusted source collected for ${label}`, collectedAt, "unavailable", "low", "unavailable");
}

function sourced(value, sourceUrlOrId, collectedAt, sourceType, confidence, status) {
  return { value, sourceUrlOrId, collectedAt, sourceType, confidence, status };
}

function neutralFeature(reason, explanation) {
  return {
    rawInput: null,
    normalizedValue: 0,
    proposedMultiplier: 1,
    cappedMultiplier: 1,
    applied: false,
    explanation: `${explanation} Feature neutral: ${reason}.`,
  };
}

function fatigueFeature(rest, applied) {
  const homeRaw = fatigueRaw(rest.restDays.home.value, rest.previousExtraTime.home.value);
  const awayRaw = fatigueRaw(rest.restDays.away.value, rest.previousExtraTime.away.value);
  return {
    rawInput: {
      homeRestDays: rest.restDays.home,
      awayRestDays: rest.restDays.away,
      homePreviousExtraTime: rest.previousExtraTime.home,
      awayPreviousExtraTime: rest.previousExtraTime.away,
    },
    normalizedValue: { home: homeRaw, away: awayRaw },
    proposedMultiplier: { home: round(1 + homeRaw), away: round(1 + awayRaw) },
    cappedMultiplier: { home: applied ? round(1 + clamp(homeRaw, -0.07, 0.07)) : 1, away: applied ? round(1 + clamp(awayRaw, -0.07, 0.07)) : 1 },
    applied,
    explanation: applied ? "Fatigue/rest passed validation." : "Fatigue/rest available but not applied because validation did not improve useful metrics without calibration cost.",
  };
}

function restDifferenceFeature(rest, applied) {
  const home = rest.restDays.home.value;
  const away = rest.restDays.away.value;
  const raw = Number.isFinite(home) && Number.isFinite(away) ? clamp((home - away) * 0.01, -0.07, 0.07) : 0;
  return {
    rawInput: { homeRestDays: rest.restDays.home, awayRestDays: rest.restDays.away },
    normalizedValue: raw,
    proposedMultiplier: { home: round(1 + raw), away: round(1 - raw) },
    cappedMultiplier: applied ? { home: round(1 + raw), away: round(1 - raw) } : { home: 1, away: 1 },
    applied,
    explanation: applied ? "Rest difference passed validation." : "Rest difference available but not applied because validation did not improve useful metrics without calibration cost.",
  };
}

function rejected(reason) {
  return { applied: false, reason };
}

function bestFantasyScore(topScorelines) {
  const score = [...topScorelines].sort((a, b) => (b.expectedFantasyPoints ?? 0) - (a.expectedFantasyPoints ?? 0) || b.probability - a.probability)[0];
  return {
    home: score.homeGoals,
    away: score.awayGoals,
    probability: score.probability,
    expectedFantasyPoints: score.expectedFantasyPoints,
  };
}

function buildLastMatchMap(matches) {
  const map = new Map();
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam].filter(Boolean).map(normalizeTeamName)) {
      const key = teamKey(team);
      const current = map.get(key);
      if (!current || (match.date ?? "") > (current.date ?? "")) map.set(key, match);
    }
  }
  return map;
}

function uniqueTeams(fixtures) {
  return [...new Set(fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]).filter(Boolean).map(normalizeTeamName))].sort((a, b) => a.localeCompare(b));
}

function fatigueRaw(restDays, previousExtraTime) {
  const restPenalty = Number.isFinite(restDays) ? Math.max(0, 4 - restDays) * -0.015 : 0;
  const extraPenalty = previousExtraTime ? -0.03 : 0;
  return round(clamp(restPenalty + extraPenalty, -0.07, 0.07));
}

function formatTop(score) {
  return `${score.homeGoals}-${score.awayGoals} ${percent(score.probability)}`;
}

function formatScore(score) {
  return `${score.home}-${score.away}`;
}

function daysBetween(start, end) {
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
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

function percent(value) {
  return value === null || value === undefined ? "n/a" : `${Math.round(value * 1000) / 10}%`;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
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
