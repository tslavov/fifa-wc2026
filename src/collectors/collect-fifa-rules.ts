import { sourced } from "../normalize/normalize-sources.js";
import { TournamentRulesSchema, type RuleItem, type TournamentRules } from "../schemas/tournament-rules.schema.js";
import { writeJson } from "./types.js";
import { FIFA_REGULATIONS_SOURCE, FIFA_RULES_EXPLAINER_SOURCE, FIFA_SCHEDULE_PDF_SOURCE } from "./source-refs.js";

function rule(order: number, key: string, label: string, sourceLocation: string, notes?: string): RuleItem {
  return {
    order,
    key,
    label,
    source: FIFA_REGULATIONS_SOURCE,
    sourceLocation,
    notes
  };
}

export function buildTournamentRules(): TournamentRules {
  return {
    datasetId: "world-cup-2026-rules",
    generatedAt: "2026-06-07",
    sources: [FIFA_REGULATIONS_SOURCE, FIFA_RULES_EXPLAINER_SOURCE, FIFA_SCHEDULE_PDF_SOURCE],
    tournament: {
      name: sourced("FIFA World Cup 26", FIFA_REGULATIONS_SOURCE, "Official competition name in FIFA regulations."),
      startDate: sourced("2026-06-11", FIFA_REGULATIONS_SOURCE, "Article 1.5 states the final competition is scheduled from 11 June to 19 July 2026."),
      endDate: sourced("2026-07-19", FIFA_REGULATIONS_SOURCE, "Article 1.5 states the final competition is scheduled from 11 June to 19 July 2026."),
      hostCountries: [
        sourced("Canada", FIFA_REGULATIONS_SOURCE, "Article 12.3 lists Canada as a host country."),
        sourced("Mexico", FIFA_REGULATIONS_SOURCE, "Article 12.3 lists Mexico as a host country."),
        sourced("United States", FIFA_REGULATIONS_SOURCE, "Article 12.3 lists the USA as a host country.")
      ]
    },
    format: {
      totalTeams: sourced(48, FIFA_REGULATIONS_SOURCE, "Article 12.2."),
      groupCount: sourced(12, FIFA_REGULATIONS_SOURCE, "Article 12.2."),
      teamsPerGroup: sourced(4, FIFA_REGULATIONS_SOURCE, "Article 12.2."),
      groupMatchesPerTeam: sourced(3, FIFA_REGULATIONS_SOURCE, "Derived from Article 12.4 league system: each team plays each other team in a four-team group once."),
      groupStageMatchCount: sourced(72, FIFA_REGULATIONS_SOURCE, "Derived from 12 groups x 6 matches per four-team group under Article 12.4."),
      stagesAfterGroup: [
        sourced("Round of 32", FIFA_REGULATIONS_SOURCE, "Article 12.1 and 12.5."),
        sourced("Round of 16", FIFA_REGULATIONS_SOURCE, "Article 12.1."),
        sourced("Quarter-finals", FIFA_REGULATIONS_SOURCE, "Article 12.1."),
        sourced("Semi-finals", FIFA_REGULATIONS_SOURCE, "Article 12.1."),
        sourced("Third-place match", FIFA_REGULATIONS_SOURCE, "Article 12.1."),
        sourced("Final", FIFA_REGULATIONS_SOURCE, "Article 12.1.")
      ]
    },
    pointsSystem: {
      win: sourced(3, FIFA_REGULATIONS_SOURCE, "Article 12.4."),
      draw: sourced(1, FIFA_REGULATIONS_SOURCE, "Article 12.4."),
      loss: sourced(0, FIFA_REGULATIONS_SOURCE, "Article 12.4.")
    },
    qualification: {
      topTeamsPerGroup: sourced(2, FIFA_REGULATIONS_SOURCE, "Article 12.5."),
      bestThirdPlaceTeams: sourced(8, FIFA_REGULATIONS_SOURCE, "Article 12.5."),
      qualifiedFromGroupsTotal: sourced(32, FIFA_REGULATIONS_SOURCE, "Article 12.5 and 12.6."),
      nextRound: sourced("Round of 32", FIFA_REGULATIONS_SOURCE, "Article 12.5.")
    },
    groupRankingTiebreakers: [
      rule(1, "points_all_group_matches", "Greatest number of points obtained in all group matches", "Article 12.4 and Article 13 introduction"),
      rule(2, "head_to_head_points", "Greatest number of points obtained in group matches between tied teams", "Article 13, Step 1(a)"),
      rule(3, "head_to_head_goal_difference", "Superior goal difference in group matches between tied teams", "Article 13, Step 1(b)"),
      rule(4, "head_to_head_goals_scored", "Greatest number of goals scored in group matches between tied teams", "Article 13, Step 1(c)"),
      rule(5, "overall_group_goal_difference", "Superior goal difference in all group matches", "Article 13, Step 2(d)"),
      rule(6, "overall_group_goals_scored", "Greatest number of goals scored in all group matches", "Article 13, Step 2(e)"),
      rule(7, "team_conduct_score", "Highest team conduct score from yellow and red cards", "Article 13, Step 2(f)"),
      rule(8, "latest_fifa_mens_world_ranking", "Most recent published FIFA/Coca-Cola Men's World Ranking", "Article 13, Step 3(g)"),
      rule(9, "previous_fifa_mens_world_rankings", "Progressively older FIFA/Coca-Cola Men's World Rankings until separated", "Article 13, Step 3(h)")
    ],
    thirdPlaceRankingTiebreakers: [
      rule(1, "points_all_group_matches", "Greatest number of points obtained in all group matches", "Article 13, third-place criteria (a)"),
      rule(2, "goal_difference_all_group_matches", "Goal difference resulting from all group matches", "Article 13, third-place criteria (b)"),
      rule(3, "goals_scored_all_group_matches", "Greatest number of goals scored in all group matches", "Article 13, third-place criteria (c)"),
      rule(4, "team_conduct_score", "Highest team conduct score from yellow and red cards in all group matches", "Article 13, third-place criteria (d)"),
      rule(5, "latest_fifa_mens_world_ranking", "Most recent published FIFA/Coca-Cola Men's World Ranking", "Article 13, third-place criteria (e)"),
      rule(6, "previous_fifa_mens_world_rankings", "Progressively older FIFA/Coca-Cola Men's World Rankings until separated", "Article 13, third-place criteria (f)")
    ],
    fairPlayScoreRules: {
      yellowCard: sourced(-1, FIFA_REGULATIONS_SOURCE, "Article 13, Step 2(f)."),
      indirectRedCardSecondYellow: sourced(-3, FIFA_REGULATIONS_SOURCE, "Article 13, Step 2(f)."),
      directRedCard: sourced(-4, FIFA_REGULATIONS_SOURCE, "Article 13, Step 2(f)."),
      yellowCardAndDirectRedCard: sourced(-5, FIFA_REGULATIONS_SOURCE, "Article 13, Step 2(f)."),
      onlyOneDeductionPerPersonPerMatch: sourced(true, FIFA_REGULATIONS_SOURCE, "Article 13, Step 2(f).")
    },
    matchScheduleMetadata: {
      lastGroupMatchesSimultaneous: sourced(true, FIFA_REGULATIONS_SOURCE, "Article 12.4 and Article 16.3."),
      minimumRestDays: sourced(3, FIFA_REGULATIONS_SOURCE, "Article 16.2."),
      matchScheduleSubjectToChange: sourced(true, FIFA_SCHEDULE_PDF_SOURCE, "The official match schedule PDF states the schedule is subject to change."),
      annexeCThirdPlaceCombinationCount: sourced(495, FIFA_REGULATIONS_SOURCE, "Article 12.6 notes Annexe C includes 495 possible combinations.")
    }
  };
}

export async function main() {
  const data = buildTournamentRules();
  await writeJson("data/rules/world-cup-2026-rules.json", data, TournamentRulesSchema);
  console.log("Wrote data/rules/world-cup-2026-rules.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

