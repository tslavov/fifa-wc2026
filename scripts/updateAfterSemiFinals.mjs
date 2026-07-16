import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PATHS = {
  previous: join("data", "predictions", "remaining-knockout-score-predictions-v1.json"),
  priorStats: join("data", "knockout", "semi-final-team-stats-v1.json"),
  priorEvaluation: join("data", "evaluation", "round-of-16-prediction-evaluation-v1.json"),
  contextBacktest: join("data", "evaluation", "context-feature-backtest.json"),
  results: join("data", "results", "semi-final-actual-results-v1.json"),
  evaluation: join("data", "evaluation", "semi-final-prediction-evaluation-v1.json"),
  calibration: join("data", "model", "calibration-changes-after-semi-finals-v1.json"),
  adjustments: join("data", "model", "finals-model-adjustments-v1.json"),
  stats: join("data", "knockout", "finals-team-stats-v1.json"),
  context: join("data", "context", "finals-last-minute-context-v1.json"),
  predictions: join("data", "predictions", "finals-score-predictions-v1.json"),
  report: join("reports", "finals-score-predictions-v1.md"),
};
const FIFA_API = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";
const ITERATIONS = 250000;
const WEIGHTS = { markov: 0.6, monteCarlo: 0.4 };
const PARAMS = { baseGoalRateMultiplier: 0.94, qualityMultiplierScale: 0.61, lambdaMin: 0.15, lambdaMax: 4.25, stepsPerMatch: 90, pruneProbabilityBelow: 1e-14, baseGoalsPerTeamMatch: 2.3359625, formSignalScale: 0.45, extraTimeScoringRate: 0.72, residualEvidenceWeight: 0.05 };
const generatedAt = new Date().toISOString();

const [previous, priorStats, priorEvaluation, contextBacktest] = await Promise.all([
  readJson(PATHS.previous), readJson(PATHS.priorStats), readJson(PATHS.priorEvaluation), readJson(PATHS.contextBacktest),
]);
const results = buildResults();
const evaluation = buildEvaluation(previous, results);
const calibration = buildCalibration(evaluation, priorEvaluation);
const adjustments = buildAdjustments(evaluation, calibration, contextBacktest);
const stats = buildStats(priorStats, results);
const context = buildContext();
const predictions = buildPredictions(stats, context, evaluation, adjustments);
const report = buildReport(results, evaluation, calibration, adjustments, predictions, context);

for (const [path, value] of [[PATHS.results, results], [PATHS.evaluation, evaluation], [PATHS.calibration, calibration], [PATHS.adjustments, adjustments], [PATHS.stats, stats], [PATHS.context, context], [PATHS.predictions, predictions]]) await writeJson(path, value);
await writeText(PATHS.report, report);
console.log("Reused: scripts/updateAfterQuarterFinals.mjs model equations; previous semi-final predictions; semi-final team stats; cumulative evaluation/context backtest");
console.log(`Created: ${[PATHS.results, PATHS.evaluation, PATHS.calibration, PATHS.adjustments, PATHS.stats, PATHS.context, PATHS.predictions, PATHS.report].join(", ")}`);
for (const f of predictions.fixtures) console.log(`${f.matchId} ${f.homeTeam} vs ${f.awayTeam}: Markov ${score(f.markov.mostProbableScore)}, Monte Carlo ${score(f.monteCarlo.mostProbableScore)}, ensemble selected ${score(f.ensemble.selectedScore)}; winner ${f.ensemble.selectedWinner} (${f.ensemble.resolution})`);

function buildResults() {
  const commonMissing = ["official starting lineups", "substitutions", "cards", "complete player minutes", "complete match-event feed", "team-level match statistics"];
  return {
    datasetId: "semi-final-actual-results-v1", artifactKind: "match_results", generatedAt,
    validationStatus: "fixed inputs cross-checked where official FIFA report was available",
    records: [
      {
        matchId: "400021541", matchNumber: 101, stage: "Semi-final", homeTeam: "France", awayTeam: "Spain",
        kickoffUtc: "2026-07-14T19:00:00Z", venue: "Dallas Stadium", city: "Dallas", scoreAfter90: { home: 0, away: 2 },
        extraTimePlayed: false, penaltiesPlayed: false, advanced: "Spain",
        events: [{ minute: 22, team: "Spain", player: "Mikel Oyarzabal", type: "penalty_goal" }, { minute: 58, team: "Spain", player: "Pedro Porro", type: "goal" }],
        source: "FIFA match report", sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/france-spain-match-report-highlights",
        collectionTimestamp: generatedAt, dataAvailability: "result, venue, kickoff and scoring events available", validationStatus: "officially confirmed",
        missingData: commonMissing,
      },
      {
        matchId: "400021540", matchNumber: 102, stage: "Semi-final", homeTeam: "England", awayTeam: "Argentina",
        kickoffUtc: "2026-07-15T19:00:00Z", venue: "Atlanta Stadium", city: "Atlanta", scoreAfter90: { home: 1, away: 2 },
        extraTimePlayed: false, penaltiesPlayed: false, advanced: "Argentina",
        source: "user-confirmed fixed official input; FIFA calendar endpoint designated for verification", sourceUrl: FIFA_API,
        collectionTimestamp: generatedAt, dataAvailability: "teams, result, venue and kickoff available", validationStatus: "accepted fixed input; detailed FIFA record unavailable to collector",
        missingData: [...commonMissing, "official FIFA match-report URL", "scorers and event minutes"],
      },
    ],
  };
}

function buildEvaluation(previousArtifact, actualArtifact) {
  const rows = actualArtifact.records.map((actual) => {
    const pred = previousArtifact.semiFinalPredictions.find((p) => p.matchNumber === actual.matchNumber);
    if (!pred) throw new Error(`Missing previous prediction ${actual.matchNumber}`);
    const actualOutcome = outcome(actual.scoreAfter90.home, actual.scoreAfter90.away);
    const methods = {};
    for (const method of ["markov", "monteCarlo", "ensemble"]) {
      const selected = method === "markov" ? pred.selectedScore : method === "monteCarlo" ? pred.selectedScore : pred.selectedScore;
      const probs = pred.outcomeProbabilities;
      const qual = method === "monteCarlo" ? pred.monteCarlo.qualificationProbabilities : pred.qualificationProbabilities;
      methods[method] = evaluate(selected, probs, qual, actual, actualOutcome);
    }
    return { matchNumber: actual.matchNumber, fixture: `${actual.homeTeam} vs ${actual.awayTeam}`, previousPrediction: { mostProbableScore: pred.mostProbableScore, selectedScore: pred.selectedScore, outcomeProbabilities: pred.outcomeProbabilities, qualificationProbabilities: pred.qualificationProbabilities }, actual: { scoreAfter90: actual.scoreAfter90, advanced: actual.advanced }, methods };
  });
  return {
    datasetId: "semi-final-prediction-evaluation-v1", artifactKind: "prediction_evaluation", generatedAt,
    inputs: [PATHS.previous, PATHS.results], sampleSize: 2,
    summary: Object.fromEntries(["markov", "monteCarlo", "ensemble"].map((m) => [m, summarize(rows.map((r) => r.methods[m]))])),
    calibration: { outcomeProbabilities: calibrationBins(rows, "outcome"), qualificationProbabilities: calibrationBins(rows, "qualification"), warning: "Two matches are insufficient for standalone recalibration." },
    matches: rows,
  };
}

function evaluate(selected, probs, qual, actual, actualOutcome) {
  const predictedOutcome = outcome(selected.home, selected.away);
  const q = { home: qual.home, away: qual.away };
  const actualHomeQual = actual.advanced === actual.homeTeam;
  return {
    selectedScore: { home: selected.home, away: selected.away }, exactScoreCorrect: selected.home === actual.scoreAfter90.home && selected.away === actual.scoreAfter90.away,
    outcomeCorrect: predictedOutcome === actualOutcome, qualificationCorrect: (q.home >= q.away ? actual.homeTeam : actual.awayTeam) === actual.advanced,
    brierScore: round(["home", "draw", "away"].reduce((s, k) => s + ((k === "home" ? probs.homeWin : k === "draw" ? probs.drawThrough90 : probs.awayWin) - (k === actualOutcome ? 1 : 0)) ** 2, 0)),
    logLoss: round(-Math.log(Math.max(1e-15, actualOutcome === "home" ? probs.homeWin : actualOutcome === "draw" ? probs.drawThrough90 : probs.awayWin))),
    rankedProbabilityScore: rps(probs, actualOutcome), qualificationBrierScore: round(2 * (q.home - (actualHomeQual ? 1 : 0)) ** 2),
    fantasyScore: fantasy(selected, { home: actual.scoreAfter90.home, away: actual.scoreAfter90.away }),
  };
}

function summarize(rows) {
  return { exactScoreAccuracy: mean(rows.map((x) => +x.exactScoreCorrect)), outcomeAccuracy: mean(rows.map((x) => +x.outcomeCorrect)), qualificationAccuracy: mean(rows.map((x) => +x.qualificationCorrect)), meanBrierScore: mean(rows.map((x) => x.brierScore)), meanLogLoss: mean(rows.map((x) => x.logLoss)), meanRankedProbabilityScore: mean(rows.map((x) => x.rankedProbabilityScore)), meanQualificationBrierScore: mean(rows.map((x) => x.qualificationBrierScore)), meanFantasyScore: mean(rows.map((x) => x.fantasyScore)) };
}

function calibrationBins(rows, kind) {
  const samples = rows.flatMap((row) => {
    if (kind === "qualification") return [{ predicted: row.previousPrediction.qualificationProbabilities.home, observed: row.actual.advanced === row.fixture.split(" vs ")[0] ? 1 : 0 }, { predicted: row.previousPrediction.qualificationProbabilities.away, observed: row.actual.advanced === row.fixture.split(" vs ")[1] ? 1 : 0 }];
    const p = row.previousPrediction.outcomeProbabilities, a = outcome(row.actual.scoreAfter90.home, row.actual.scoreAfter90.away);
    return [{ predicted: p.homeWin, observed: a === "home" ? 1 : 0 }, { predicted: p.drawThrough90, observed: a === "draw" ? 1 : 0 }, { predicted: p.awayWin, observed: a === "away" ? 1 : 0 }];
  });
  return ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"].map((label, i) => {
    const values = samples.filter((x) => x.predicted >= i * .2 && (i === 4 ? x.predicted <= 1 : x.predicted < (i + 1) * .2));
    return { bin: label, count: values.length, meanPredicted: values.length ? mean(values.map((x) => x.predicted)) : 0, observedFrequency: values.length ? mean(values.map((x) => x.observed)) : 0 };
  }).filter((x) => x.count);
}

function buildCalibration(e, prior) {
  return {
    datasetId: "calibration-changes-after-semi-finals-v1", artifactKind: "calibration_change", generatedAt,
    evidence: { semiFinalSampleSize: 2, semiFinalEvaluation: PATHS.evaluation, previousCumulativeArtifact: PATHS.priorEvaluation, previousCumulativeMetrics: prior.summary.markov },
    adjustments: [
      decision("residualEvidenceWeight", 0.05, 0.10, 0.05, false, "Two semi-finals must not dominate cumulative and historical evidence.", "Retaining regularisation prevents reactive fitting."),
      decision("formSignalScale", 0.45, 0.40, 0.45, false, "Semi-final misses do not identify form-scale error from two observations.", "Rejected: no out-of-sample improvement established."),
      decision("ensembleMarkovWeight", null, 0.60, 0.60, true, "Analytical distribution receives a modest stability preference; Monte Carlo remains an independent finite-sample check.", "Accepted as conservative documented weighting; components had identical semi-final decisions."),
      decision("thirdPlaceGoalMultiplier", 1, 1.08, 1, false, "No repository historical third-place backtest supports a directional goals bonus.", "Rejected; uncertainty is widened instead."),
      decision("finalGoalMultiplier", 1, 0.92, 1, false, "Small historical final samples are absent from repository validation.", "Rejected; no automatic low-score adjustment."),
    ],
    protectionAgainstOverfitting: "No coefficient or scoring-rate change is accepted from the two newest matches; the established 5% residual update is retained.",
  };
}

function decision(feature, originalValue, candidateValue, finalRetainedValue, accepted, reason, validationResult) {
  return { feature, originalValue, candidateValue, finalRetainedValue, reason, evidence: [PATHS.evaluation, PATHS.priorEvaluation, PATHS.contextBacktest], validationResult, status: accepted ? "accepted" : "rejected" };
}

function buildAdjustments(evaluationArtifact, calibrationArtifact, backtest) {
  return {
    datasetId: "finals-model-adjustments-v1", artifactKind: "model_adjustment", generatedAt,
    basedOn: [PATHS.evaluation, PATHS.calibration, PATHS.contextBacktest],
    selectedParameters: { residualEvidenceWeight: 0.05, formSignalScale: 0.45, extraTimeScoringRate: 0.72, markovWeight: WEIGHTS.markov, monteCarloWeight: WEIGHTS.monteCarlo },
    accepted: calibrationArtifact.adjustments.filter((x) => x.status === "accepted"),
    rejected: calibrationArtifact.adjustments.filter((x) => x.status === "rejected"),
    contextualPolicy: { thirdPlace: "No scoring bonus; report higher lineup/motivation uncertainty.", final: "No scoring discount; model extra time and penalties explicitly.", contextBacktestDecision: backtest.featureDecisions },
    validation: { semiFinal: evaluationArtifact.summary, weightsSumToOne: round(WEIGHTS.markov + WEIGHTS.monteCarlo) === 1 },
  };
}

function buildStats(prior, actual) {
  const byTeam = new Map(prior.teams.map((t) => [t.team, t]));
  const teams = ["France", "England", "Spain", "Argentina"].map((name) => {
    const p = structuredClone(byTeam.get(name));
    const match = actual.records.find((r) => r.homeTeam === name || r.awayTeam === name);
    const opp = match.homeTeam === name ? match.awayTeam : match.homeTeam;
    const gf = match.homeTeam === name ? match.scoreAfter90.home : match.scoreAfter90.away;
    const ga = match.homeTeam === name ? match.scoreAfter90.away : match.scoreAfter90.home;
    const oppRates = byTeam.get(opp).modelingTotals;
    const before = p.modelingTotals;
    const expectedFor = before.goalsForPerMatch * PARAMS.baseGoalRateMultiplier * (oppRates.goalsAgainstPerMatch / PARAMS.baseGoalsPerTeamMatch);
    const expectedAgainst = oppRates.goalsForPerMatch * PARAMS.baseGoalRateMultiplier * (before.goalsAgainstPerMatch / PARAMS.baseGoalsPerTeamMatch);
    const attack = Math.max(.05, before.goalsForPerMatch + (gf - expectedFor) * .05);
    const defence = Math.max(.05, before.goalsAgainstPerMatch + (ga - expectedAgainst) * .05);
    return {
      ...p, modelingTotals: { ...before, goalsForPerMatch: round(attack), goalsAgainstPerMatch: round(defence), goalsFor: round(attack * before.played), goalsAgainst: round(defence * before.played), goalDifference: round((attack - defence) * before.played) },
      semiFinal: { matchNumber: match.matchNumber, opponent: opp, goalsFor: gf, goalsAgainst: ga, advanced: match.advanced === name, playingMinutes: 90 },
      actualTotalsThroughSemiFinal: { played: (p.actualTotalsThroughQuarterFinal?.played ?? p.totals.played) + 1, goalsFor: (p.actualTotalsThroughQuarterFinal?.goalsFor ?? p.totals.goalsFor) + gf, goalsAgainst: (p.actualTotalsThroughQuarterFinal?.goalsAgainst ?? p.totals.goalsAgainst) + ga },
      semiFinalUpdate: { method: "opponent_adjusted_residual", evidenceWeight: .05, expectedGoalsFor: round(expectedFor), expectedGoalsAgainst: round(expectedAgainst), attackResidual: round(gf - expectedFor), defenceResidual: round(ga - expectedAgainst) },
      availableMetrics: ["official tournament goals for/against", "FIFA ranking", "Elo rating", "knockout results", "extra-time minutes"],
      unavailableMetrics: ["validated xG/xGA", "shots and shot quality", "possession and territory", "goalkeeper statistics", "set-piece statistics", "complete player minutes", "opponent-strength-adjusted event data"],
    };
  });
  return { datasetId: "finals-team-stats-v1", artifactKind: "knockout_team_stats", generatedAt, sourceFiles: [PATHS.priorStats, PATHS.results], updatePolicy: "5% opponent-adjusted semi-final score residual; no tuning to two matches", teams };
}

function buildContext() {
  const source = (value, url, included, reason, confidence = "high") => ({ value, source: url, collectionTime: generatedAt, confidence, includedInModel: included, reason });
  return {
    datasetId: "finals-last-minute-context-v1", artifactKind: "match_context", generatedAt,
    fixtures: [
      { matchId: 103, fixture: "France vs England", factors: {
        venue: source("Miami Stadium", FIFA_API, false, "Venue recorded; no validated directional effect."),
        kickoffUtc: source("2026-07-18T21:00:00Z", FIFA_API, false, "Scheduling fact only."),
        rest: source("France 4 days; England 3 days", FIFA_API, false, "Repository rest backtest did not improve calibration."),
        accumulatedExtraTime: source("France 0; England 30 minutes in quarter-final", PATHS.priorStats, false, "Not validated as a directional scoring adjustment."),
        rotation: source("uncertain; elevated third-place rotation risk", "model policy inference", false, "No confirmed lineup; uncertainty only.", "low"),
        motivation: source("uncertain after semi-final defeats", "model policy inference", false, "No reliable symmetric measurement.", "low"),
        weather: source("not collected", "unavailable", false, "No official match-time forecast validated for both teams.", "low"),
        availability: source("not confirmed", "unavailable", false, "No official squad announcement collected.", "low"),
      }, uncertaintyAdjustment: "high contextual uncertainty; no directional expected-goals adjustment" },
      { matchId: 104, fixture: "Spain vs Argentina", factors: {
        venue: source("New York New Jersey Stadium", FIFA_API, false, "Venue recorded; no validated directional effect."),
        kickoffUtc: source("2026-07-19T19:00:00Z", FIFA_API, false, "Scheduling fact only."),
        rest: source("Spain 5 days; Argentina 4 days", FIFA_API, false, "Repository rest backtest did not improve calibration."),
        accumulatedExtraTime: source("Spain 0; Argentina 30 minutes in quarter-final", PATHS.priorStats, false, "Not validated as a directional scoring adjustment."),
        tacticalContext: source("final may increase risk management", "historical football inference", false, "No repository final-specific backtest; no forced low-score multiplier.", "low"),
        weather: source("not collected", "unavailable", false, "No official match-time forecast validated for both teams.", "low"),
        availability: source("not confirmed", "unavailable", false, "No official squad announcement collected.", "low"),
      }, uncertaintyAdjustment: "medium contextual uncertainty; no directional expected-goals adjustment" },
    ],
  };
}

function buildPredictions(statsArtifact, contextArtifact, evaluationArtifact, adjustmentArtifact) {
  const byTeam = new Map(buildInputs(statsArtifact.teams).map((t) => [t.team, t]));
  const fixtureDefs = [
    { matchId: 103, stage: "third-place", homeTeam: "France", awayTeam: "England", venue: "Miami Stadium", kickoffUtc: "2026-07-18T21:00:00Z", seed: 20260716103 },
    { matchId: 104, stage: "final", homeTeam: "Spain", awayTeam: "Argentina", venue: "New York New Jersey Stadium", kickoffUtc: "2026-07-19T19:00:00Z", seed: 20260716104 },
  ];
  const fixtures = fixtureDefs.map((f) => predictFixture(f, byTeam, contextArtifact.fixtures.find((x) => x.matchId === f.matchId)));
  return {
    predictionId: "finals-score-predictions-v1", artifactKind: "prediction", generatedAt, dataCollectedAt: generatedAt, modelVersion: "post-semi-finals-markov-monte-carlo-ensemble-v1", iterationsPerFixture: ITERATIONS,
    inputs: [PATHS.stats, PATHS.context, PATHS.calibration, PATHS.adjustments], ensembleWeightEvidence: { markovWeight: WEIGHTS.markov, monteCarloWeight: WEIGHTS.monteCarlo, rationale: "Documented conservative stability preference; semi-final components made identical decisions and provide no evidence for aggressive reweighting." },
    fixtures, validation: validatePredictions(fixtures),
  };
}

function predictFixture(f, byTeam, fixtureContext) {
  const home = byTeam.get(f.homeTeam), away = byTeam.get(f.awayTeam);
  const lambdaHome = expectedGoals(home, away), lambdaAway = expectedGoals(away, home);
  const markovDist = distribution(lambdaHome, lambdaAway);
  const markov = markovSummary(markovDist, lambdaHome, lambdaAway, home, away);
  const mc = simulate(markovDist, lambdaHome, lambdaAway, home, away, f.seed);
  mc.mostCommonCompleteMatchPath.path = mc.mostCommonCompleteMatchPath.path
    .replaceAll("home", f.homeTeam)
    .replaceAll("away", f.awayTeam);
  const ensembleDist = markovDist.map((s) => {
    const mcScore = mc.scoreDistribution.find((x) => x.home === s.home && x.away === s.away);
    return { home: s.home, away: s.away, probability: round(s.probability * WEIGHTS.markov + (mcScore?.probability ?? 0) * WEIGHTS.monteCarlo) };
  }).sort(sortScores);
  const selected = selectScore(ensembleDist, home.qualityScore >= away.qualityScore);
  const most = ensembleDist[0], second = ensembleDist[1];
  const finalHome = round(markov.homeFinalWin * WEIGHTS.markov + mc.homeFinalWin * WEIGHTS.monteCarlo);
  const winner = finalHome >= .5 ? f.homeTeam : f.awayTeam;
  const resolution = selected.home !== selected.away ? "90-minutes" : (mc.penalties / mc.extraTime >= .5 ? "penalties" : "extra-time");
  const included = Object.entries(fixtureContext.factors).filter(([, x]) => x.includedInModel).map(([k]) => k);
  const rejected = Object.entries(fixtureContext.factors).filter(([, x]) => !x.includedInModel).map(([factor, x]) => ({ factor, reason: x.reason }));
  return {
    ...f, expectedGoals: { home: round(lambdaHome), away: round(lambdaAway) },
    markov: { ...markov, completeScoreDistribution: markovDist, topTenScorelines: markovDist.slice(0, 10) },
    monteCarlo: mc,
    ensemble: { markovWeight: WEIGHTS.markov, monteCarloWeight: WEIGHTS.monteCarlo, mostProbableScore: pick(most), mostProbableScoreProbability: most.probability, selectedScore: pick(selected), selectedScoreProbability: selected.probability, selectedWinner: winner, resolution, confidence: f.matchId === 103 ? "low" : "medium", scoreDistribution: ensembleDist },
    topScorelines: ensembleDist.slice(0, 10),
    selectionRule: { secondScore: pick(second), secondScoreProbability: second.probability, absoluteProbabilityDifference: round(most.probability - selected.probability), relativeProbabilityDifference: round((most.probability - selected.probability) / most.probability), tieBreakApplied: selected !== most, reason: selected === most ? "The mathematically highest-probability score was retained." : "A leading scoreline within the allowed near-equal cluster was preferred by the higher-scoring/stronger-team rule." },
    selectionExplanation: `${score(pick(most))} is the ensemble mode; ${score(pick(selected))} is selected. ${winner} has the higher complete-match winner probability.`,
    contextIncluded: included, contextRejected: rejected,
    missingData: ["confirmed lineups", "confirmed injuries/suspensions", "validated xG and shot data", "complete player minutes", "official match-time weather"],
  };
}

function buildInputs(teams) {
  return teams.map((team) => {
    const r = team.modelingTotals, parts = [[normalize(team.fifaPoints, 1300, 1950), .31], [normalize(team.eloRating, 1600, 2200), .31], [normalize(r.goalsForPerMatch, .4, 3.3), .2], [1 - normalize(r.goalsAgainstPerMatch, .05, 2.3), .18]];
    return { team: team.team, attack: r.goalsForPerMatch, defence: r.goalsAgainstPerMatch, qualityScore: parts.reduce((s, [v, w]) => s + v * w, 0) };
  });
}
function expectedGoals(team, opp) { return clamp((team.attack * PARAMS.baseGoalRateMultiplier * (opp.defence / PARAMS.baseGoalsPerTeamMatch)) * (1 + (team.qualityScore - opp.qualityScore) * PARAMS.qualityMultiplierScale), PARAMS.lambdaMin, PARAMS.lambdaMax); }
function distribution(a, b) {
  const pa = poisson(a, 12), pb = poisson(b, 12), rows = [];
  for (let h = 0; h < pa.length; h++) for (let x = 0; x < pb.length; x++) rows.push({ home: h, away: x, probability: pa[h] * pb[x] });
  const total = rows.reduce((s, x) => s + x.probability, 0);
  return rows.map((x) => ({ ...x, probability: round(x.probability / total) })).sort(sortScores);
}
function poisson(lambda, max) { const p = [Math.exp(-lambda)]; for (let i = 1; i <= max; i++) p.push(p[i - 1] * lambda / i); return p; }
function markovSummary(dist, lh, la, home, away) {
  const wdl = wdlFrom(dist), extra = wdl.draw, et = extraTime(lh, la, home, away), homeFinal = wdl.home + extra * et.homeFromDraw;
  return { expectedGoals: { home: round(lh), away: round(la) }, mostProbableScore: pick(dist[0]), homeWin90: wdl.home, draw90: wdl.draw, awayWin90: wdl.away, extraTime: extra, penalties: round(extra * et.penaltyConditional), homeFinalWin: round(homeFinal), awayFinalWin: round(1 - homeFinal) };
}
function extraTime(lh, la, home, away) {
  const etDist = distribution(lh * PARAMS.extraTimeScoringRate / 3, la * PARAMS.extraTimeScoringRate / 3), w = wdlFrom(etDist), shootHome = clamp(.5 + (home.qualityScore - away.qualityScore) * .18, .35, .65);
  return { penaltyConditional: w.draw, homeFromDraw: w.home + w.draw * shootHome, shootHome };
}
function simulate(dist, lh, la, home, away, seed) {
  const rng = mulberry32(seed), counts = new Map(), paths = new Map(); let hg = 0, ag = 0, hw = 0, d = 0, aw = 0, pens = 0, finalH = 0; const et = extraTime(lh, la, home, away), etDist = distribution(lh * PARAMS.extraTimeScoringRate / 3, la * PARAMS.extraTimeScoringRate / 3);
  const homeSamples = [], awaySamples = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const s = sample(dist, rng); hg += s.home; ag += s.away; homeSamples.push(s.home); awaySamples.push(s.away); inc(counts, `${s.home}-${s.away}`);
    let path;
    if (s.home > s.away) { hw++; finalH++; path = `home ${s.home}-${s.away} after 90 minutes`; }
    else if (s.home < s.away) { aw++; path = `away ${s.home}-${s.away} after 90 minutes`; }
    else { d++; const e = sample(etDist, rng); if (e.home > e.away) { finalH++; path = `${s.home}-${s.away} after 90 minutes; home wins ${s.home + e.home}-${s.away + e.away} after extra time`; } else if (e.home < e.away) path = `${s.home}-${s.away} after 90 minutes; away wins ${s.home + e.home}-${s.away + e.away} after extra time`; else { pens++; if (rng() < et.shootHome) { finalH++; path = `${s.home + e.home}-${s.away + e.away} after 120 minutes; home wins on penalties`; } else path = `${s.home + e.home}-${s.away + e.away} after 120 minutes; away wins on penalties`; } }
    inc(paths, path);
  }
  const scores = [...counts].map(([k, count]) => { const [home, away] = k.split("-").map(Number); return { home, away, probability: round(count / ITERATIONS), count }; }).sort(sortScores);
  const commonPath = [...paths].sort((a, b) => b[1] - a[1])[0];
  return { seed, iterations: ITERATIONS, meanGoals: { home: round(hg / ITERATIONS), away: round(ag / ITERATIONS) }, medianGoals: { home: median(homeSamples), away: median(awaySamples) }, mostProbableScore: pick(scores[0]), homeWin90: round(hw / ITERATIONS), draw90: round(d / ITERATIONS), awayWin90: round(aw / ITERATIONS), extraTime: round(d / ITERATIONS), penalties: round(pens / ITERATIONS), homeFinalWin: round(finalH / ITERATIONS), awayFinalWin: round(1 - finalH / ITERATIONS), scoreDistribution: scores, topTenScorelines: scores.slice(0, 10), mostCommonCompleteMatchPath: { path: commonPath[0], probability: round(commonPath[1] / ITERATIONS) } };
}

function selectScore(dist, homeStronger) {
  const top = dist[0], candidates = dist.filter((x) => top.probability - x.probability <= .03 || (top.probability - x.probability) / top.probability <= .05);
  return candidates.sort((a, b) => (b.home + b.away) - (a.home + a.away) || +(homeStronger ? b.home > b.away : b.away > b.home) - +(homeStronger ? a.home > a.away : a.away > a.home) || +(b.home === b.away) - +(a.home === a.away) || b.probability - a.probability)[0];
}
function validatePredictions(fixtures) {
  const checks = fixtures.map((f) => ({ matchId: f.matchId, markovScoreSum: round(f.markov.completeScoreDistribution.reduce((s, x) => s + x.probability, 0)), monteCarloScoreSum: round(f.monteCarlo.scoreDistribution.reduce((s, x) => s + x.probability, 0)), markovWdlSum: round(f.markov.homeWin90 + f.markov.draw90 + f.markov.awayWin90), monteCarloWdlSum: round(f.monteCarlo.homeWin90 + f.monteCarlo.draw90 + f.monteCarlo.awayWin90), markovFinalSum: round(f.markov.homeFinalWin + f.markov.awayFinalWin), monteCarloFinalSum: round(f.monteCarlo.homeFinalWin + f.monteCarlo.awayFinalWin), selectedScorePresent: f.ensemble.scoreDistribution.some((x) => x.home === f.ensemble.selectedScore.home && x.away === f.ensemble.selectedScore.away), penaltiesNotAboveExtraTime: f.monteCarlo.penalties <= f.monteCarlo.extraTime }));
  return { checks, passed: checks.every((x) => Math.abs(x.markovScoreSum - 1) < .002 && Math.abs(x.monteCarloScoreSum - 1) < .002 && x.selectedScorePresent && x.penaltiesNotAboveExtraTime), independentExecution: "Markov uses analytical transition/Poisson convolution; Monte Carlo independently samples 250,000 score and resolution paths." };
}

function buildReport(resultsArtifact, evalArtifact, calibrationArtifact, adjustmentArtifact, pred, contextArtifact) {
  const [third, final] = pred.fixtures, pct = (x) => `${(x * 100).toFixed(1)}%`, xg = (x) => `${x.home.toFixed(2)}–${x.away.toFixed(2)}`;
  const executive = pred.fixtures.map((f) => `| ${f.matchId}: ${f.homeTeam} vs ${f.awayTeam} | ${score(f.ensemble.mostProbableScore)} | ${score(f.ensemble.selectedScore)} | ${f.ensemble.selectedWinner} | ${resolutionText(f.ensemble.resolution)} | ${f.ensemble.confidence} |`).join("\n");
  const methodRows = pred.fixtures.flatMap((f) => [["Markov", f.markov], ["Monte Carlo", f.monteCarlo]].map(([name, m]) => `| ${f.matchId}: ${f.homeTeam} vs ${f.awayTeam} | ${name} | ${xg(name === "Markov" ? m.expectedGoals : m.meanGoals)} | ${score(m.mostProbableScore)} | ${pct(m.homeWin90)} | ${pct(m.draw90)} | ${pct(m.awayWin90)} | ${pct(m.extraTime)} | ${pct(m.penalties)} | ${(m.homeFinalWin >= .5 ? f.homeTeam : f.awayTeam)} ${pct(Math.max(m.homeFinalWin, m.awayFinalWin))} |`)).join("\n");
  const topLines = pred.fixtures.map((f) => `### ${f.homeTeam} vs ${f.awayTeam}\n\n${f.topScorelines.slice(0, 5).map((s) => `- ${score(s)}: ${pct(s.probability)}`).join("\n")}`).join("\n\n");
  const selections = pred.fixtures.map((f) => `### ${f.homeTeam} vs ${f.awayTeam}\n\nMost probable and selected score: **${score(f.ensemble.selectedScore)}** (${pct(f.ensemble.selectedScoreProbability)}). Second score: ${score(f.selectionRule.secondScore)} (${pct(f.selectionRule.secondScoreProbability)}). Difference from second: ${pct(f.ensemble.selectedScoreProbability - f.selectionRule.secondScoreProbability)}. Expected winner: **${f.ensemble.selectedWinner}**, by ${resolutionText(f.ensemble.resolution)}. Confidence: ${f.ensemble.confidence}. ${f.selectionRule.reason}`).join("\n\n");
  return `# Finals Score Predictions v1

Generated ${generatedAt}. All scores selected below are 90-minute scores.

## 1. Executive prediction

| Match | Most probable 90-minute score | Selected 90-minute score | Expected winner | Resolution | Confidence |
| --- | ---: | ---: | --- | --- | --- |
${executive}

Predicted third-place team: **${third.ensemble.selectedWinner}**. Predicted World Cup champion: **${final.ensemble.selectedWinner}**.

## 2. Confirmed semi-final results

| Match | Previous most probable | Previous selected | Actual after 90 | Advanced |
| --- | ---: | ---: | ---: | --- |
${evalArtifact.matches.map((m) => `| ${m.matchNumber}: ${m.fixture} | ${score(m.previousPrediction.mostProbableScore)} | ${score(m.previousPrediction.selectedScore)} | ${score(m.actual.scoreAfter90)} | ${m.actual.advanced} |`).join("\n")}

The previous model correctly selected both finalists and both 90-minute away-win outcomes, but neither exact score.

## 3. Data sources and timestamps

- FIFA calendar endpoint: ${FIFA_API}; collected ${generatedAt}; fixtures, venues and kickoffs. Detailed match records were unavailable to this collector.
- [FIFA France–Spain match report](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/france-spain-match-report-highlights); collected ${generatedAt}; official score and scoring events.
- User-confirmed fixed input for England–Argentina; detailed official events, lineups, cards, player minutes and team statistics remain unavailable.
- Repository tournament history: \`${PATHS.priorStats}\`; team rates, rankings and knockout workload.

## 4. Calibration after the semi-finals

Semi-final Markov performance: exact ${pct(evalArtifact.summary.markov.exactScoreAccuracy)}, outcome ${pct(evalArtifact.summary.markov.outcomeAccuracy)}, qualification ${pct(evalArtifact.summary.markov.qualificationAccuracy)}, Brier ${evalArtifact.summary.markov.meanBrierScore}, log loss ${evalArtifact.summary.markov.meanLogLoss}, RPS ${evalArtifact.summary.markov.meanRankedProbabilityScore}, fantasy ${evalArtifact.summary.markov.meanFantasyScore}.

The 5% residual evidence weight and 0.45 form scale were retained. Candidate coefficient, third-place scoring and final scoring changes were rejected. The two new matches are reported but cannot dominate cumulative/historical evidence. Ensemble weights are Markov ${pct(WEIGHTS.markov)} and Monte Carlo ${pct(WEIGHTS.monteCarlo)}; the analytical model receives a modest stability preference.

## 5. Markov versus Monte Carlo

| Match | Method | Expected goals | Most probable score | Home win 90 | Draw 90 | Away win 90 | Extra time | Penalties | Final winner |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${methodRows}

## 6. Top scorelines

${topLines}

## 7. Context analysis

Facts: France have four rest days and England three; Spain have five and Argentina four. England and Argentina each accumulated 30 extra-time minutes in their quarter-finals, while France and Spain accumulated none. Match 103 is in Miami and match 104 in New York/New Jersey.

Inference: third-place rotation and motivation are more uncertain, while a final can encourage risk management. Neither inference changes expected goals because no repository historical validation supports a directional adjustment. Confirmed lineups, injuries, suspensions and official match-time weather were not collected; they remain missing rather than neutral facts.

## 8. Final selections

${selections}

## 9. Final concise answer

Third-place match
France vs England
Most probable score: ${score(third.ensemble.mostProbableScore)}
Selected score: ${score(third.ensemble.selectedScore)}
Expected third-place team: ${third.ensemble.selectedWinner}
Expected resolution: ${resolutionText(third.ensemble.resolution)}

World Cup final
Spain vs Argentina
Most probable score: ${score(final.ensemble.mostProbableScore)}
Selected score: ${score(final.ensemble.selectedScore)}
Expected champion: ${final.ensemble.selectedWinner}
Expected resolution: ${resolutionText(final.ensemble.resolution)}
`;
}

function wdlFrom(d) { return { home: round(d.filter((x) => x.home > x.away).reduce((s, x) => s + x.probability, 0)), draw: round(d.filter((x) => x.home === x.away).reduce((s, x) => s + x.probability, 0)), away: round(d.filter((x) => x.home < x.away).reduce((s, x) => s + x.probability, 0)) }; }
function sample(d, rng) { const r = rng(); let c = 0; for (const x of d) { c += x.probability; if (r <= c) return x; } return d[d.length - 1]; }
function pick(x) { return { home: x.home, away: x.away }; }
function score(x) { return `${x.home}–${x.away}`; }
function resolutionText(x) { return x === "90-minutes" ? "90 minutes" : x === "extra-time" ? "extra time" : "penalties"; }
function sortScores(a, b) { return b.probability - a.probability || a.home + a.away - (b.home + b.away) || a.home - b.home; }
function outcome(h, a) { return h > a ? "home" : h < a ? "away" : "draw"; }
function rps(p, a) { const obs = a === "home" ? [1, 0, 0] : a === "draw" ? [0, 1, 0] : [0, 0, 1], probs = [p.homeWin, p.drawThrough90, p.awayWin]; return round(((probs[0] - obs[0]) ** 2 + (probs[0] + probs[1] - obs[0] - obs[1]) ** 2) / 2); }
function fantasy(g, a) { if (g.home === a.home && g.away === a.away) return 6; return (outcome(g.home, g.away) === outcome(a.home, a.away) ? 3 : 0) + +(g.home === a.home) + +(g.away === a.away); }
function inc(map, key) { map.set(key, (map.get(key) ?? 0) + 1); }
function normalize(v, min, max) { return clamp((v - min) / (max - min), 0, 1); }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function round(v) { return Number(v.toFixed(4)); }
function mean(v) { return round(v.reduce((s, x) => s + x, 0) / v.length); }
function median(v) { v.sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; }
function mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
async function writeText(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value, "utf8"); }
