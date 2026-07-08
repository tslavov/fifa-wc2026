# Quarter-Final Predictions

Generated: 2026-07-08T09:26:57.863Z

## 1. Collection Summary

- Official Round of 16 results, venues, kickoff times and match duration labels collected from FIFA.
- FIFA calendar endpoint did not expose lineups, cards, event data, player minutes, xG or advanced match metrics.
- Availability, weather and advanced performance features are unavailable/neutral; review market benchmarks are stored only as diagnostics.

## 2. Data Sources And Timestamps

- FIFA calendar API: https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023
- Collected: 2026-07-08T09:26:57.863Z

## 3. Round Of 16 Actual Results

| Match | Venue | Kickoff UTC | Result | ET | Pens | Advanced | Playing minutes | Elapsed clock |
| ---: | --- | --- | --- | --- | --- | --- | ---: | ---: |
| 89: Paraguay vs France | Philadelphia Stadium | 2026-07-04T21:00:00Z | 0-1 |  |  | France | 90 | 101 |
| 90: Canada vs Morocco | Houston Stadium | 2026-07-04T17:00:00Z | 0-3 |  |  | Morocco | 90 | 100 |
| 91: Brazil vs Norway | New York/New Jersey Stadium | 2026-07-05T20:00:00Z | 1-2 |  |  | Norway | 90 | 102 |
| 92: Mexico vs England | Mexico City Stadium | 2026-07-06T01:00:00Z | 2-3 |  |  | England | 90 | 103 |
| 93: Portugal vs Spain | Dallas Stadium | 2026-07-06T19:00:00Z | 0-1 |  |  | Spain | 90 | 99 |
| 94: United States vs Belgium | Seattle Stadium | 2026-07-07T00:00:00Z | 1-4 |  |  | Belgium | 90 | 95 |
| 95: Argentina vs Egypt | Atlanta Stadium | 2026-07-07T16:00:00Z | 3-2 |  |  | Argentina | 90 | 102 |
| 96: Switzerland vs Colombia | BC Place Vancouver | 2026-07-07T20:00:00Z | 0-0 | 0-0 | 4-3 | Switzerland | 120 | 130 |

## 4. Previous Prediction Backtest

- Markov: exact 0%, outcome 50%, qualification 50%, Brier 0.6221, log loss 1.0553, MAE 1.3125, fantasy 1.875.
- Monte Carlo: exact 0%, outcome 50%, qualification 50%, Brier 0.6221.
- LLM-only: exact 0%, outcome 50%, qualification 62.5%.

## 5. Underlying-Performance Analysis

- Root cause corrected: the previous QF script blended 25% of the full Round of 16 score into already high tournament goals-per-match and recalculated the scoring base from only QF teams. That inflated favourite xG and qualification probabilities.
- Corrected update: `newRate = oldRate + (observed - opponentAdjustedExpected) * evidenceWeight`; selected evidence weight is 5% because only final goals are available.
- Form is shrunk separately from team quality to avoid double-counting tournament scoring and strength ratings.

## 6. Player Availability

- No reliable availability source was collected; all injury, illness, suspension and yellow-card fields are neutral/unavailable.

## 7. Rest, Travel, Fatigue And Weather

- Previous match duration and recovery hours are recorded. Fatigue uses playing minutes, not FIFA elapsed-clock labels. Switzerland is 120 playing minutes plus a separate shootout flag.
- Travel distance, timezone change, altitude, roof/surface and official weather forecasts remain unavailable and neutral.

## 8. Accepted And Rejected Model Adjustments

- Accepted: official Round of 16 advancement and residual-only score update; Official results define quarter-final teams. Goal-score observations are used only as opponent-adjusted residuals with a small weight because xG/event data is unavailable.
- Rejected: advanced xG/shot/event metrics unavailable from approved machine source
- Rejected: player availability unavailable from reliable collected source
- Rejected: travel/weather/altitude unavailable or unvalidated
- Rejected: no coefficient recalibration from only eight Round of 16 matches
- Rejected: external market consensus not collected as odds; review benchmarks stored as diagnostics only and not used as inputs

## 9. Quarter-Final Predictions

| Match | Expected goals | Most probable score | Selected score | 90-minute probabilities | Extra-time probability | Pens conditional / unconditional | Qualification probability | Strength | Evidence |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| France vs Morocco | 3.0368-1.1974 | 3-1 (8.3%) | 3-1 | 74.6% / 13.9% / 11.5% | 13.9% | 44% / 6.1% | France 84%, Morocco 16% | High | Low |
| Spain vs Belgium | 2.5827-1.08 | 2-1 (9.4%) | 2-1 | 70% / 16.5% / 13.5% | 16.5% | 48.3% / 8% | Spain 80.8%, Belgium 19.2% | High | Low |
| Norway vs England | 1.5999-3.1481 | 1-3 (7.4%) | 1-3 | 16.4% / 15% / 68.6% | 15% | 41.8% / 6.3% | Norway 21.7%, England 78.3% | High | Low |
| Argentina vs Switzerland | 2.6644-1.4665 | 2-1 (8.5%) | 2-1 | 63.3% / 17.5% / 19.3% | 17.5% | 45.8% / 8% | Argentina 74.2%, Switzerland 25.8% | Medium | Low |

## 10. Score Probability Matrices

- France vs Morocco: 3-1 8.3%; 2-1 8.1%; 3-0 6.8%; 2-0 6.7%; 4-1 6.3%; 1-1 5.2%; 4-0 5.2%; 3-2 5%; 2-2 4.9%; 1-0 4.3%
- Spain vs Belgium: 2-1 9.4%; 2-0 8.6%; 3-1 8.1%; 3-0 7.4%; 1-1 7.1%; 1-0 6.5%; 4-1 5.2%; 2-2 5.1%; 4-0 4.8%; 3-2 4.4%
- Norway vs England: 1-3 7.4%; 1-2 6.9%; 2-3 5.9%; 1-4 5.8%; 2-2 5.6%; 2-4 4.7%; 0-3 4.5%; 1-1 4.3%; 0-2 4.2%; 1-5 3.6%
- Argentina vs Switzerland: 2-1 8.5%; 3-1 7.6%; 2-2 6.3%; 1-1 6.2%; 2-0 5.7%; 3-2 5.6%; 3-0 5.1%; 4-1 5%; 1-2 4.6%; 1-0 4.2%

## 11. Qualification Probabilities

- France 84% / Morocco 16%.
- Spain 80.8% / Belgium 19.2%.
- Norway 21.7% / England 78.3%.
- Argentina 74.2% / Switzerland 25.8%.

## 12. Sensitivity Analysis

- Weather/travel/player availability sensitivity is neutral because inputs are unavailable.
- Model variants compare original, deprecated 25% full-score update, corrected 5%, corrected 10%, no-score/context-only and market-blind statistical ensemble.
- original_pre_round_of_16: France vs Morocco xG 3.1316-1.1839, qual 85.2%/14.8%; Spain vs Belgium xG 2.595-1.0714, qual 81.1%/18.9%; Norway vs England xG 1.5796-3.1136, qual 21.8%/78.2%; Argentina vs Switzerland xG 2.6922-1.4404, qual 75.2%/24.8%
- current_25_percent_full_score_implementation: France vs Morocco xG 3.3763-0.9422, qual 90.8%/9.3%; Spain vs Belgium xG 2.5468-0.7005, qual 87.6%/12.4%; Norway vs England xG 1.733-3.785, qual 16.8%/83.2%; Argentina vs Switzerland xG 2.6514-1.3928, qual 75.5%/24.5%
- corrected_residual_5_percent: France vs Morocco xG 3.0368-1.1974, qual 84%/16%; Spain vs Belgium xG 2.5827-1.08, qual 80.8%/19.2%; Norway vs England xG 1.5999-3.1481, qual 21.7%/78.3%; Argentina vs Switzerland xG 2.6644-1.4665, qual 74.2%/25.8%
- corrected_residual_10_percent: France vs Morocco xG 2.9357-1.2112, qual 82.7%/17.3%; Spain vs Belgium xG 2.5686-1.0879, qual 80.5%/19.6%; Norway vs England xG 1.616-3.1845, qual 21.5%/78.5%; Argentina vs Switzerland xG 2.6347-1.4937, qual 73.2%/26.8%
- no_score_update_context_only: France vs Morocco xG 3.1316-1.1839, qual 85.2%/14.8%; Spain vs Belgium xG 2.595-1.0714, qual 81.1%/18.9%; Norway vs England xG 1.5796-3.1136, qual 21.8%/78.2%; Argentina vs Switzerland xG 2.6922-1.4404, qual 75.2%/24.8%
- market_blind_statistical_ensemble: France vs Morocco xG 3.0842-1.1907, qual 84.6%/15.4%; Spain vs Belgium xG 2.5889-1.0757, qual 81%/19.1%; Norway vs England xG 1.5898-3.1308, qual 21.7%/78.3%; Argentina vs Switzerland xG 2.6783-1.4534, qual 74.7%/25.3%

## 13. Semifinal Bracket Simulation

- France vs Spain | England vs Argentina: 39.5%
- France vs Spain | England vs Switzerland: 13.6%
- France vs Spain | Norway vs Argentina: 10.9%
- France vs Belgium | England vs Argentina: 9.4%
- Morocco vs Spain | England vs Argentina: 7.5%
- France vs Spain | Norway vs Switzerland: 3.8%
- France vs Belgium | England vs Switzerland: 3.3%
- Morocco vs Spain | England vs Switzerland: 2.7%

## 14. Risks And Missing Information

- Largest risks: missing lineups, suspensions, player minutes, cards, xG/shot data, weather and market sanity checks.
- Penalty shootout wins are separated from regulation scoring.
- Validation warnings:
  - France vs Morocco: review: one team exceeds 3.0 regulation xG
  - France vs Morocco: review: total regulation xG exceeds 4.0
  - France vs Morocco: review: important lineup, fitness, player-minute and advanced match inputs are missing
  - Spain vs Belgium: review: important lineup, fitness, player-minute and advanced match inputs are missing
  - Norway vs England: review: one team exceeds 3.0 regulation xG
  - Norway vs England: review: total regulation xG exceeds 4.0
  - Norway vs England: review: project qualification probability differs from diagnostic market benchmark by more than ten percentage points
  - Norway vs England: review: important lineup, fitness, player-minute and advanced match inputs are missing
  - Argentina vs Switzerland: review: total regulation xG exceeds 4.0
  - Argentina vs Switzerland: review: important lineup, fitness, player-minute and advanced match inputs are missing

## 15. Reproducibility Instructions

- Run: `node scripts/updateAfterRoundOf16.mjs`
- Validate: `npm.cmd run typecheck`

## Validation

- Score matrices are normalized to approximately 1.0 in JSON validation fields.
- Qualification probabilities sum to 100% per fixture.
- Extra-time probability equals 90-minute draw probability; penalty probability is split into conditional-on-extra-time and unconditional fields.
