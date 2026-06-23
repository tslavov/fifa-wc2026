import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";
const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";
const PREDICTIONS_DIR = normalize(join("data", "predictions"));

const PATHS = {
  groups: "fifa-world-cup-2026-groups.md",
  rules: join("data", "rules", "world-cup-2026-rules.json"),
  teamStrength: join("data", "model-input", "team-strength.json"),
  recentForm: join("data", "model-input", "recent-form.json"),
  previousFirstRoundReport: join("reports", "world-cup-2026-first-round-score-predictions.md"),
  previousMarkovV1: join("data", "predictions", "group-stage-markov-chain-v1.json"),
  previousMatchday2: join("data", "predictions", "matchday-2-score-predictions-v2-after-matchday-1.json"),
  previousMonteCarlo: join("data", "predictions", "group-stage-monte-carlo-v2-after-matchday-1.json"),
  results: join("data", "results", "group-stage-matchday-1-and-2-results-v1.json"),
  metrics: join("data", "model", "group-performance-metrics-after-matchday-2.json"),
  evaluation: join("data", "evaluation", "prediction-performance-after-matchday-2.json"),
  adjustments: join("data", "model", "algorithm-adjustments-after-matchday-2.json"),
  predictions: join("data", "predictions", "group-stage-matchday-3-score-predictions-v1.json"),
  report: join("reports", "group-stage-matchday-3-predictions.md"),
};

const aliases = new Map();
function addAlias(canonical, names) {
  for (const name of names) aliases.set(teamKey(name), canonical);
}
addAlias("United States", ["USA", "United States", "United States of America"]);
addAlias("South Korea", ["South Korea", "Korea Republic"]);
addAlias("Iran", ["Iran", "IR Iran"]);
addAlias("Ivory Coast", ["Ivory Coast", "Cote d'Ivoire", "Cote d Ivoire"]);
addAlias("DR Congo", ["DR Congo", "Congo DR", "Democratic Republic of Congo", "Congo Democratic Republic"]);
addAlias("Cape Verde", ["Cape Verde", "Cabo Verde"]);
addAlias("Czechia", ["Czechia", "Czech Republic"]);
addAlias("Turkey", ["Turkey", "Turkiye"]);
addAlias("Curacao", ["Curacao", "Curaçao"]);
addAlias("Bosnia and Herzegovina", ["Bosnia and Herzegovina", "Bosnia-Herzegovina"]);

const baseV2Parameters = {
  baseGoalRateMultiplier: 0.9923,
  qualityMultiplierScale: 0.6285,
  lambdaMin: 0.15,
  lambdaMax: 4.25,
  stepsPerMatch: 90,
  pruneProbabilityBelow: 1e-14,
};

const v2ScoreSelection = {
  nearEqualRelativeBand: 0.05,
  nearEqualAbsoluteProbabilityBand: 0.03,
  higherScoreTiebreak: true,
  strongerTeamTiebreak: true,
  saferDrawFallback: true,
};

const v3ScoreSelection = {
  nearEqualRelativeBand: 0.02,
  nearEqualAbsoluteProbabilityBand: 0.015,
  higherScoreTiebreak: false,
  strongerTeamTiebreak: true,
  saferDrawFallback: true,
  defaultToMostProbableScore: true,
};

async function main() {
  const generatedAt = new Date().toISOString();
  assertNoPredictionInputs([PATHS.groups, PATHS.rules, PATHS.teamStrength, PATHS.recentForm]);

  const [groups, rules, teamStrength, recentForm, firstRoundReport, previousMarkov, previousMatchday2, previousMonteCarlo] = await Promise.all([
    readFile(PATHS.groups, "utf8").then(parseGroups),
    readJson(PATHS.rules).then(parseRules),
    readJson(PATHS.teamStrength),
    readJson(PATHS.recentForm),
    readFile(PATHS.previousFirstRoundReport, "utf8"),
    readJson(PATHS.previousMarkovV1),
    readJson(PATHS.previousMatchday2),
    readJson(PATHS.previousMonteCarlo).catch(() => undefined),
  ]);

  const fifaCalendar = await fetchFifaCalendar();
  const fixtures = fifaCalendar.Results.filter((match) => match.MatchNumber >= 1 && match.MatchNumber <= 72).map((match) => normalizeFixture(match, generatedAt));
  const resultsOutput = buildResultsOutput(fixtures, generatedAt);
  await writeJson(PATHS.results, resultsOutput);

  const metrics = buildPerformanceMetrics(groups, rules, resultsOutput, teamStrength.rows, recentForm.rows, generatedAt);
  await writeJson(PATHS.metrics, metrics);

  const selectedPredictions = new Map([
    ...parseSelectedPredictions(firstRoundReport),
    ...previousMatchday2.matches.map((match) => [fixtureKey(match.group, match.homeTeam, match.awayTeam), {
      home: match.selectedPredictedScore.home,
      away: match.selectedPredictedScore.away,
      source: PATHS.previousMatchday2,
    }]),
  ]);
  const markovPredictions = new Map([
    ...extractMostProbableFromMarkov(previousMarkov),
    ...previousMatchday2.matches.map((match) => [fixtureKey(match.group, match.homeTeam, match.awayTeam), {
      home: match.mostProbableScore.home,
      away: match.mostProbableScore.away,
      expectedGoals: match.expectedGoals,
      outcomeProbabilities: match.outcomeProbabilities,
      source: PATHS.previousMatchday2,
    }]),
  ]);
  const evaluation = buildEvaluation(resultsOutput, selectedPredictions, markovPredictions, previousMonteCarlo, metrics, generatedAt);
  await writeJson(PATHS.evaluation, evaluation);

  const adjustments = buildAlgorithmAdjustments(evaluation, generatedAt);
  await writeJson(PATHS.adjustments, adjustments);

  const predictionArtifact = buildMatchday3Predictions(fixtures, groups, metrics, teamStrength.rows, recentForm.rows, adjustments, generatedAt);
  await writeJson(PATHS.predictions, predictionArtifact);
  await writeText(PATHS.report, buildReport(resultsOutput, metrics, evaluation, adjustments, predictionArtifact));

  console.log(`Wrote ${PATHS.results}`);
  console.log(`Wrote ${PATHS.metrics}`);
  console.log(`Wrote ${PATHS.evaluation}`);
  console.log(`Wrote ${PATHS.adjustments}`);
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
  const homeTeam = normalizeTeamName(description(match.Home?.TeamName));
  const awayTeam = normalizeTeamName(description(match.Away?.TeamName));
  const homeScore = firstNumber(match.HomeTeamScore, match.Home?.Score);
  const awayScore = firstNumber(match.AwayTeamScore, match.Away?.Score);
  const status = statusLabel(match);
  return {
    matchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    group: groupLetter(description(match.GroupName)),
    round: "group_stage",
    matchday: matchdayFromMatchNumber(match.MatchNumber),
    date: match.Date.slice(0, 10),
    utcDateTime: match.Date,
    localDateTime: match.LocalDate,
    venue: optionalDescription(match.Stadium?.Name) ?? "Unknown venue",
    city: optionalDescription(match.Stadium?.CityName),
    country: match.Stadium?.IdCountry,
    homeTeam,
    awayTeam,
    teamA: homeTeam,
    teamB: awayTeam,
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_API_URL,
    fetchedAt,
    officialStatus: {
      matchStatus: match.MatchStatus,
      resultType: match.ResultType,
      officialityStatus: match.OfficialityStatus,
      statusLabel: status,
    },
    ...(isOfficialFinal(match) ? {
      finalScore: { home: homeScore, away: awayScore, teamA: homeScore, teamB: awayScore },
      outcome: outcome(homeScore, awayScore),
      goalDifference: homeScore - awayScore,
    } : {
      status,
      ...(Number.isInteger(homeScore) && Number.isInteger(awayScore) ? { scoreAtFetch: { home: homeScore, away: awayScore, teamA: homeScore, teamB: awayScore } } : {}),
    }),
  };
}

function buildResultsOutput(fixtures, generatedAt) {
  const scope = fixtures.filter((fixture) => fixture.matchNumber >= 1 && fixture.matchNumber <= 48).sort((a, b) => a.matchNumber - b.matchNumber);
  const results = scope.filter((fixture) => fixture.finalScore);
  const incompleteFixtures = scope.filter((fixture) => !fixture.finalScore);
  return {
    datasetId: "group-stage-matchday-1-and-2-results-v1",
    artifactKind: "collected_results",
    generatedAt,
    source: {
      sourceName: "FIFA World Cup 2026 scores and fixtures",
      sourceUrl: FIFA_SCORES_URL,
      sourceApiUrl: FIFA_API_URL,
      fetchedAt: generatedAt,
      notes: "Official FIFA match calendar API. Matchdays 1 and 2 selected by official match numbers 1-48.",
    },
    matchdayDefinition: {
      round: "group_stage",
      includedMatchdays: [1, 2],
      expectedFixtureCount: 48,
      fixtureSelector: "FIFA match numbers 1-48",
    },
    completionStatus: {
      expectedFixtures: 48,
      completedFixtures: results.length,
      incompleteFixtures: incompleteFixtures.length,
      allMatchday1And2FixturesFinal: incompleteFixtures.length === 0,
    },
    results,
    incompleteFixtures,
    warnings: incompleteFixtures.length === 0 ? [] : [`FIFA official feed had ${incompleteFixtures.length} Matchday 1-2 fixtures not final at fetch time; downstream metrics use only official finals.`],
  };
}

function buildPerformanceMetrics(groups, rules, resultsOutput, strengthRows, formRows, generatedAt) {
  const strengthByTeam = new Map(strengthRows.map((row) => [teamKey(row.team), row]));
  const formByTeam = new Map(formRows.map((row) => [teamKey(row.team), row]));
  const rows = new Map();
  for (const group of groups) {
    for (const team of group.teams) {
      const strength = strengthByTeam.get(teamKey(team));
      const form = formByTeam.get(teamKey(team));
      rows.set(teamKey(team), {
        team,
        countryCode: strength?.countryCode,
        group: group.group,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        goalsForPerMatch: 0,
        goalsAgainstPerMatch: 0,
        pointsPerMatch: 0,
        cleanSheets: 0,
        failedToScore: 0,
        tournamentForm: [],
        modelRelevantIndicators: {
          fifaRank: strength?.fifaRank,
          fifaPoints: strength?.fifaPoints,
          eloRank: strength?.eloRank,
          eloRating: strength?.eloRating,
          recentFormPointsRate: form ? round(form.formPoints / (form.matchesPlayed * 3)) : undefined,
          recentGoalsForPerMatch: form?.goalsForPerMatch,
          recentGoalsAgainstPerMatch: form?.goalsAgainstPerMatch,
        },
      });
    }
  }

  for (const result of resultsOutput.results) {
    const home = rows.get(teamKey(result.homeTeam));
    const away = rows.get(teamKey(result.awayTeam));
    if (!home || !away) continue;
    applyTeamResult(home, result.finalScore.home, result.finalScore.away, result.awayTeam, rules);
    applyTeamResult(away, result.finalScore.away, result.finalScore.home, result.homeTeam, rules);
  }

  const groupStandings = groups.map((group) => {
    const standings = group.teams.map((team) => finalizeTeamMetric(rows.get(teamKey(team)))).sort(compareStandings).map((row, index) => ({ position: index + 1, ...row }));
    return { group: group.group, standings };
  });

  return {
    datasetId: "group-performance-metrics-after-matchday-2",
    artifactKind: "model_metrics",
    generatedAt,
    sourceResultFile: PATHS.results,
    contaminationControl: {
      builderInputPaths: [PATHS.results, PATHS.teamStrength, PATHS.recentForm, PATHS.groups, PATHS.rules],
      predictionDirectoryReadAsInput: false,
      notes: "Metrics use collected official results and existing collected model inputs only; previous predictions are not used.",
    },
    scope: {
      completedMatchday1And2Fixtures: resultsOutput.results.length,
      incompleteMatchday1And2Fixtures: resultsOutput.incompleteFixtures.length,
    },
    groupStandings,
    teamMetrics: groupStandings.flatMap((group) => group.standings),
  };
}

function buildEvaluation(resultsOutput, selectedPredictions, markovPredictions, previousMonteCarlo, metrics, generatedAt) {
  const evaluated = resultsOutput.results.map((result) => {
    const selected = getOrientedPrediction(selectedPredictions, result);
    const markov = getOrientedPrediction(markovPredictions, result);
    return {
      matchId: result.matchId,
      matchNumber: result.matchNumber,
      group: result.group,
      matchday: result.matchday,
      homeTeam: result.homeTeam,
      awayTeam: result.awayTeam,
      actualScore: { home: result.finalScore.home, away: result.finalScore.away },
      actualOutcome: result.outcome,
      llmOnlyOrSelectedScore: selected ? scoreEvaluation(selected, result) : undefined,
      markovMostProbableScore: markov ? scoreEvaluation(markov, result) : undefined,
      expectedGoalsAtPredictionTime: markov?.expectedGoals,
      predictionSources: {
        selectedScore: selected?.source,
        markovMostProbableScore: markov?.source,
      },
    };
  });
  const selectedRows = evaluated.flatMap((row) => row.llmOnlyOrSelectedScore ? [row.llmOnlyOrSelectedScore] : []);
  const markovRows = evaluated.flatMap((row) => row.markovMostProbableScore ? [row.markovMostProbableScore] : []);
  const monteCarlo = evaluateMonteCarlo(previousMonteCarlo, metrics);
  return {
    datasetId: "prediction-performance-after-matchday-2",
    artifactKind: "evaluation",
    generatedAt,
    sourceResultFile: PATHS.results,
    predictionSources: {
      firstRoundSelectedScoreReport: PATHS.previousFirstRoundReport,
      matchday2SelectedScorePrediction: PATHS.previousMatchday2,
      firstRoundMarkovChainPrediction: PATHS.previousMarkovV1,
      matchday2MarkovChainPrediction: PATHS.previousMatchday2,
      monteCarloAfterMatchday1: PATHS.previousMonteCarlo,
    },
    contaminationControl: {
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      doNotUsePreviousPredictionsAsTrainingData: true,
      notes: "Previous predictions are compared with official results only. They are not joined into team metrics or feature inputs.",
    },
    evaluatedFixtureCount: evaluated.length,
    incompleteMatchday1And2FixtureCount: resultsOutput.incompleteFixtures.length,
    summary: {
      llmOnlyOrSelectedScore: summarizeScoreEvaluations(selectedRows),
      markovMostProbableScore: summarizeScoreEvaluations(markovRows),
      monteCarloGroupSimulation: monteCarlo,
      actualGoalsPerMatch: round(resultsOutput.results.reduce((sum, result) => sum + result.finalScore.home + result.finalScore.away, 0) / Math.max(1, resultsOutput.results.length)),
      actualDrawRate: round(resultsOutput.results.filter((result) => result.outcome === "draw").length / Math.max(1, resultsOutput.results.length)),
    },
    methodNotes: {
      llmOnlyOrSelectedScore: "This is the report-selected score. In the existing project, LLM reasoning explains and sanity-checks model outputs rather than acting as a separate numeric model.",
      markovMostProbableScore: "For Matchday 1, this uses v1 Markov fixture distributions; for Matchday 2, it uses the post-Matchday-1 score artifact's most probable score.",
      monteCarloGroupSimulation: "Monte Carlo is evaluated as group-table positioning/progression signal, not exact score prediction.",
    },
    matches: evaluated,
  };
}

function buildAlgorithmAdjustments(evaluation, generatedAt) {
  const markov = evaluation.summary.markovMostProbableScore;
  const selected = evaluation.summary.llmOnlyOrSelectedScore;
  const actualGoals = evaluation.summary.actualGoalsPerMatch;
  const predictedGoals = markov.averagePredictedGoalsPerMatch ?? actualGoals;
  const evidenceWeight = Math.min(0.25, evaluation.evaluatedFixtureCount / 144);
  const baseGoalRateMultiplier = round(clamp(baseV2Parameters.baseGoalRateMultiplier * (1 + ((actualGoals / Math.max(0.01, predictedGoals)) - 1) * evidenceWeight), baseV2Parameters.baseGoalRateMultiplier * 0.95, baseV2Parameters.baseGoalRateMultiplier * 1.05));
  const qualityMultiplierScale = round(clamp(baseV2Parameters.qualityMultiplierScale * (selected.outcomeHitRate < 0.45 ? 0.97 : 1), baseV2Parameters.qualityMultiplierScale * 0.95, baseV2Parameters.qualityMultiplierScale * 1.05));
  return {
    datasetId: "algorithm-adjustments-after-matchday-2",
    artifactKind: "model_adjustment",
    generatedAt,
    basedOnEvaluation: PATHS.evaluation,
    contaminationControl: {
      previousPredictionArtifactsUsedForEvaluationOnly: true,
      doNotUsePreviousPredictionsAsTrainingData: true,
      notes: "The adjustment uses aggregate calibration diagnostics only; no previous predicted scores become team features.",
    },
    evidenceWeight,
    previousParameters: {
      markovMonteCarlo: baseV2Parameters,
      scoreSelection: v2ScoreSelection,
      qualitativeOverlay: { llmWeight: 0 },
    },
    updatedParameters: {
      llmOnlyPredictions: {
        llmWeight: 0,
        change: "unchanged",
        rationale: "The project already treats LLM reasoning as explanation only. The evaluation does not justify adding an unsourced numeric LLM layer.",
      },
      monteCarloGroupSimulations: {
        conditionOnCompletedMatchday1And2Results: true,
        modelParameterChanges: {
          baseGoalRateMultiplier,
          qualityMultiplierScale,
        },
        rationale: "Conditioning on official completed results is necessary for current standings. Numeric moves remain global and capped because two team-level observations are still sparse.",
      },
      markovChainScorePredictions: {
        modelParameters: {
          ...baseV2Parameters,
          baseGoalRateMultiplier,
          qualityMultiplierScale,
        },
        scoreSelection: v3ScoreSelection,
        rationale: "Exact-score and outcome performance showed the earlier high-scoring near-equal override was too aggressive. Matchday 3 selected scores default to the probability leader unless an alternative is nearly indistinguishable.",
      },
    },
    changes: [
      {
        area: "LLM-only predictions",
        status: "unchanged",
        explanation: "No invented squad, lineup, injury, weather, tactical, xG, or market signal is introduced; LLM remains narrative only.",
      },
      {
        area: "Monte Carlo group simulations",
        status: "small_adjustment",
        explanation: "Simulations should start from official Matchday 1-2 standings and use the same capped global goal/quality calibration as Markov.",
      },
      {
        area: "Markov-chain score predictions",
        status: "small_adjustment",
        explanation: "The score-selection override is tightened and global goal/quality parameters move only within a small cap.",
      },
    ],
  };
}

function buildMatchday3Predictions(fixtures, groups, metrics, strengthRows, formRows, adjustments, generatedAt) {
  const matchday3 = fixtures.filter((fixture) => fixture.matchday === 3).sort((a, b) => a.matchNumber - b.matchNumber);
  const params = adjustments.updatedParameters.markovChainScorePredictions.modelParameters;
  const teamInputs = buildTeamInputs(groups, strengthRows, formRows, params);
  const byTeam = new Map(teamInputs.map((row) => [teamKey(row.team), row]));
  const metricByTeam = new Map(metrics.teamMetrics.map((row) => [teamKey(row.team), row]));
  const matches = matchday3.map((fixture) => {
    const home = byTeam.get(teamKey(fixture.homeTeam));
    const away = byTeam.get(teamKey(fixture.awayTeam));
    if (!home || !away) throw new Error(`Missing model input for ${fixture.homeTeam} vs ${fixture.awayTeam}`);
    const lambdaHome = expectedGoals(home, away, params);
    const lambdaAway = expectedGoals(away, home, params);
    const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
    const metricsForScore = calculateScoreDistributionMetrics(distribution);
    const fantasyScoredTopScorelines = metricsForScore.topScorelines.map((score) => ({
      ...score,
      expectedFantasyPoints: calculateFantasyExpectedPoints(score, distribution),
    }));
    const mostProbable = fantasyScoredTopScorelines[0];
    const expectedPointsScore = [...fantasyScoredTopScorelines].sort(
      (a, b) => b.expectedFantasyPoints - a.expectedFantasyPoints || b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals,
    )[0];
    const selected = mostProbable;
    const confidence = confidenceLevel(metricsForScore);
    const fantasyReason = reasonForFantasyDifference(mostProbable, expectedPointsScore);
    return {
      matchId: fixture.matchId,
      matchNumber: fixture.matchNumber,
      group: fixture.group,
      matchday: 3,
      date: fixture.date,
      utcDateTime: fixture.utcDateTime,
      localDateTime: fixture.localDateTime,
      venue: fixture.venue,
      city: fixture.city,
      country: fixture.country,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      selectedScore: { home: selected.homeGoals, away: selected.awayGoals },
      selectedMostProbableScore: {
        home: mostProbable.homeGoals,
        away: mostProbable.awayGoals,
        probability: mostProbable.probability,
        expectedFantasyPoints: mostProbable.expectedFantasyPoints,
      },
      selectedExpectedPointsScore: {
        home: expectedPointsScore.homeGoals,
        away: expectedPointsScore.awayGoals,
        probability: expectedPointsScore.probability,
        expectedFantasyPoints: expectedPointsScore.expectedFantasyPoints,
      },
      expectedPoints: expectedPointsScore.expectedFantasyPoints,
      reasonForDifference: fantasyReason,
      mostProbableScore: { home: mostProbable.homeGoals, away: mostProbable.awayGoals },
      selectedScoreProbability: selected.probability,
      mostProbableScoreProbability: mostProbable.probability,
      topScorelines: fantasyScoredTopScorelines,
      outcomeProbabilities: {
        homeWin: metricsForScore.homeWinProbability,
        draw: metricsForScore.drawProbability,
        awayWin: metricsForScore.awayWinProbability,
      },
      expectedGoals: {
        home: metricsForScore.expectedHomeGoals,
        away: metricsForScore.expectedAwayGoals,
      },
      confidenceLevel: confidence,
      currentGroupContext: {
        home: compactTeamContext(metricByTeam.get(teamKey(fixture.homeTeam))),
        away: compactTeamContext(metricByTeam.get(teamKey(fixture.awayTeam))),
      },
      reasoningNote: reasoningNote(fixture, metricsForScore, metricByTeam),
    };
  });
  return {
    artifactKind: "prediction",
    predictionId: "group-stage-matchday-3-score-predictions-v1",
    predictionType: "matchday_3_score_predictions_after_matchday_2",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    doNotUseAsCollectedData: true,
    contaminationControl: {
      outputDirectory: PREDICTIONS_DIR,
      builderInputPaths: [PATHS.results, PATHS.metrics, PATHS.adjustments, PATHS.teamStrength, PATHS.recentForm, PATHS.groups, PATHS.rules],
      predictionDirectoryReadAsInputForPrediction: false,
      predictionDirectoryReadForEvaluationOnly: true,
      notes: "Previous prediction artifacts were used only to build the evaluation file. Matchday 3 score generation uses official results, current metrics, algorithm adjustments, and collected model inputs.",
    },
    basedOnData: {
      results: { path: PATHS.results },
      performanceMetrics: { path: PATHS.metrics },
      algorithmAdjustments: { path: PATHS.adjustments },
      teamStrength: { path: PATHS.teamStrength },
      recentForm: { path: PATHS.recentForm },
      officialFixtureApi: FIFA_API_URL,
    },
    method: {
      type: "v3_markov_score_distribution_after_matchday_2",
      modelParameters: adjustments.updatedParameters.markovChainScorePredictions.modelParameters,
      scoreSelection: adjustments.updatedParameters.markovChainScorePredictions.scoreSelection,
      noInventedInputs: true,
      unavailableInputsOmitted: ["injuries", "lineups", "weather forecast", "xG", "market odds", "squad changes", "coach/tactics"],
    },
    scope: {
      includedMatchdays: [3],
      fixtureSelector: "FIFA match numbers 49-72",
      completedMatchday1And2ResultsUsed: true,
    },
    matches,
  };
}

function buildReport(results, metrics, evaluation, adjustments, predictions) {
  const lines = [
    "# Group Stage Matchday 3 Predictions",
    "",
    `Generated: ${predictions.generatedAt}`,
    "",
    "## Data Update",
    "",
    `- Official Matchday 1-2 finals collected: ${results.completionStatus.completedFixtures}/${results.completionStatus.expectedFixtures}.`,
    `- Result source: ${FIFA_SCORES_URL}`,
    `- Current standings and team metrics: \`${PATHS.metrics}\``,
    "",
    "## Performance So Far",
    "",
    `- Selected/LLM-explained exact-score hits: ${evaluation.summary.llmOnlyOrSelectedScore.exactScoreHits}/${evaluation.summary.llmOnlyOrSelectedScore.evaluatedFixtures} (${percent(evaluation.summary.llmOnlyOrSelectedScore.exactScoreHitRate)}).`,
    `- Selected/LLM-explained outcome hits: ${evaluation.summary.llmOnlyOrSelectedScore.outcomeHits}/${evaluation.summary.llmOnlyOrSelectedScore.evaluatedFixtures} (${percent(evaluation.summary.llmOnlyOrSelectedScore.outcomeHitRate)}).`,
    `- Markov most-probable exact-score hits: ${evaluation.summary.markovMostProbableScore.exactScoreHits}/${evaluation.summary.markovMostProbableScore.evaluatedFixtures} (${percent(evaluation.summary.markovMostProbableScore.exactScoreHitRate)}).`,
    `- Markov most-probable outcome hits: ${evaluation.summary.markovMostProbableScore.outcomeHits}/${evaluation.summary.markovMostProbableScore.evaluatedFixtures} (${percent(evaluation.summary.markovMostProbableScore.outcomeHitRate)}).`,
    `- Team-goals hit rate, selected/Markov: ${percent(evaluation.summary.llmOnlyOrSelectedScore.teamGoalsHitRate)} / ${percent(evaluation.summary.markovMostProbableScore.teamGoalsHitRate)}.`,
    `- Monte Carlo after-MD1 top-two coverage against current standings: ${percent(evaluation.summary.monteCarloGroupSimulation.actualTopTwoCoveredByPredictedTopTwoRate)}.`,
    "",
    "## Algorithm Changes",
    "",
    ...adjustments.changes.map((change) => `- ${change.area}: ${change.status}. ${change.explanation}`),
    "",
    "## Matchday 3 Score Predictions",
    "",
    "| Match | Selected | Most probable | W/D/L | xG | Confidence | Note |",
    "| --- | ---: | ---: | --- | ---: | --- | --- |",
    ...predictions.matches.map((match) => `| ${match.group}: ${match.homeTeam} vs ${match.awayTeam} | ${match.selectedScore.home}-${match.selectedScore.away} | ${match.mostProbableScore.home}-${match.mostProbableScore.away} (${percent(match.mostProbableScoreProbability)}) | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.draw)} / ${percent(match.outcomeProbabilities.awayWin)} | ${match.expectedGoals.home}-${match.expectedGoals.away} | ${match.confidenceLevel} | ${match.reasoningNote} |`),
    "",
    "## Fantasy Expected Points",
    "",
    "Scoring rule: 6 points for exact score, 3 for correct outcome if not exact, and +1 for each team goal count guessed correctly.",
    "",
    "| Match | selectedMostProbableScore | selectedExpectedPointsScore | expectedPoints | reasonForDifference |",
    "| --- | ---: | ---: | ---: | --- |",
    ...predictions.matches.map((match) => {
      const mostProbable = `${match.selectedMostProbableScore.home}-${match.selectedMostProbableScore.away}`;
      const expectedPointsScore = `${match.selectedExpectedPointsScore.home}-${match.selectedExpectedPointsScore.away}`;
      return `| ${match.group}: ${match.homeTeam} vs ${match.awayTeam} | ${mostProbable} (${match.selectedMostProbableScore.expectedFantasyPoints} pts) | ${expectedPointsScore} | ${match.expectedPoints} | ${match.reasonForDifference} |`;
    }),
    "",
    "## Top Scorelines",
    "",
    ...predictions.matches.flatMap((match) => [
      `### ${match.group}: ${match.homeTeam} vs ${match.awayTeam}`,
      "",
      `Selected score: ${match.selectedScore.home}-${match.selectedScore.away}. Most probable: ${match.mostProbableScore.home}-${match.mostProbableScore.away}.`,
      "",
      match.topScorelines.map((score) => `${score.homeGoals}-${score.awayGoals} ${percent(score.probability)}, xFP ${score.expectedFantasyPoints}`).join("; "),
      "",
    ]),
    "## Contamination Controls",
    "",
    "- Previous prediction artifacts were used only for evaluation.",
    "- Matchday 3 predictions use official results, current standings/metrics, existing collected team-strength/recent-form inputs, and the documented aggregate adjustment file.",
    "- Injuries, lineups, weather, xG, market odds, squad news, and tactical news are omitted because they are not sourced in this project.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function scoreEvaluation(prediction, result) {
  const predictedOutcome = outcome(prediction.home, prediction.away);
  return {
    predictedScore: { home: prediction.home, away: prediction.away },
    exactScoreHit: prediction.home === result.finalScore.home && prediction.away === result.finalScore.away,
    outcomeHit: predictedOutcome === result.outcome,
    predictedOutcome,
    actualOutcome: result.outcome,
    teamGoalHits: Number(prediction.home === result.finalScore.home) + Number(prediction.away === result.finalScore.away),
    totalTeamGoalsEvaluated: 2,
    totalGoalsError: Math.abs(prediction.home + prediction.away - result.finalScore.home - result.finalScore.away),
    goalDifferenceError: Math.abs((prediction.home - prediction.away) - (result.finalScore.home - result.finalScore.away)),
    homeGoalsError: Math.abs(prediction.home - result.finalScore.home),
    awayGoalsError: Math.abs(prediction.away - result.finalScore.away),
    expectedGoals: prediction.expectedGoals,
  };
}

function getOrientedPrediction(predictions, result) {
  const direct = predictions.get(fixtureKey(result.group, result.homeTeam, result.awayTeam));
  if (direct) return direct;
  const reverse = predictions.get(fixtureKey(result.group, result.awayTeam, result.homeTeam));
  if (!reverse) return undefined;
  return {
    ...reverse,
    home: reverse.away,
    away: reverse.home,
    expectedGoals: reverse.expectedGoals ? { home: reverse.expectedGoals.away, away: reverse.expectedGoals.home } : undefined,
    outcomeProbabilities: reverse.outcomeProbabilities ? {
      homeWin: reverse.outcomeProbabilities.awayWin,
      draw: reverse.outcomeProbabilities.draw,
      awayWin: reverse.outcomeProbabilities.homeWin,
    } : undefined,
  };
}

function summarizeScoreEvaluations(rows) {
  const n = rows.length;
  const exactScoreHits = rows.filter((row) => row.exactScoreHit).length;
  const outcomeHits = rows.filter((row) => row.outcomeHit).length;
  const teamGoalHits = rows.reduce((sum, row) => sum + row.teamGoalHits, 0);
  const teamGoalsEvaluated = rows.reduce((sum, row) => sum + row.totalTeamGoalsEvaluated, 0);
  const expectedRows = rows.filter((row) => row.expectedGoals);
  return {
    evaluatedFixtures: n,
    exactScoreHits,
    exactScoreHitRate: ratio(exactScoreHits, n),
    outcomeHits,
    outcomeHitRate: ratio(outcomeHits, n),
    teamGoalHits,
    teamGoalsEvaluated,
    teamGoalsHitRate: ratio(teamGoalHits, teamGoalsEvaluated),
    averageTotalGoalsError: average(rows.map((row) => row.totalGoalsError)),
    averageGoalDifferenceError: average(rows.map((row) => row.goalDifferenceError)),
    averageHomeGoalsError: average(rows.map((row) => row.homeGoalsError)),
    averageAwayGoalsError: average(rows.map((row) => row.awayGoalsError)),
    averagePredictedGoalsPerMatch: expectedRows.length === 0 ? undefined : round(average(expectedRows.map((row) => row.expectedGoals.home + row.expectedGoals.away))),
  };
}

function evaluateMonteCarlo(previousMonteCarlo, metrics) {
  if (!previousMonteCarlo?.groups) return { available: false, reason: "Previous Monte Carlo artifact not found." };
  let covered = 0;
  let totalTopTwo = 0;
  let absolutePositionError = 0;
  let positionRows = 0;
  const groups = metrics.groupStandings.map((group) => {
    const prediction = previousMonteCarlo.groups.find((row) => row.group === group.group);
    if (!prediction) return { group: group.group, available: false };
    const predictedByTeam = new Map(prediction.predictedStandings.map((row) => [teamKey(row.team), row.predictedPosition]));
    const predictedTopTwo = new Set(prediction.predictedStandings.filter((row) => row.predictedPosition <= 2).map((row) => teamKey(row.team)));
    const actualTopTwo = group.standings.filter((row) => row.position <= 2);
    for (const row of actualTopTwo) {
      totalTopTwo += 1;
      if (predictedTopTwo.has(teamKey(row.team))) covered += 1;
    }
    for (const row of group.standings) {
      const predictedPosition = predictedByTeam.get(teamKey(row.team));
      if (predictedPosition) {
        absolutePositionError += Math.abs(predictedPosition - row.position);
        positionRows += 1;
      }
    }
    return {
      group: group.group,
      actualTopTwo: actualTopTwo.map((row) => row.team),
      predictedTopTwo: prediction.predictedStandings.filter((row) => row.predictedPosition <= 2).map((row) => row.team),
    };
  });
  return {
    available: true,
    actualTopTwoCoveredByPredictedTopTwo: covered,
    actualTopTwoSlotsEvaluated: totalTopTwo,
    actualTopTwoCoveredByPredictedTopTwoRate: ratio(covered, totalTopTwo),
    averageAbsolutePositionError: ratio(absolutePositionError, positionRows),
    groups,
  };
}

function parseSelectedPredictions(markdown) {
  const rows = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\| Group ([A-L]): (.+?) vs (.+?) \| (.+?) (\d+)-(\d+) (.+?) \|/);
    if (!match) continue;
    const [, group, rawHome, rawAway, leftTeam, rawHomeGoals, rawAwayGoals, rightTeam] = match;
    const homeTeam = normalizeTeamName(rawHome);
    const awayTeam = normalizeTeamName(rawAway);
    const left = normalizeTeamName(leftTeam);
    const right = normalizeTeamName(rightTeam);
    if (teamKey(left) !== teamKey(homeTeam) || teamKey(right) !== teamKey(awayTeam)) continue;
    rows.set(fixtureKey(group, homeTeam, awayTeam), {
      home: Number(rawHomeGoals),
      away: Number(rawAwayGoals),
      source: PATHS.previousFirstRoundReport,
    });
  }
  return rows;
}

function extractMostProbableFromMarkov(markov) {
  const rows = new Map();
  for (const fixture of markov.fixtureDistributions ?? []) {
    const distribution = fixture.scoreDistribution.map((score) => ({ homeGoals: score.goalsA, awayGoals: score.goalsB, probability: score.probability }));
    const metrics = calculateScoreDistributionMetrics(distribution);
    const top = metrics.topScorelines[0];
    rows.set(fixtureKey(fixture.group, fixture.teamA, fixture.teamB), {
      home: top.homeGoals,
      away: top.awayGoals,
      expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
      outcomeProbabilities: { homeWin: metrics.homeWinProbability, draw: metrics.drawProbability, awayWin: metrics.awayWinProbability },
      source: PATHS.previousMarkovV1,
    });
  }
  return rows;
}

function buildTeamInputs(groups, strengthRows, formRows, params) {
  const strengthByTeam = new Map(strengthRows.map((row) => [teamKey(row.team), row]));
  const formByTeam = new Map(formRows.map((row) => [teamKey(row.team), row]));
  const fifaRanks = strengthRows.map((row) => row.fifaRank);
  const fifaPoints = strengthRows.map((row) => row.fifaPoints);
  const eloRatings = strengthRows.flatMap((row) => row.eloRating === undefined ? [] : [row.eloRating]);
  const avgFor = average(formRows.map((row) => row.goalsForPerMatch));
  const avgAgainst = average(formRows.map((row) => row.goalsAgainstPerMatch));
  const inputs = [];
  for (const group of groups) {
    for (const teamName of group.teams) {
      const strength = strengthByTeam.get(teamKey(teamName));
      const form = formByTeam.get(teamKey(teamName));
      if (!strength || !form) throw new Error(`Missing strength/form for ${teamName}`);
      const fifaPointsScore = normalizeRange(strength.fifaPoints, Math.min(...fifaPoints), Math.max(...fifaPoints));
      const fifaRankScore = normalizeInverseRange(strength.fifaRank, Math.min(...fifaRanks), Math.max(...fifaRanks));
      const eloScore = strength.eloRating === undefined ? undefined : normalizeRange(strength.eloRating, Math.min(...eloRatings), Math.max(...eloRatings));
      const formPointsRate = form.formPoints / (form.matchesPlayed * 3);
      const parts = [
        { value: fifaPointsScore, weight: 0.35 },
        { value: fifaRankScore, weight: 0.2 },
        ...(eloScore === undefined ? [] : [{ value: eloScore, weight: 0.3 }]),
        { value: formPointsRate, weight: 0.15 },
      ];
      const weight = parts.reduce((sum, part) => sum + part.weight, 0);
      inputs.push({
        team: normalizeTeamName(strength.team),
        group: group.group,
        fifaRank: strength.fifaRank,
        goalsForPerMatch: form.goalsForPerMatch,
        goalsAgainstPerMatch: form.goalsAgainstPerMatch,
        attackIndex: clamp(form.goalsForPerMatch / avgFor, 0.25, 2.75),
        defensiveVulnerabilityIndex: clamp(form.goalsAgainstPerMatch / avgAgainst, 0.2, 3.2),
        qualityScore: parts.reduce((sum, part) => sum + part.value * part.weight, 0) / weight,
        params,
      });
    }
  }
  params.baseGoalsPerTeamMatch = round(average(inputs.map((row) => row.goalsForPerMatch)));
  return inputs;
}

function expectedGoals(team, opponent, params) {
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * params.qualityMultiplierScale);
  return round(clamp(params.baseGoalRateMultiplier * averageBaseGoals(team) * Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex) * qualityMultiplier, params.lambdaMin, params.lambdaMax));
}

function averageBaseGoals(team) {
  return team.params.baseGoalsPerTeamMatch ?? 1.6511;
}

function buildScoreDistribution(lambdaA, lambdaB, params) {
  const pA = clamp(lambdaA / params.stepsPerMatch, 0, 0.25);
  const pB = clamp(lambdaB / params.stepsPerMatch, 0, 0.25);
  const transitions = [
    [0, 0, (1 - pA) * (1 - pB)],
    [1, 0, pA * (1 - pB)],
    [0, 1, (1 - pA) * pB],
    [1, 1, pA * pB],
  ];
  let states = new Map([["0,0", 1]]);
  for (let step = 0; step < params.stepsPerMatch; step += 1) {
    const next = new Map();
    for (const [key, probability] of states) {
      const [goalsA, goalsB] = key.split(",").map(Number);
      for (const [addA, addB, p] of transitions) {
        const nextProbability = probability * p;
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
    topScorelines: [...normalized]
      .sort((a, b) => b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals)
      .slice(0, 5)
      .map((score) => ({ homeGoals: score.homeGoals, awayGoals: score.awayGoals, probability: round(score.probability) })),
  };
}

function calculateFantasyExpectedPoints(guess, distribution) {
  const total = distribution.reduce((sum, score) => sum + score.probability, 0);
  if (total <= 0) return 0;
  return round(distribution.reduce((sum, actual) => {
    const normalizedProbability = actual.probability / total;
    return sum + normalizedProbability * fantasyPointsForScoreGuess(guess, actual);
  }, 0));
}

function fantasyPointsForScoreGuess(guess, actual) {
  const exactScore = guess.homeGoals === actual.homeGoals && guess.awayGoals === actual.awayGoals;
  const correctOutcome = outcome(guess.homeGoals, guess.awayGoals) === outcome(actual.homeGoals, actual.awayGoals);
  return (
    (exactScore ? 6 : correctOutcome ? 3 : 0) +
    (guess.homeGoals === actual.homeGoals ? 1 : 0) +
    (guess.awayGoals === actual.awayGoals ? 1 : 0)
  );
}

function reasonForFantasyDifference(mostProbable, expectedPointsScore) {
  if (mostProbable.homeGoals === expectedPointsScore.homeGoals && mostProbable.awayGoals === expectedPointsScore.awayGoals) {
    return "Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines.";
  }
  return `Different scoreline: ${expectedPointsScore.homeGoals}-${expectedPointsScore.awayGoals} has higher probability-weighted fantasy value (${expectedPointsScore.expectedFantasyPoints}) than the most probable ${mostProbable.homeGoals}-${mostProbable.awayGoals} (${mostProbable.expectedFantasyPoints}).`;
}

function parseGroups(markdown) {
  const groups = [];
  let current;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## Group ([A-L])$/);
    if (heading) {
      current = { group: heading[1], teams: [] };
      groups.push(current);
      continue;
    }
    if (line.startsWith("## ")) current = undefined;
    const team = line.match(/^-\s+(.+)$/)?.[1];
    if (team && current) current.teams.push(normalizeTeamName(team));
  }
  return groups;
}

function parseRules(value) {
  return {
    winPoints: value.pointsSystem.win.value,
    drawPoints: value.pointsSystem.draw.value,
    lossPoints: value.pointsSystem.loss.value,
  };
}

function applyTeamResult(row, goalsFor, goalsAgainst, opponent, rules) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  row.cleanSheets += goalsAgainst === 0 ? 1 : 0;
  row.failedToScore += goalsFor === 0 ? 1 : 0;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += rules.winPoints;
    row.tournamentForm.push({ opponent, goalsFor, goalsAgainst, result: "W" });
  } else if (goalsFor < goalsAgainst) {
    row.losses += 1;
    row.points += rules.lossPoints;
    row.tournamentForm.push({ opponent, goalsFor, goalsAgainst, result: "L" });
  } else {
    row.draws += 1;
    row.points += rules.drawPoints;
    row.tournamentForm.push({ opponent, goalsFor, goalsAgainst, result: "D" });
  }
}

function finalizeTeamMetric(row) {
  return {
    ...row,
    goalsForPerMatch: ratio(row.goalsFor, row.played),
    goalsAgainstPerMatch: ratio(row.goalsAgainst, row.played),
    pointsPerMatch: ratio(row.points, row.played),
  };
}

function compareStandings(a, b) {
  return b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team);
}

function compactTeamContext(row) {
  return row ? {
    position: row.position,
    played: row.played,
    points: row.points,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
  } : undefined;
}

function reasoningNote(fixture, scoreMetrics, metricByTeam) {
  const home = metricByTeam.get(teamKey(fixture.homeTeam));
  const away = metricByTeam.get(teamKey(fixture.awayTeam));
  const leader = scoreMetrics.homeWinProbability >= scoreMetrics.awayWinProbability ? fixture.homeTeam : fixture.awayTeam;
  const maxOutcome = Math.max(scoreMetrics.homeWinProbability, scoreMetrics.drawProbability, scoreMetrics.awayWinProbability);
  const context = home && away ? `Current points ${fixture.homeTeam} ${home.points}, ${fixture.awayTeam} ${away.points}.` : "";
  if (scoreMetrics.drawProbability === maxOutcome) return `${context} Draw is the highest outcome bucket, and the selected score is the Markov probability leader.`;
  return `${context} ${leader} has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule.`;
}

function confidenceLevel(metrics) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const top = metrics.topScorelines[0]?.probability ?? 0;
  if (maxOutcome >= 0.7 && top >= 0.1) return "High";
  if (maxOutcome >= 0.52 || top >= 0.12) return "Medium";
  return "Low";
}

function isOfficialFinal(match) {
  return match.MatchStatus === 0 && match.ResultType === 1 && match.OfficialityStatus === 1 && Number.isInteger(firstNumber(match.HomeTeamScore, match.Home?.Score)) && Number.isInteger(firstNumber(match.AwayTeamScore, match.Away?.Score));
}

function statusLabel(match) {
  if (match.MatchStatus === 0 && match.ResultType === 1 && match.OfficialityStatus === 1) return "final";
  if (match.MatchStatus === 0 && match.ResultType === 1) return "provisional_result";
  if (match.MatchStatus === 3 || match.MatchStatus === 12) return "in_progress";
  if (match.MatchStatus === 1) return "scheduled";
  return "unknown";
}

function description(localized) {
  const value = optionalDescription(localized);
  if (!value) throw new Error("Missing localized description");
  return value;
}

function optionalDescription(localized) {
  return localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
}

function firstNumber(...values) {
  return values.find((value) => Number.isInteger(value));
}

function groupLetter(value) {
  const match = value.match(/Group ([A-L])/);
  if (!match) throw new Error(`Cannot parse group from ${value}`);
  return match[1];
}

function matchdayFromMatchNumber(matchNumber) {
  if (matchNumber >= 1 && matchNumber <= 24) return 1;
  if (matchNumber >= 25 && matchNumber <= 48) return 2;
  if (matchNumber >= 49 && matchNumber <= 72) return 3;
  throw new Error(`Not a group-stage match: ${matchNumber}`);
}

function outcome(home, away) {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
}

function fixtureKey(group, homeTeam, awayTeam) {
  return `${group}|${teamKey(homeTeam)}|${teamKey(awayTeam)}`;
}

function normalizeTeamName(name) {
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
}

function teamKey(name) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function normalizeRange(value, min, max) {
  return max === min ? 1 : clamp((value - min) / (max - min), 0, 1);
}

function normalizeInverseRange(value, min, max) {
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
  return `${Math.round(value * 1000) / 10}%`;
}

function assertNoPredictionInputs(paths) {
  for (const path of paths) {
    const normalizedPath = normalize(path);
    if (normalizedPath === PREDICTIONS_DIR || normalizedPath.startsWith(`${PREDICTIONS_DIR}\\`)) {
      throw new Error(`Prediction input contamination blocked: ${path}`);
    }
  }
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
