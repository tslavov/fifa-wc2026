import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIFA_SCORES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";
const FIFA_API_URL = "https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023";

const PATHS = {
  groups: "fifa-world-cup-2026-groups.md",
  rules: join("data", "rules", "world-cup-2026-rules.json"),
  teamStrength: join("data", "model-input", "team-strength.json"),
  groupResults: join("data", "results", "group-stage-results-v1.json"),
  standings: join("data", "model", "group-stage-standings-after-group-stage-v1.json"),
  knockoutReadiness: join("data", "knockout", "round-of-32-readiness-v1.json"),
  report: join("reports", "round-of-32-readiness.md"),
};

const aliases = new Map();
function addAlias(canonical, names) {
  for (const name of names) aliases.set(teamKey(name), canonical);
}
addAlias("United States", ["USA", "United States", "United States of America"]);
addAlias("South Korea", ["South Korea", "Korea Republic"]);
addAlias("Iran", ["Iran", "IR Iran"]);
addAlias("Ivory Coast", ["Ivory Coast", "Cote d'Ivoire", "Cote d Ivoire", "Côte d'Ivoire"]);
addAlias("DR Congo", ["DR Congo", "Congo DR", "Congo Democratic Republic", "Democratic Republic of Congo"]);
addAlias("Cape Verde", ["Cape Verde", "Cabo Verde"]);
addAlias("Czechia", ["Czechia", "Czech Republic"]);
addAlias("Turkey", ["Turkey", "Turkiye"]);
addAlias("Curacao", ["Curacao", "Curaçao"]);
addAlias("Bosnia and Herzegovina", ["Bosnia and Herzegovina", "Bosnia-Herzegovina"]);

async function main() {
  const generatedAt = new Date().toISOString();
  const [groups, rules, teamStrength, fifaCalendar] = await Promise.all([
    readFile(PATHS.groups, "utf8").then(parseGroups),
    readJson(PATHS.rules).then(parseRules),
    readJson(PATHS.teamStrength),
    fetchFifaCalendar(),
  ]);

  const fixtures = fifaCalendar.Results.map((match) => normalizeFixture(match, generatedAt)).sort((a, b) => a.matchNumber - b.matchNumber);
  const groupFixtures = fixtures.filter((fixture) => fixture.matchNumber >= 1 && fixture.matchNumber <= 72);
  const knockoutFixtures = fixtures.filter((fixture) => fixture.matchNumber >= 73);

  const groupResults = buildGroupResults(groupFixtures, generatedAt);
  await writeJson(PATHS.groupResults, groupResults);

  const standings = buildStandings(groups, rules, groupResults, teamStrength.rows, generatedAt);
  await writeJson(PATHS.standings, standings);

  const readiness = buildKnockoutReadiness(knockoutFixtures, standings, groupResults, generatedAt);
  await writeJson(PATHS.knockoutReadiness, readiness);
  await writeText(PATHS.report, buildReport(groupResults, standings, readiness));

  console.log(`Wrote ${PATHS.groupResults}`);
  console.log(`Wrote ${PATHS.standings}`);
  console.log(`Wrote ${PATHS.knockoutReadiness}`);
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
  const fixture = {
    matchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    stage: optionalDescription(match.StageName) ?? stageFromMatchNumber(match.MatchNumber),
    group: optionalDescription(match.GroupName) ? groupLetter(optionalDescription(match.GroupName)) : undefined,
    round: match.MatchNumber <= 72 ? "group_stage" : "knockout",
    matchday: match.MatchNumber <= 72 ? matchdayFromMatchNumber(match.MatchNumber) : undefined,
    date: match.Date?.slice(0, 10),
    utcDateTime: match.Date,
    localDateTime: match.LocalDate,
    venue: optionalDescription(match.Stadium?.Name) ?? "Unknown venue",
    city: optionalDescription(match.Stadium?.CityName),
    country: match.Stadium?.IdCountry,
    homeTeam,
    awayTeam,
    sourceUrl: FIFA_SCORES_URL,
    sourceApiUrl: FIFA_API_URL,
    fetchedAt,
    officialStatus: {
      matchStatus: match.MatchStatus,
      resultType: match.ResultType,
      officialityStatus: match.OfficialityStatus,
      statusLabel: statusLabel(match),
    },
  };
  if (isOfficialFinal(match)) {
    return {
      ...fixture,
      finalScore: { home: homeScore, away: awayScore },
      outcome: outcome(homeScore, awayScore),
      goalDifference: homeScore - awayScore,
    };
  }
  return {
    ...fixture,
    status: statusLabel(match),
    ...(Number.isInteger(homeScore) && Number.isInteger(awayScore) ? { scoreAtFetch: { home: homeScore, away: awayScore } } : {}),
  };
}

function buildGroupResults(fixtures, generatedAt) {
  const completedFixtures = fixtures.filter((fixture) => fixture.finalScore);
  const incompleteFixtures = fixtures.filter((fixture) => !fixture.finalScore);
  return {
    datasetId: "group-stage-results-v1",
    artifactKind: "collected_results",
    generatedAt,
    source: {
      sourceName: "FIFA World Cup 2026 scores and fixtures",
      sourceUrl: FIFA_SCORES_URL,
      sourceApiUrl: FIFA_API_URL,
      fetchedAt: generatedAt,
      notes: "Official FIFA match calendar API. Full group stage selected by official match numbers 1-72.",
    },
    matchdayDefinition: {
      round: "group_stage",
      includedMatchdays: [1, 2, 3],
      expectedFixtureCount: 72,
      fixtureSelector: "FIFA match numbers 1-72",
    },
    completionStatus: {
      expectedFixtures: 72,
      completedFixtures: completedFixtures.length,
      incompleteFixtures: incompleteFixtures.length,
      allGroupStageFixturesFinal: incompleteFixtures.length === 0,
    },
    results: completedFixtures,
    incompleteFixtures,
    warnings: incompleteFixtures.length === 0 ? [] : [`FIFA official feed had ${incompleteFixtures.length} group-stage fixtures not final at fetch time; standings and qualifiers are current/provisional.`],
  };
}

function buildStandings(groups, rules, groupResults, strengthRows, generatedAt) {
  const strengthByTeam = new Map(strengthRows.map((row) => [teamKey(row.team), row]));
  const rows = new Map();
  for (const group of groups) {
    for (const team of group.teams) {
      const strength = strengthByTeam.get(teamKey(team));
      rows.set(teamKey(team), {
        team,
        group: group.group,
        countryCode: strength?.countryCode,
        fifaRank: strength?.fifaRank,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      });
    }
  }

  for (const result of groupResults.results) {
    const home = rows.get(teamKey(result.homeTeam));
    const away = rows.get(teamKey(result.awayTeam));
    if (!home || !away) continue;
    applyTeamResult(home, result.finalScore.home, result.finalScore.away, rules);
    applyTeamResult(away, result.finalScore.away, result.finalScore.home, rules);
  }

  const resultsByGroup = new Map();
  for (const result of groupResults.results) {
    resultsByGroup.set(result.group, [...(resultsByGroup.get(result.group) ?? []), result]);
  }

  const groupStandings = groups.map((group) => {
    const groupRows = group.teams.map((team) => rows.get(teamKey(team)));
    const ranked = rankRows(groupRows, resultsByGroup.get(group.group) ?? []).map((row, index) => ({ position: index + 1, ...row }));
    const incompleteFixtures = groupResults.incompleteFixtures.filter((fixture) => fixture.group === group.group);
    return {
      group: group.group,
      status: incompleteFixtures.length === 0 ? "final" : "provisional",
      incompleteFixtures,
      standings: ranked,
      qualifiedTopTwo: ranked.slice(0, 2).map((row) => qualificationRow(row, "top_two")),
      thirdPlaceCandidate: qualificationRow(ranked[2], "third_place"),
      eliminated: ranked.slice(3).map((row) => qualificationRow(row, "eliminated")),
    };
  });

  const thirdPlaceRanking = rankThirdPlaceRows(groupStandings.map((group) => group.standings[2])).map((row, index) => ({
    rank: index + 1,
    advances: index < rules.bestThirdPlaceTeams,
    ...row,
  }));
  const qualifiedTeams = [
    ...groupStandings.flatMap((group) => group.qualifiedTopTwo),
    ...thirdPlaceRanking.filter((row) => row.advances).map((row) => qualificationRow(row, "best_third")),
  ].sort((a, b) => a.group.localeCompare(b.group) || a.position - b.position);

  return {
    datasetId: "group-stage-standings-after-group-stage-v1",
    artifactKind: "standings",
    generatedAt,
    sourceResultFile: PATHS.groupResults,
    status: groupResults.completionStatus.allGroupStageFixturesFinal ? "final" : "provisional",
    qualificationRules: {
      groupWinnersAndRunnersUp: 24,
      bestThirdPlaceTeams: rules.bestThirdPlaceTeams,
      qualifiedFromGroupsTotal: 32,
      tiebreakersApplied: ["points", "head-to-head points", "head-to-head goal difference", "head-to-head goals scored", "overall goal difference", "overall goals scored", "FIFA rank fallback"],
      thirdPlaceTiebreakersApplied: ["points", "goal difference", "goals scored", "FIFA rank fallback"],
    },
    completionStatus: groupResults.completionStatus,
    groups: groupStandings,
    thirdPlaceRanking,
    qualifiedTeams,
    eliminatedTeams: groupStandings.flatMap((group) => group.standings.filter((row) => row.position === 4).map((row) => qualificationRow(row, "eliminated"))),
    warnings: [
      ...groupResults.warnings,
      ...(groupResults.completionStatus.allGroupStageFixturesFinal ? [] : ["Best third-place qualifiers are provisional until all group-stage fixtures are final."]),
    ],
  };
}

function buildKnockoutReadiness(fixtures, standings, groupResults, generatedAt) {
  const roundOf32 = fixtures.filter((fixture) => fixture.stage === "Round of 32" || (fixture.matchNumber >= 73 && fixture.matchNumber <= 88));
  const matches = roundOf32.map((fixture) => ({
    matchId: fixture.matchId,
    matchNumber: fixture.matchNumber,
    stage: fixture.stage,
    date: fixture.date,
    utcDateTime: fixture.utcDateTime,
    venue: fixture.venue,
    city: fixture.city,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    status: fixture.officialStatus.statusLabel,
    readiness: fixture.homeTeam && fixture.awayTeam ? "assigned" : "awaiting_team_assignment",
    missingSlots: [
      ...(fixture.homeTeam ? [] : ["home"]),
      ...(fixture.awayTeam ? [] : ["away"]),
    ],
  })).sort((a, b) => a.matchNumber - b.matchNumber);

  return {
    datasetId: "round-of-32-readiness-v1",
    artifactKind: "knockout_readiness",
    generatedAt,
    source: {
      sourceName: "FIFA World Cup 2026 scores and fixtures",
      sourceUrl: FIFA_SCORES_URL,
      sourceApiUrl: FIFA_API_URL,
      fetchedAt: generatedAt,
    },
    groupStageStatus: groupResults.completionStatus.allGroupStageFixturesFinal ? "final" : "provisional",
    completionStatus: groupResults.completionStatus,
    assignedRoundOf32Fixtures: matches.filter((match) => match.readiness === "assigned").length,
    expectedRoundOf32Fixtures: 16,
    matches,
    qualifiedTeams: standings.qualifiedTeams,
    thirdPlaceRanking: standings.thirdPlaceRanking,
    warnings: standings.warnings,
  };
}

function buildReport(groupResults, standings, readiness) {
  return [
    "# Round of 32 Readiness",
    "",
    `Generated: ${readiness.generatedAt}`,
    "",
    "## Group Stage Data",
    "",
    `- Official group-stage finals collected: ${groupResults.completionStatus.completedFixtures}/${groupResults.completionStatus.expectedFixtures}.`,
    `- Group-stage status: ${standings.status}.`,
    `- Round of 32 assigned fixtures: ${readiness.assignedRoundOf32Fixtures}/${readiness.expectedRoundOf32Fixtures}.`,
    `- Result source: ${FIFA_SCORES_URL}`,
    "",
    ...(groupResults.incompleteFixtures.length === 0 ? [] : [
      "## Pending Group Fixtures",
      "",
      "| Match | Group | Date | Fixture | Status |",
      "| ---: | --- | --- | --- | --- |",
      ...groupResults.incompleteFixtures.map((match) => `| ${match.matchNumber} | ${match.group} | ${match.date ?? ""} | ${match.homeTeam ?? "TBD"} vs ${match.awayTeam ?? "TBD"} | ${match.status} |`),
      "",
    ]),
    "## Current Qualified Teams",
    "",
    "| Team | Group | Route | Pos | Pts | GD | GF |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...standings.qualifiedTeams.map((row) => `| ${row.team} | ${row.group} | ${formatRoute(row.route)} | ${row.position} | ${row.points} | ${row.goalDifference} | ${row.goalsFor} |`),
    "",
    "## Third-Place Ranking",
    "",
    "| Rank | Team | Group | Advances | Pts | GD | GF |",
    "| ---: | --- | --- | --- | ---: | ---: | ---: |",
    ...standings.thirdPlaceRanking.map((row) => `| ${row.rank} | ${row.team} | ${row.group} | ${row.advances ? "Yes" : "No"} | ${row.points} | ${row.goalDifference} | ${row.goalsFor} |`),
    "",
    "## Round of 32 Fixtures",
    "",
    "| Match | Date | Venue | Fixture | Readiness |",
    "| ---: | --- | --- | --- | --- |",
    ...readiness.matches.map((match) => `| ${match.matchNumber} | ${match.date ?? ""} | ${match.venue} | ${match.homeTeam ?? "TBD"} vs ${match.awayTeam ?? "TBD"} | ${match.readiness} |`),
    "",
    "## Group Standings",
    "",
    ...standings.groups.flatMap((group) => [
      `### Group ${group.group} (${group.status})`,
      "",
      "| Pos | Team | Pld | W | D | L | GF | GA | GD | Pts |",
      "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...group.standings.map((row) => `| ${row.position} | ${row.team} | ${row.played} | ${row.wins} | ${row.draws} | ${row.losses} | ${row.goalsFor} | ${row.goalsAgainst} | ${row.goalDifference} | ${row.points} |`),
      "",
    ]),
    ...(standings.warnings.length === 0 ? [] : ["## Warnings", "", ...standings.warnings.map((warning) => `- ${warning}`), ""]),
  ].join("\n");
}

function rankRows(rows, matches) {
  return [...rows].sort((a, b) => compareGroupRows(a, b, rows, matches));
}

function compareGroupRows(a, b, tiedRows, matches) {
  const tied = tiedRows.filter((row) => row.points === a.points && row.points === b.points);
  const h2hA = headToHead(a, tied, matches);
  const h2hB = headToHead(b, tied, matches);
  return (
    b.points - a.points ||
    h2hB.points - h2hA.points ||
    h2hB.goalDifference - h2hA.goalDifference ||
    h2hB.goalsFor - h2hA.goalsFor ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    (a.fifaRank ?? Number.MAX_SAFE_INTEGER) - (b.fifaRank ?? Number.MAX_SAFE_INTEGER) ||
    a.team.localeCompare(b.team)
  );
}

function headToHead(row, tiedRows, matches) {
  const tiedKeys = new Set(tiedRows.map((item) => teamKey(item.team)));
  const ownKey = teamKey(row.team);
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const match of matches) {
    const homeKey = teamKey(match.homeTeam);
    const awayKey = teamKey(match.awayTeam);
    if (!tiedKeys.has(homeKey) || !tiedKeys.has(awayKey)) continue;
    if (homeKey === ownKey) {
      goalsFor += match.finalScore.home;
      goalsAgainst += match.finalScore.away;
      points += pointsFor(match.finalScore.home, match.finalScore.away);
    }
    if (awayKey === ownKey) {
      goalsFor += match.finalScore.away;
      goalsAgainst += match.finalScore.home;
      points += pointsFor(match.finalScore.away, match.finalScore.home);
    }
  }
  return { points, goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst };
}

function rankThirdPlaceRows(rows) {
  return [...rows].sort((a, b) => (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    (a.fifaRank ?? Number.MAX_SAFE_INTEGER) - (b.fifaRank ?? Number.MAX_SAFE_INTEGER) ||
    a.team.localeCompare(b.team)
  ));
}

function qualificationRow(row, route) {
  return {
    team: row.team,
    group: row.group,
    route,
    position: row.position,
    points: row.points,
    goalDifference: row.goalDifference,
    goalsFor: row.goalsFor,
    fifaRank: row.fifaRank,
  };
}

function applyTeamResult(row, goalsFor, goalsAgainst, rules) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += rules.winPoints;
  } else if (goalsFor < goalsAgainst) {
    row.losses += 1;
    row.points += rules.lossPoints;
  } else {
    row.draws += 1;
    row.points += rules.drawPoints;
  }
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
    bestThirdPlaceTeams: value.qualification.bestThirdPlaceTeams.value,
  };
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

function stageFromMatchNumber(matchNumber) {
  if (matchNumber <= 72) return "First Stage";
  if (matchNumber <= 88) return "Round of 32";
  if (matchNumber <= 96) return "Round of 16";
  if (matchNumber <= 100) return "Quarter-final";
  if (matchNumber <= 102) return "Semi-final";
  if (matchNumber === 103) return "Third-place match";
  if (matchNumber === 104) return "Final";
  return "Unknown";
}

function matchdayFromMatchNumber(matchNumber) {
  if (matchNumber >= 1 && matchNumber <= 24) return 1;
  if (matchNumber >= 25 && matchNumber <= 48) return 2;
  if (matchNumber >= 49 && matchNumber <= 72) return 3;
  return undefined;
}

function groupLetter(value) {
  const match = value?.match(/Group ([A-L])/);
  if (!match) throw new Error(`Cannot parse group from ${value}`);
  return match[1];
}

function pointsFor(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

function outcome(home, away) {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
}

function normalizeTeamName(name) {
  if (!name) return undefined;
  const cleaned = name.trim().replace(/\s+/g, " ");
  return aliases.get(teamKey(cleaned)) ?? cleaned;
}

function teamKey(name) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function optionalDescription(localized) {
  return localized?.find((entry) => entry.Locale?.toLowerCase() === "en-gb")?.Description ?? localized?.[0]?.Description;
}

function firstNumber(...values) {
  return values.find((value) => Number.isInteger(value));
}

function formatRoute(route) {
  return route === "top_two" ? "Top two" : route === "best_third" ? "Best third" : route;
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
