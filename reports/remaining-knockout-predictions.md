# Remaining Knockout Predictions

Generated: 2026-07-13T22:05:00.808Z

## 1. Collection Summary

- Official quarter-final results, venues, kickoff times and match duration labels collected from FIFA.
- FIFA calendar endpoint did not expose lineups, cards, event data, player minutes, xG or advanced match metrics.
- Semi-final teams are fixed from official quarter-final advancement; final and third-place fixtures are conditional on predicted semi-final winners.

## 2. Data Sources And Timestamps

- FIFA calendar API: https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023
- Collected: 2026-07-13T22:05:00.808Z
- Team stats: data\knockout\semi-final-team-stats-v1.json
- Prediction artifact: data\predictions\remaining-knockout-score-predictions-v1.json
- Last-minute context: data\context\semi-final-last-minute-context-v1.json

## 3. Quarter-Final Actual Results

| Match | Venue | Kickoff UTC | Result | ET | Pens | Advanced | Playing minutes |
| ---: | --- | --- | --- | --- | --- | --- | ---: |
| 97: France vs Morocco | Boston Stadium | 2026-07-09T20:00:00Z | 2-0 |  |  | France | 90 |
| 98: Spain vs Belgium | Los Angeles Stadium | 2026-07-10T19:00:00Z | 2-1 |  |  | Spain | 90 |
| 99: Norway vs England | Miami Stadium | 2026-07-11T21:00:00Z | 1-2 | 1-2 |  | England | 120 |
| 100: Argentina vs Switzerland | Kansas City Stadium | 2026-07-12T01:00:00Z | 3-1 | 3-1 |  | Argentina | 120 |

## 4. Last-Minute Context Applied

- Context dataset: semi-final-last-minute-context-v1 (2026-07-14T00:00:00+03:00).
- Global: Yellow-card accumulation is reported as reset after the quarter-finals, reducing semi-final suspension risk from accumulated yellows. No yellow-card accumulation suspension penalty applied for semi-final predictions.

| Match | Applied xG multipliers | Context summary | Sources |
| --- | --- | --- | --- |
| 101: France vs Spain | France 1.004, Spain 0.998 | France have the longer rest window after a 90-minute quarter-final; Spain are reported fully fit, while France's Mbappe and Kone concerns are described as minor. Controlled AT&T Stadium conditions keep weather neutral. | [AP News](https://apnews.com/article/1fcbd397cb402688024b706f222b1b93); [talkSPORT](https://talksport.com/football/world-cup/4411822/where-to-watch-france-v-spain-tv-channel-free-live-stream/); [talkSPORT](https://talksport.com/betting/4411918/france-vs-spain-bet-builder-tips/) |
| 102: England vs Argentina | England 0.999, Argentina 0.997 | England's Rice, Bellingham and James are reported fit or expected to be available, but Rice illness/managed fitness and Argentina's slightly shorter recovery after extra time keep both teams close to neutral. Atlanta roof/climate control keeps weather neutral for on-field play. | [The Guardian](https://www.theguardian.com/football/2026/jul/13/england-declan-rice-winning-fitness-battle-argentina-world-cup); [The Guardian live blog](https://www.theguardian.com/football/live/2026/jul/13/world-cup-2026-buildup-to-blockbuster-semi-finals-infantino-hints-at-64-team-expansion-live); [The Sun](https://www.thesun.co.uk/sport/39741266/is-atlanta-stadium-air-conditioned-weather-england-argentina/) |

- Warning: No official starting lineups were available at collection time.
- Warning: No trusted xG, shot, event, player-minute, or complete card-log source was added.
- Warning: News-source availability notes are treated conservatively and do not override official results or team-strength inputs.

## 5. Semi-Final Predictions

| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Pick | Confidence | Reason |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 101: France vs Spain | 1.4862-2.1284 | 1-2 (9.2%) | 1-3 | 26.6% / 20.9% / 52.5% | 20.9% | 49.9% / 10.4% | France 35.7%, Spain 64.3% | Spain | Medium / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 1-2. France residual-updated GF/GA 2.9759-0.4722 vs Spain 1.9537-0.0975; quarter-final score update uses 5% of opponent-adjusted residual only. Last-minute xG multipliers: France 1.004, Spain 0.998. |
| 102: England vs Argentina | 1.5313-3.7277 | 1-3 (7%) | 2-4 | 10.9% / 11.6% / 77.6% | 11.6% | 38.2% / 4.4% | England 14.4%, Argentina 85.6% | Argentina | High / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 1-3. England residual-updated GF/GA 1.9807-1.0466 vs Argentina 2.7622-0.835; quarter-final score update uses 5% of opponent-adjusted residual only. Last-minute xG multipliers: England 0.999, Argentina 0.997. |

## 6. Conditional Third-Place Match

| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Pick | Confidence | Reason |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 103: France vs England | 3.8705-1.3263 | 3-1 (7.2%) | 5-1 | 82.4% / 9.8% / 7.8% | 9.8% | 37.6% / 3.7% | France 89.5%, England 10.6% | France | High / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 3-1. France residual-updated GF/GA 2.9759-0.4722 vs England 1.9807-1.0466; quarter-final score update uses 5% of opponent-adjusted residual only. No sourced last-minute numeric adjustment for this fixture. |

## 7. Conditional Final

| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Pick | Confidence | Reason |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 104: Spain vs Argentina | 2.4692-1.4291 | 2-1 (9%) | 3-1 | 60.5% / 18.7% / 20.9% | 18.7% | 47.5% / 8.9% | Spain 71.6%, Argentina 28.4% | Spain | Medium / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 2-1. Spain residual-updated GF/GA 1.9537-0.0975 vs Argentina 2.7622-0.835; quarter-final score update uses 5% of opponent-adjusted residual only. No sourced last-minute numeric adjustment for this fixture. |

## 8. Champion Probabilities

- Spain: 48.2%
- Argentina: 28.2%
- France: 22.5%
- England: 1.1%

## 9. Possible Final Pairings

- Spain vs Argentina: 55.1%
- France vs Argentina: 30.5%
- Spain vs England: 9.3%
- France vs England: 5.2%

## 10. Score Probability Matrices

- 101: France vs Spain: 1-2 9.2%; 1-1 8.5%; 2-2 6.9%; 1-3 6.5%; 2-1 6.4%; 0-2 6.1%; 0-1 5.6%; 2-3 4.9%; 0-3 4.3%; 1-0 3.9%
- 102: England vs Argentina: 1-3 7%; 1-4 6.6%; 1-2 5.5%; 2-3 5.4%; 2-4 5.1%; 1-5 4.9%; 0-3 4.5%; 2-2 4.3%; 0-4 4.2%; 2-5 3.8%
- 103: France vs England: 3-1 7.2%; 4-1 7.1%; 2-1 5.5%; 5-1 5.5%; 3-0 5.4%; 4-0 5.2%; 3-2 4.8%; 4-2 4.7%; 2-0 4.1%; 5-0 4.1%
- 104: Spain vs Argentina: 2-1 9%; 3-1 7.4%; 1-1 7.1%; 2-2 6.4%; 2-0 6.2%; 3-2 5.3%; 1-2 5.1%; 3-0 5.1%; 1-0 4.9%; 4-1 4.6%

## 11. Method And Limitations

- Markov score distributions use semi-final team stats after a 5% opponent-adjusted residual update from official quarter-final scores.
- Monte Carlo simulates the remaining bracket from the two official semi-finals.
- Sourced last-minute context is applied through tiny, capped expected-goals multipliers only where the context file explicitly marks it for model use.
- Near-equal scorelines are resolved with the higher-scoring tiebreak requested for score predictions.
- LLM reasoning is only used to explain and sanity-check; no lineups, xG, player minutes, tactical news, or unsourced availability data are invented.

Predicted champion: Spain. Predicted final: Spain vs Argentina, 3-1. Predicted third-place team: France.

