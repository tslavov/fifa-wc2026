import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const PATHS = {
  readiness: join("data", "knockout", "round-of-32-readiness-v1.json"),
  standings: join("data", "model", "group-stage-standings-after-group-stage-v1.json"),
  teamStrength: join("data", "model-input", "team-strength.json"),
  adjustments: join("data", "model", "algorithm-adjustments-after-matchday-2.json"),
  stats: join("data", "knockout", "assigned-round-of-32-team-stats-v1.json"),
  predictions: join("data", "predictions", "assigned-round-of-32-score-predictions-v1.json"),
  report: join("reports", "assigned-round-of-32-predictions.md"),
};

async function main() {
  const generatedAt = new Date().toISOString();
  const [readiness, standings, strength, adjustments] = await Promise.all([
    readJson(PATHS.readiness),
    readJson(PATHS.standings),
    readJson(PATHS.teamStrength),
    readJson(PATHS.adjustments),
  ]);

  const assignedMatches = readiness.matches.filter((match) => match.readiness === "assigned");
  const teamStats = buildAssignedTeamStats(assignedMatches, standings, strength.rows, generatedAt);
  await writeJson(PATHS.stats, teamStats);

  const predictions = buildPredictions(assignedMatches, teamStats, readiness, standings, adjustments, generatedAt);
  await writeJson(PATHS.predictions, predictions);
  await writeText(PATHS.report, buildReport(teamStats, predictions));

  console.log(`Wrote ${PATHS.stats}`);
  console.log(`Wrote ${PATHS.predictions}`);
  console.log(`Wrote ${PATHS.report}`);
}

function buildAssignedTeamStats(matches, standings, strengthRows, generatedAt) {
  const strengthByTeam = new Map(strengthRows.map((row) => [teamKey(row.team), row]));
  const standingByTeam = new Map(standings.groups.flatMap((group) => group.standings.map((row) => [teamKey(row.team), row])));
  const teams = [...new Set(matches.flatMap((match) => [match.homeTeam, match.awayTeam]).filter(Boolean).map(teamKey))]
    .map((key) => {
      const row = standingByTeam.get(key);
      const strength = strengthByTeam.get(key);
      if (!row) throw new Error(`Missing group-stage standing for ${key}`);
      return {
        team: row.team,
        group: row.group,
        groupPosition: row.position,
        qualificationRoute: qualificationRoute(row.position),
        countryCode: row.countryCode ?? strength?.countryCode,
        fifaRank: row.fifaRank ?? strength?.fifaRank,
        fifaPoints: strength?.fifaPoints,
        eloRank: strength?.eloRank,
        eloRating: strength?.eloRating,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        points: row.points,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        pointsPerMatch: ratio(row.points, row.played),
        goalsForPerMatch: ratio(row.goalsFor, row.played),
        goalsAgainstPerMatch: ratio(row.goalsAgainst, row.played),
      };
    })
    .sort((a, b) => a.team.localeCompare(b.team));

  return {
    datasetId: "assigned-round-of-32-team-stats-v1",
    artifactKind: "knockout_team_stats",
    generatedAt,
    sourceFiles: {
      readiness: PATHS.readiness,
      standings: PATHS.standings,
      teamStrength: PATHS.teamStrength,
    },
    groupStageStatus: standings.status,
    assignedFixtureCount: matches.length,
    teamCount: teams.length,
    teams,
  };
}

function buildPredictions(matches, teamStats, readiness, standings, adjustments, generatedAt) {
  const params = {
    ...adjustments.updatedParameters.markovChainScorePredictions.modelParameters,
    baseGoalsPerTeamMatch: average(teamStats.teams.map((team) => team.goalsForPerMatch)),
  };
  const modelInputs = buildModelInputs(teamStats.teams, params);
  const byTeam = new Map(modelInputs.map((team) => [teamKey(team.team), team]));
  const predictionMatches = matches.map((fixture) => {
    const home = required(byTeam.get(teamKey(fixture.homeTeam)), `Missing input for ${fixture.homeTeam}`);
    const away = required(byTeam.get(teamKey(fixture.awayTeam)), `Missing input for ${fixture.awayTeam}`);
    const lambdaHome = expectedGoals(home, away, params);
    const lambdaAway = expectedGoals(away, home, params);
    const distribution = buildScoreDistribution(lambdaHome, lambdaAway, params).map((score) => ({
      homeGoals: score.goalsA,
      awayGoals: score.goalsB,
      probability: score.probability,
    }));
    const metrics = calculateScoreDistributionMetrics(distribution);
    const topWithFantasy = metrics.topScorelines.map((score) => ({
      ...score,
      expectedFantasyPoints: calculateFantasyExpectedPoints(score, distribution),
    }));
    const mostProbable = topWithFantasy[0];
    const expectedPointsScore = [...topWithFantasy].sort((a, b) => b.expectedFantasyPoints - a.expectedFantasyPoints || b.probability - a.probability)[0];
    const selected = mostProbable;
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
      selectedScore: { home: selected.homeGoals, away: selected.awayGoals },
      mostProbableScore: { home: mostProbable.homeGoals, away: mostProbable.awayGoals },
      selectedScoreProbability: selected.probability,
      mostProbableScoreProbability: mostProbable.probability,
      selectedExpectedPointsScore: {
        home: expectedPointsScore.homeGoals,
        away: expectedPointsScore.awayGoals,
        probability: expectedPointsScore.probability,
        expectedFantasyPoints: expectedPointsScore.expectedFantasyPoints,
      },
      outcomeProbabilities: {
        homeWin: metrics.homeWinProbability,
        drawThrough90: metrics.drawProbability,
        awayWin: metrics.awayWinProbability,
      },
      advancementLeanThrough90: advancementLean(metrics),
      expectedGoals: { home: metrics.expectedHomeGoals, away: metrics.expectedAwayGoals },
      confidenceLevel: confidenceLevel(metrics),
      topScorelines: topWithFantasy,
      teamContext: {
        home: context(home),
        away: context(away),
      },
      reasoningNote: reasoningNote(fixture, metrics, home, away),
    };
  });

  return {
    artifactKind: "prediction",
    predictionId: "assigned-round-of-32-score-predictions-v1",
    predictionType: "round_of_32_assigned_fixture_score_predictions",
    generatedAt,
    excludeFromFuturePredictionInputs: true,
    doNotUseAsTrainingData: true,
    contaminationControl: {
      builderInputPaths: [PATHS.readiness, PATHS.standings, PATHS.teamStrength, PATHS.adjustments],
      predictionDirectoryReadAsInputForPrediction: false,
      notes: "Predictions use assigned FIFA knockout fixtures, current group-stage standings, collected team-strength inputs, and existing global calibration only.",
    },
    groupStageStatus: standings.status,
    completionStatus: readiness.completionStatus,
    scope: {
      stage: "Round of 32",
      assignedFixturesOnly: true,
      predictedFixtureCount: predictionMatches.length,
      skippedUnassignedFixtures: readiness.expectedRoundOf32Fixtures - predictionMatches.length,
    },
    method: {
      type: "knockout_markov_score_distribution_from_group_stage_stats",
      modelParameters: params,
      scoreSelection: adjustments.updatedParameters.markovChainScorePredictions.scoreSelection,
      ninetyMinuteOnly: true,
      notes: "Knockout extra time and penalties are not modeled; draw probability is reported as draw-through-90.",
    },
    matches: predictionMatches,
    warnings: [
      ...(standings.status === "final" ? [] : ["Group stage is not fully final; predictions cover only currently assigned Round of 32 fixtures."]),
      "Knockout advancement after extra time/penalties is not modeled.",
    ],
  };
}

function buildModelInputs(teams, params) {
  const fifaPoints = teams.flatMap((team) => Number.isFinite(team.fifaPoints) ? [team.fifaPoints] : []);
  const fifaRanks = teams.flatMap((team) => Number.isFinite(team.fifaRank) ? [team.fifaRank] : []);
  const eloRatings = teams.flatMap((team) => Number.isFinite(team.eloRating) ? [team.eloRating] : []);
  const pointsPerMatch = teams.map((team) => team.pointsPerMatch);
  const goalDifferencePerMatch = teams.map((team) => ratio(team.goalDifference, team.played));
  const avgFor = average(teams.map((team) => team.goalsForPerMatch));
  const avgAgainst = average(teams.map((team) => team.goalsAgainstPerMatch));

  return teams.map((team) => {
    const qualityParts = [
      scorePart(normalizeRange(team.fifaPoints, Math.min(...fifaPoints), Math.max(...fifaPoints)), 0.25),
      scorePart(normalizeInverseRange(team.fifaRank, Math.min(...fifaRanks), Math.max(...fifaRanks)), 0.15),
      scorePart(normalizeRange(team.eloRating, Math.min(...eloRatings), Math.max(...eloRatings)), 0.25),
      scorePart(normalizeRange(team.pointsPerMatch, Math.min(...pointsPerMatch), Math.max(...pointsPerMatch)), 0.2),
      scorePart(normalizeRange(ratio(team.goalDifference, team.played), Math.min(...goalDifferencePerMatch), Math.max(...goalDifferencePerMatch)), 0.15),
    ].filter((part) => Number.isFinite(part.value));
    const totalWeight = qualityParts.reduce((sum, part) => sum + part.weight, 0);
    return {
      ...team,
      attackIndex: clamp(team.goalsForPerMatch / Math.max(0.01, avgFor), 0.25, 2.75),
      defensiveVulnerabilityIndex: clamp(team.goalsAgainstPerMatch / Math.max(0.01, avgAgainst), 0.2, 3.2),
      qualityScore: qualityParts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight,
      params,
    };
  });
}

function buildReport(teamStats, predictions) {
  return [
    "# Assigned Round of 32 Predictions",
    "",
    `Generated: ${predictions.generatedAt}`,
    "",
    "## Scope",
    "",
    `- Assigned Round of 32 fixtures predicted: ${predictions.scope.predictedFixtureCount}.`,
    `- Unassigned Round of 32 fixtures skipped: ${predictions.scope.skippedUnassignedFixtures}.`,
    `- Group-stage status: ${predictions.groupStageStatus}.`,
    "- Predictions are 90-minute score distributions; extra time and penalties are not modeled.",
    "",
    "## Predictions",
    "",
    "| Match | Selected | Most probable | W/D/L through 90 | xG | Lean | Confidence | Note |",
    "| --- | ---: | ---: | --- | ---: | --- | --- | --- |",
    ...predictions.matches.map((match) => `| ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam} | ${match.selectedScore.home}-${match.selectedScore.away} | ${match.mostProbableScore.home}-${match.mostProbableScore.away} (${percent(match.mostProbableScoreProbability)}) | ${percent(match.outcomeProbabilities.homeWin)} / ${percent(match.outcomeProbabilities.drawThrough90)} / ${percent(match.outcomeProbabilities.awayWin)} | ${match.expectedGoals.home}-${match.expectedGoals.away} | ${match.advancementLeanThrough90} | ${match.confidenceLevel} | ${match.reasoningNote} |`),
    "",
    "## Assigned Team Stats",
    "",
    "| Team | Group | Route | Pts | GD | GF | GA | PPG | GF/G | GA/G | FIFA | Elo |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...teamStats.teams.map((team) => `| ${team.team} | ${team.group} | ${team.qualificationRoute} | ${team.points} | ${team.goalDifference} | ${team.goalsFor} | ${team.goalsAgainst} | ${team.pointsPerMatch} | ${team.goalsForPerMatch} | ${team.goalsAgainstPerMatch} | ${team.fifaRank ?? ""} | ${team.eloRating ?? ""} |`),
    "",
    "## Top Scorelines",
    "",
    ...predictions.matches.flatMap((match) => [
      `### ${match.matchNumber}: ${match.homeTeam} vs ${match.awayTeam}`,
      "",
      `Selected score: ${match.selectedScore.home}-${match.selectedScore.away}.`,
      "",
      match.topScorelines.map((score) => `${score.homeGoals}-${score.awayGoals} ${percent(score.probability)}, xFP ${score.expectedFantasyPoints}`).join("; "),
      "",
    ]),
    ...(predictions.warnings.length === 0 ? [] : ["## Warnings", "", ...predictions.warnings.map((warning) => `- ${warning}`), ""]),
  ].join("\n");
}

function expectedGoals(team, opponent, params) {
  const qualityMultiplier = Math.exp((team.qualityScore - opponent.qualityScore) * params.qualityMultiplierScale);
  const groupFormBlend = Math.sqrt(team.attackIndex * opponent.defensiveVulnerabilityIndex);
  return round(clamp(params.baseGoalRateMultiplier * params.baseGoalsPerTeamMatch * groupFormBlend * qualityMultiplier, params.lambdaMin, params.lambdaMax));
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
    topScorelines: [...normalized]
      .sort((a, b) => b.probability - a.probability || a.homeGoals - b.homeGoals || a.awayGoals - b.awayGoals)
      .slice(0, 5)
      .map((score) => ({ homeGoals: score.homeGoals, awayGoals: score.awayGoals, probability: round(score.probability) })),
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

function reasoningNote(fixture, metrics, home, away) {
  const lean = advancementLean(metrics);
  return `${home.team} group form ${home.points} pts/${home.goalDifference} GD vs ${away.team} ${away.points} pts/${away.goalDifference} GD; 90-minute lean is ${lean}.`;
}

function advancementLean(metrics) {
  if (metrics.homeWinProbability > metrics.awayWinProbability && metrics.homeWinProbability > metrics.drawProbability) return "home";
  if (metrics.awayWinProbability > metrics.homeWinProbability && metrics.awayWinProbability > metrics.drawProbability) return "away";
  return "draw/extra-time risk";
}

function confidenceLevel(metrics) {
  const maxOutcome = Math.max(metrics.homeWinProbability, metrics.drawProbability, metrics.awayWinProbability);
  const top = metrics.topScorelines[0]?.probability ?? 0;
  if (maxOutcome >= 0.68 && top >= 0.11) return "High";
  if (maxOutcome >= 0.54 || top >= 0.1) return "Medium";
  return "Low";
}

function context(team) {
  return {
    group: team.group,
    groupPosition: team.groupPosition,
    qualificationRoute: team.qualificationRoute,
    points: team.points,
    goalDifference: team.goalDifference,
    goalsFor: team.goalsFor,
    goalsAgainst: team.goalsAgainst,
    fifaRank: team.fifaRank,
    eloRating: team.eloRating,
  };
}

function qualificationRoute(position) {
  if (position <= 2) return "top_two";
  if (position === 3) return "best_third";
  return "unknown";
}

function scorePart(value, weight) {
  return { value, weight };
}

function outcome(home, away) {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
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
  return `${Math.round(value * 1000) / 10}%`;
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
