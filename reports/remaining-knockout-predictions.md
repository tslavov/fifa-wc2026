# Remaining Knockout Predictions

Generated: 2026-07-13T07:56:17.757Z

## 1. Collection Summary

- Official quarter-final results, venues, kickoff times and match duration labels collected from FIFA.
- FIFA calendar endpoint did not expose lineups, cards, event data, player minutes, xG or advanced match metrics.
- Semi-final teams are fixed from official quarter-final advancement; final and third-place fixtures are conditional on predicted semi-final winners.

## 2. Data Sources And Timestamps

- FIFA calendar API: https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023
- Collected: 2026-07-13T07:56:17.757Z
- Team stats: data\knockout\semi-final-team-stats-v1.json
- Prediction artifact: data\predictions\remaining-knockout-score-predictions-v1.json

## 3. Quarter-Final Actual Results

| Match | Venue | Kickoff UTC | Result | ET | Pens | Advanced | Playing minutes |
| ---: | --- | --- | --- | --- | --- | --- | ---: |
| 97: France vs Morocco | Boston Stadium | 2026-07-09T20:00:00Z | 2-0 |  |  | France | 90 |
| 98: Spain vs Belgium | Los Angeles Stadium | 2026-07-10T19:00:00Z | 2-1 |  |  | Spain | 90 |
| 99: Norway vs England | Miami Stadium | 2026-07-11T21:00:00Z | 1-2 | 1-2 |  | England | 120 |
| 100: Argentina vs Switzerland | Kansas City Stadium | 2026-07-12T01:00:00Z | 3-1 | 3-1 |  | Argentina | 120 |

## 4. Semi-Final Predictions

| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Pick | Confidence | Reason |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 101: France vs Spain | 1.4808-2.1331 | 1-2 (9.2%) | 1-3 | 26.4% / 20.9% / 52.7% | 20.9% | 49.9% / 10.4% | France 35.5%, Spain 64.5% | Spain | Medium / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 1-2. France residual-updated GF/GA 2.9759-0.4722 vs Spain 1.9537-0.0975; quarter-final score update uses 5% of opponent-adjusted residual only. |
| 102: England vs Argentina | 1.533-3.7387 | 1-3 (7%) | 2-4 | 10.8% / 11.5% / 77.7% | 11.5% | 38.1% / 4.4% | England 14.3%, Argentina 85.7% | Argentina | High / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 1-3. England residual-updated GF/GA 1.9807-1.0466 vs Argentina 2.7622-0.835; quarter-final score update uses 5% of opponent-adjusted residual only. |

## 5. Conditional Third-Place Match

| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Pick | Confidence | Reason |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 103: France vs England | 3.8705-1.3263 | 3-1 (7.2%) | 5-1 | 82.4% / 9.8% / 7.8% | 9.8% | 37.6% / 3.7% | France 89.5%, England 10.6% | France | High / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 3-1. France residual-updated GF/GA 2.9759-0.4722 vs England 1.9807-1.0466; quarter-final score update uses 5% of opponent-adjusted residual only. |

## 6. Conditional Final

| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Pick | Confidence | Reason |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 104: Spain vs Argentina | 2.4692-1.4291 | 2-1 (9%) | 3-1 | 60.5% / 18.7% / 20.9% | 18.7% | 47.5% / 8.9% | Spain 71.6%, Argentina 28.4% | Spain | Medium / evidence Low | Selected score remains inside the near-equal band and has more total goals than the most probable 2-1. Spain residual-updated GF/GA 1.9537-0.0975 vs Argentina 2.7622-0.835; quarter-final score update uses 5% of opponent-adjusted residual only. |

## 7. Champion Probabilities

- Spain: 48.4%
- Argentina: 28.2%
- France: 22.3%
- England: 1.1%

## 8. Possible Final Pairings

- Spain vs Argentina: 55.3%
- France vs Argentina: 30.3%
- Spain vs England: 9.3%
- France vs England: 5.1%

## 9. Score Probability Matrices

- 101: France vs Spain: 1-2 9.2%; 1-1 8.5%; 2-2 6.9%; 1-3 6.6%; 2-1 6.4%; 0-2 6.1%; 0-1 5.7%; 2-3 4.9%; 0-3 4.4%; 1-0 3.9%
- 102: England vs Argentina: 1-3 7%; 1-4 6.6%; 1-2 5.5%; 2-3 5.4%; 2-4 5.1%; 1-5 4.9%; 0-3 4.5%; 2-2 4.2%; 0-4 4.2%; 2-5 3.8%
- 103: France vs England: 3-1 7.2%; 4-1 7.1%; 2-1 5.5%; 5-1 5.5%; 3-0 5.4%; 4-0 5.2%; 3-2 4.8%; 4-2 4.7%; 2-0 4.1%; 5-0 4.1%
- 104: Spain vs Argentina: 2-1 9%; 3-1 7.4%; 1-1 7.1%; 2-2 6.4%; 2-0 6.2%; 3-2 5.3%; 1-2 5.1%; 3-0 5.1%; 1-0 4.9%; 4-1 4.6%

## 10. Method And Limitations

- Markov score distributions use semi-final team stats after a 5% opponent-adjusted residual update from official quarter-final scores.
- Monte Carlo simulates the remaining bracket from the two official semi-finals.
- Near-equal scorelines are resolved with the higher-scoring tiebreak requested for score predictions.
- LLM reasoning is only used to explain and sanity-check; no injuries, lineups, cards, xG, tactical news, travel or weather data are invented.

Predicted champion: Spain. Predicted final: Spain vs Argentina, 3-1. Predicted third-place team: France.

