# Model Update After Matchday 1

Generated: 2026-06-17T06:22:31.971Z

## Relevant Existing Project Files

- Fixtures and groups: `fifa-world-cup-2026-groups.md`, `data\fixtures\group-fixtures.json`, `data\fixtures\group-fixtures.csv`.
- Teams and normalization: `data\teams\teams.normalized.json`, `src\normalize\teams.ts`.
- Team strength and form: `data\model-input\team-strength.json`, `data\model-input\recent-form.json`, `data\squads\squad-quality.json`.
- Coefficients and weights: embedded in `src\predict\groupStandings.ts`, `src\predict\monteCarloGroupStage.ts`, and `src\predict\markovChainGroupStage.ts`.
- Monte Carlo outputs: `src\predict\monteCarloGroupStage.ts`, `data\predictions\group-stage-monte-carlo-v1.json`.
- Markov-chain outputs: `src\predict\markovChainGroupStage.ts`, `src\predict\scoreDistributionMetrics.ts`, `data\predictions\group-stage-markov-chain-v1.json`.
- Previous score reports: `reports\world-cup-2026-first-round-score-predictions.md`, `data\predictions\first-round-match-score-report-v1.md`.

## Data Sources Used

- FIFA official scores and fixtures page: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
- FIFA official match calendar API snapshot: https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023
- Existing team strength: `data\model-input\team-strength.json`
- Existing recent form: `data\model-input\recent-form.json`
- Previous selected predictions: `reports\world-cup-2026-first-round-score-predictions.md`
- Previous Markov distributions: `data\predictions\group-stage-markov-chain-v1.json`

## Actual Matchday 1 Results

Completed official finals: 19/24.

| Match | Venue | Final | Outcome |
| --- | --- | ---: | --- |
| A: Mexico vs South Africa | Mexico City Stadium | 2-0 | home win |
| A: South Korea vs Czechia | Guadalajara Stadium | 2-1 | home win |
| B: Canada vs Bosnia and Herzegovina | Toronto Stadium | 1-1 | draw |
| D: United States vs Paraguay | Los Angeles Stadium | 4-1 | home win |
| C: Haiti vs Scotland | Boston Stadium | 0-1 | away win |
| D: Australia vs Turkey | BC Place Vancouver | 2-0 | home win |
| C: Brazil vs Morocco | New York/New Jersey Stadium | 1-1 | draw |
| B: Qatar vs Switzerland | San Francisco Bay Area Stadium | 1-1 | draw |
| E: Ivory Coast vs Ecuador | Philadelphia Stadium | 1-0 | home win |
| E: Germany vs Curacao | Houston Stadium | 7-1 | home win |
| F: Netherlands vs Japan | Dallas Stadium | 2-2 | draw |
| F: Sweden vs Tunisia | Monterrey Stadium | 5-1 | home win |
| H: Saudi Arabia vs Uruguay | Miami Stadium | 1-1 | draw |
| H: Spain vs Cape Verde | Atlanta Stadium | 0-0 | draw |
| G: Iran vs New Zealand | Los Angeles Stadium | 2-2 | draw |
| G: Belgium vs Egypt | Seattle Stadium | 1-1 | draw |
| I: France vs Senegal | New York/New Jersey Stadium | 3-1 | home win |
| I: Iraq vs Norway | Boston Stadium | 1-4 | away win |
| J: Argentina vs Algeria | Kansas City Stadium | 3-0 | home win |

## Incomplete Matchday 1 Fixtures

- J: Austria vs Jordan (provisional_result, score at fetch 3-1; 2026-06-16, San Francisco Bay Area Stadium)
- L: Ghana vs Panama (scheduled; 2026-06-17, Toronto Stadium)
- L: England vs Croatia (scheduled; 2026-06-17, Dallas Stadium)
- K: Portugal vs DR Congo (scheduled; 2026-06-17, Houston Stadium)
- K: Uzbekistan vs Colombia (scheduled; 2026-06-17, Mexico City Stadium)

## Prediction Accuracy Summary

- Exact-score hits: 1/19 (5.3%)
- Outcome hits: 5/19 (26.3%)
- Average goal-difference error: 1.9474
- Average total-goals error: 1.4211
- Actual goals per completed match: 3.0526
- V1 expected goals per completed match: 3.2409

## Biggest Misses

| Match | Old prediction | Actual | GD error | Total-goals error |
| --- | ---: | ---: | ---: | ---: |
| F: Sweden vs Tunisia | 1-3 | 5-1 | 6 | 2 |
| D: Australia vs Turkey | 1-3 | 2-0 | 4 | 2 |
| E: Germany vs Curacao | 4-1 | 7-1 | 3 | 3 |
| H: Spain vs Cape Verde | 3-1 | 0-0 | 2 | 4 |
| D: United States vs Paraguay | 2-2 | 4-1 | 3 | 1 |
| C: Haiti vs Scotland | 1-3 | 0-1 | 1 | 3 |
| B: Qatar vs Switzerland | 1-3 | 1-1 | 2 | 2 |
| G: Iran vs New Zealand | 3-0 | 2-2 | 3 | 1 |

## Exact-Score Hits

- B: Canada vs Bosnia and Herzegovina (1-1)

## Outcome Hits

- A: Mexico vs South Africa (home win)
- B: Canada vs Bosnia and Herzegovina (draw)
- C: Haiti vs Scotland (away win)
- E: Germany vs Curacao (home win)
- I: Iraq vs Norway (away win)

## Coefficient Changes

| Coefficient | Previous | Updated | Status | Rationale |
| --- | ---: | ---: | --- | --- |
| markovMonteCarlo.modelParameters.baseGoalRateMultiplier | 1 | 0.9923 | updated | Completed Matchday 1 finals averaged 3.0526 actual goals per match versus 3.2409 expected by the v1 Markov distributions. The correction is shrunk by evidence weight 0.1319 and capped at +/-5%. |
| markovMonteCarlo.modelParameters.qualityMultiplierScale | 0.65 | 0.6285 | updated | Favorites won 42.1% of completed fixtures against an average favorite win probability of 56.2%. The quality-spread correction is shrunk and capped to avoid overfitting. |
| markovMonteCarlo.qualityWeights | v1 weights | unchanged | unchanged | Nineteen finals are not enough to identify separate FIFA-rank, FIFA-points, Elo, and form coefficients without fake precision. |
| deterministicFeatureWeights | v1 weights | unchanged | unchanged | The deterministic rank-order model is not fixture-level calibrated; Matchday 1 evidence is applied to the score model instead. |
| squadQuality | not collected | not collected | not_available | The repository's squad-quality file is a placeholder with no sourced squad rows, so no squad coefficient is introduced. |
| venueHostAdvantage | not used | unchanged | unchanged | Venue/host effects are not in the Phase 1 model input. Host evidence is only three teams and is not enough for a sourced coefficient. |
| marketImpliedProbability | not collected | not collected | not_available | No market/implied-probability source exists in the repository. |
| qualitativeOverlay.llmWeight | 0 | 0 | unchanged | The existing methodology uses LLM text as explanation only, not a numeric input. |

## Updated Predictions

### Remaining Matchday 1 Fixtures

| Match | Old prediction | Actual MD1 result | Updated adjustment | New selected | Most probable | Outcome probabilities |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| J: Austria vs Jordan | 4-1 | n/a | goal 0.9923, quality 0.6285 | 4-1 | 2-0 | H 76.9% / D 13.6% / A 9.6% |
| L: Ghana vs Panama | 1-3 | n/a | goal 0.9923, quality 0.6285 | 1-3 | 1-2 | H 25.6% / D 20.4% / A 54% |
| L: England vs Croatia | 2-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 1-1 | H 53% / D 22.2% / A 24.8% |
| K: Portugal vs DR Congo | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-1 | H 40.8% / D 27.1% / A 32.1% |
| K: Uzbekistan vs Colombia | 1-2 | n/a | goal 0.9923, quality 0.6285 | 1-2 | 1-1 | H 28.2% / D 22.9% / A 48.9% |

### Matchday 2

| Match | Old prediction | Actual MD1 result | Updated adjustment | New selected | Most probable | Outcome probabilities |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| A: Czechia vs South Africa | 2-2 | n/a | goal 0.9923, quality 0.6285 | 2-2 | 1-1 | H 51% / D 22% / A 27.1% |
| B: Switzerland vs Bosnia and Herzegovina | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 55% / D 20.7% / A 24.3% |
| B: Canada vs Qatar | 2-0 | n/a | goal 0.9923, quality 0.6285 | 2-0 | 1-0 | H 66.8% / D 21.7% / A 11.5% |
| A: Mexico vs South Korea | 2-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 1-0 | H 58.4% / D 22.7% / A 18.8% |
| C: Brazil vs Haiti | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 62.6% / D 18.5% / A 19% |
| C: Scotland vs Morocco | 1-2 | n/a | goal 0.9923, quality 0.6285 | 1-2 | 0-2 | H 16.7% / D 20.8% / A 62.5% |
| D: Turkey vs Paraguay | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 52.3% / D 21% / A 26.7% |
| D: United States vs Australia | 2-2 | n/a | goal 0.9923, quality 0.6285 | 2-2 | 1-1 | H 36.4% / D 22.2% / A 41.5% |
| E: Germany vs Ivory Coast | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 53.6% / D 21.1% / A 25.3% |
| E: Ecuador vs Curacao | 2-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 1-1 | H 51.5% / D 24.5% / A 24% |
| F: Netherlands vs Sweden | 4-1 | n/a | goal 0.9923, quality 0.6285 | 4-1 | 3-1 | H 81.3% / D 11% / A 7.7% |
| F: Tunisia vs Japan | 1-3 | n/a | goal 0.9923, quality 0.6285 | 1-3 | 1-2 | H 14.8% / D 18.5% / A 66.7% |
| H: Uruguay vs Cape Verde | 2-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 1-1 | H 43.1% / D 24.7% / A 32.3% |
| H: Spain vs Saudi Arabia | 4-0 | n/a | goal 0.9923, quality 0.6285 | 4-0 | 3-0 | H 83.8% / D 10.5% / A 5.7% |
| G: Belgium vs Iran | 2-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 2-1 | H 55.9% / D 21.7% / A 22.4% |
| G: New Zealand vs Egypt | 0-2 | n/a | goal 0.9923, quality 0.6285 | 0-2 | 0-2 | H 10.5% / D 17.8% / A 71.7% |
| I: Norway vs Senegal | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 51% / D 21.4% / A 27.6% |
| I: France vs Iraq | 3-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 2-0 | H 63.8% / D 20% / A 16.2% |
| J: Argentina vs Austria | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-1 | H 42.7% / D 27.5% / A 29.9% |
| J: Jordan vs Algeria | 1-3 | n/a | goal 0.9923, quality 0.6285 | 1-3 | 1-2 | H 15% / D 18.3% / A 66.8% |
| L: England vs Ghana | 3-0 | n/a | goal 0.9923, quality 0.6285 | 3-0 | 2-0 | H 80% / D 12.9% / A 7.1% |
| L: Panama vs Croatia | 2-3 | n/a | goal 0.9923, quality 0.6285 | 2-3 | 1-2 | H 21.7% / D 18.3% / A 60% |
| K: Portugal vs Uzbekistan | 2-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 1-1 | H 53.9% / D 22% / A 24.1% |
| K: Colombia vs DR Congo | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-1 | H 36.6% / D 27.2% / A 36.2% |

### Matchday 3

| Match | Old prediction | Actual MD1 result | Updated adjustment | New selected | Most probable | Outcome probabilities |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| C: Scotland vs Brazil | 2-3 | n/a | goal 0.9923, quality 0.6285 | 2-3 | 1-2 | H 30.6% / D 20.5% / A 48.9% |
| C: Morocco vs Haiti | 2-0 | n/a | goal 0.9923, quality 0.6285 | 2-0 | 2-0 | H 72.5% / D 17.3% / A 10.2% |
| B: Switzerland vs Canada | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-1 | H 38.4% / D 27.9% / A 33.7% |
| B: Bosnia and Herzegovina vs Qatar | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 64% / D 19.4% / A 16.5% |
| A: Czechia vs Mexico | 1-2 | n/a | goal 0.9923, quality 0.6285 | 1-2 | 1-1 | H 25.6% / D 24.7% / A 49.7% |
| A: South Africa vs South Korea | 1-2 | n/a | goal 0.9923, quality 0.6285 | 1-2 | 1-1 | H 35.9% / D 23.4% / A 40.7% |
| E: Curacao vs Ivory Coast | 1-3 | n/a | goal 0.9923, quality 0.6285 | 1-3 | 1-2 | H 22.1% / D 19.7% / A 58.3% |
| E: Ecuador vs Germany | 1-2 | n/a | goal 0.9923, quality 0.6285 | 1-2 | 1-1 | H 23.8% / D 25.1% / A 51.1% |
| F: Japan vs Sweden | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 73.4% / D 15.2% / A 11.4% |
| F: Tunisia vs Netherlands | 1-4 | n/a | goal 0.9923, quality 0.6285 | 1-4 | 1-2 | H 10.7% / D 14.3% / A 75% |
| D: Turkey vs United States | 2-3 | n/a | goal 0.9923, quality 0.6285 | 3-2 | 2-1 | H 54.7% / D 18.4% / A 27% |
| D: Paraguay vs Australia | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-1 | H 34.6% / D 25.2% / A 40.1% |
| I: Norway vs France | 2-2 | n/a | goal 0.9923, quality 0.6285 | 2-2 | 1-1 | H 38.3% / D 22.1% / A 39.7% |
| I: Senegal vs Iraq | 2-1 | n/a | goal 0.9923, quality 0.6285 | 2-1 | 1-1 | H 51.7% / D 23.8% / A 24.6% |
| G: Egypt vs Iran | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-1 | H 30.4% / D 27.5% / A 42.1% |
| G: New Zealand vs Belgium | 0-5 | n/a | goal 0.9923, quality 0.6285 | 0-5 | 0-4 | H 2.1% / D 5.2% / A 92.7% |
| H: Cape Verde vs Saudi Arabia | 2-2 | n/a | goal 0.9923, quality 0.6285 | 2-2 | 1-1 | H 47.8% / D 22% / A 30.2% |
| H: Uruguay vs Spain | 1-2 | n/a | goal 0.9923, quality 0.6285 | 1-2 | 0-2 | H 12.5% / D 18.8% / A 68.7% |
| L: Panama vs England | 1-3 | n/a | goal 0.9923, quality 0.6285 | 1-3 | 1-2 | H 12.3% / D 15.7% / A 72% |
| L: Croatia vs Ghana | 3-1 | n/a | goal 0.9923, quality 0.6285 | 3-1 | 2-1 | H 71.3% / D 15.8% / A 12.8% |
| J: Algeria vs Austria | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-1 | H 28.8% / D 27.2% / A 44.1% |
| J: Jordan vs Argentina | 1-3 | n/a | goal 0.9923, quality 0.6285 | 1-3 | 0-2 | H 7% / D 12% / A 81.1% |
| K: Colombia vs Portugal | 2-3 | n/a | goal 0.9923, quality 0.6285 | 2-3 | 1-2 | H 34.3% / D 20.4% / A 45.3% |
| K: DR Congo vs Uzbekistan | 1-1 | n/a | goal 0.9923, quality 0.6285 | 1-1 | 1-0 | H 42% / D 31.2% / A 26.8% |

## Risks And Limitations

- Matchday 1 was not fully final in FIFA's official feed at fetch time; five fixtures are held out.
- Nineteen matches are useful for calibration but not enough for team-specific ratings, squad-quality coefficients, or confederation adjustments.
- The model still omits injuries, lineups, weather, xG, market odds, venue effects, travel, and rest because those inputs are not sourced in this repo.
- Previous first-round assumptions did not always match the official post-draw fixture order, so evaluation uses the all-match score report plus Markov distributions rather than the older first-two-pairings-only report.

## Next Update Point

Update again after Matchday 2 finishes and all FIFA official scores are final. That gives each team two tournament observations and a better signal for calibration without leaning too hard on one surprise.

