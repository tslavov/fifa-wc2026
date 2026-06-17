# FIFA World Cup 2026 Second-Round Match Score Predictions

Generated: 2026-06-17T06:35:46.211Z

noFutureUse: true

This is a prediction report only. Do not use it as collected data, training data, model input, or future prediction input.

## Method

Predicted scores are generated from the Matchday 2 v2 score-prediction artifact created after the Matchday 1 update.

- Prediction input: `data\predictions\matchday-2-score-predictions-v2-after-matchday-1.json`.
- Matchday 1 result context: `data\results\group-stage-matchday-1-results-v1.json`.
- Updated coefficient version: `data\model\coefficients-v2-after-matchday-1.json`.
- Team-strength and recent-form inputs: `data\model-input\team-strength.json`, `data\model-input\recent-form.json`.
- The selected score can differ from the most probable individual bucket when it remains inside the near-equal scoreline band and the existing score-selection tiebreaks choose a more informative result.
- LLM-style qualitative text is explanatory only; no injuries, lineups, tactical news, weather, xG, market prices, or squad-quality assumptions are invented.

## Matchday 1 Context

- FIFA-official completed Matchday 1 finals at update time: 19/24.
- Matchday 1 fixtures not final at update time: 5.
- Base goal-rate multiplier: 0.9923.
- Quality multiplier scale: 0.6285.
- Evidence weight: 0.1319; coefficient movement cap: 5% relative.

## Summary

Confidence counts: High 3, Medium 16, Low 5.
Selected score differed from the most probable score in 20 of 24 matches.

| Match | Selected score | Most probable | W/D/L | Confidence | Notes |
| --- | ---: | ---: | ---: | --- | --- |
| Group A: Czechia vs South Africa | Czechia 2-2 South Africa | 1-1 (9.6%) | H 51% / D 22% / A 27.1% | Low | Selected differs by 2.9% but remains in the near-equal band. |
| Group A: Mexico vs South Korea | Mexico 2-1 South Korea | 1-0 (11.5%) | H 58.4% / D 22.7% / A 18.8% | Medium | Selected differs by 1.5% but remains in the near-equal band. |
| Group B: Switzerland vs Bosnia and Herzegovina | Switzerland 3-1 Bosnia and Herzegovina | 2-1 (9.5%) | H 55% / D 20.7% / A 24.3% | Medium | Selected differs by 2.7% but remains in the near-equal band. |
| Group B: Canada vs Qatar | Canada 2-0 Qatar | 1-0 (16.3%) | H 66.8% / D 21.7% / A 11.5% | High | Selected differs by 1.4% but remains in the near-equal band. |
| Group C: Brazil vs Haiti | Brazil 3-1 Haiti | 2-1 (9.3%) | H 62.6% / D 18.5% / A 19% | Medium | Selected differs by 1.7% but remains in the near-equal band. |
| Group C: Scotland vs Morocco | Scotland 1-2 Morocco | 0-2 (10.5%) | H 16.7% / D 20.8% / A 62.5% | Medium | Selected differs by 0.4% but remains in the near-equal band. |
| Group D: Turkey vs Paraguay | Turkey 3-1 Paraguay | 2-1 (9.2%) | H 52.3% / D 21% / A 26.7% | Low | Selected differs by 2.7% but remains in the near-equal band. |
| Group D: United States vs Australia | United States 2-2 Australia | 1-1 (9%) | H 36.4% / D 22.2% / A 41.5% | Low | Selected differs by 1.8% but remains in the near-equal band. |
| Group E: Germany vs Ivory Coast | Germany 3-1 Ivory Coast | 2-1 (9.5%) | H 53.6% / D 21.1% / A 25.3% | Low | Selected differs by 2.9% but remains in the near-equal band. |
| Group E: Ecuador vs Curacao | Ecuador 2-1 Curacao | 1-1 (11.7%) | H 51.5% / D 24.5% / A 24% | Medium | Selected differs by 2% but remains in the near-equal band. |
| Group F: Netherlands vs Sweden | Netherlands 4-1 Sweden | 3-1 (8.2%) | H 81.3% / D 11% / A 7.7% | Medium | Selected differs by 1.3% but remains in the near-equal band. |
| Group F: Tunisia vs Japan | Tunisia 1-3 Japan | 1-2 (9.9%) | H 14.8% / D 18.5% / A 66.7% | Medium | Selected differs by 2.3% but remains in the near-equal band. |
| Group G: Belgium vs Iran | Belgium 2-1 Iran | 2-1 (10%) | H 55.9% / D 21.7% / A 22.4% | Medium | Selected score is the most probable bucket. |
| Group G: New Zealand vs Egypt | New Zealand 0-2 Egypt | 0-2 (13.2%) | H 10.5% / D 17.8% / A 71.7% | High | Selected score is the most probable bucket. |
| Group H: Uruguay vs Cape Verde | Uruguay 2-1 Cape Verde | 1-1 (11.6%) | H 43.1% / D 24.7% / A 32.3% | Medium | Selected differs by 2.4% but remains in the near-equal band. |
| Group H: Spain vs Saudi Arabia | Spain 4-0 Saudi Arabia | 3-0 (10.3%) | H 83.8% / D 10.5% / A 5.7% | Medium | Selected differs by 2.1% but remains in the near-equal band. |
| Group I: Norway vs Senegal | Norway 3-1 Senegal | 2-1 (9.2%) | H 51% / D 21.4% / A 27.6% | Low | Selected differs by 2.9% but remains in the near-equal band. |
| Group I: France vs Iraq | France 2-1 Iraq | 2-0 (10.2%) | H 63.8% / D 20% / A 16.2% | Medium | Selected differs by 0.2% but remains in the near-equal band. |
| Group J: Argentina vs Austria | Argentina 1-1 Austria | 1-1 (13.1%) | H 42.7% / D 27.5% / A 29.9% | Medium | Selected score is the most probable bucket. |
| Group J: Jordan vs Algeria | Jordan 1-3 Algeria | 1-2 (9.9%) | H 15% / D 18.3% / A 66.8% | Medium | Selected differs by 2.1% but remains in the near-equal band. |
| Group K: Portugal vs Uzbekistan | Portugal 2-1 Uzbekistan | 1-1 (10%) | H 53.9% / D 22% / A 24.1% | Medium | Selected differs by 0.1% but remains in the near-equal band. |
| Group K: Colombia vs DR Congo | Colombia 1-1 DR Congo | 1-1 (13%) | H 36.6% / D 27.2% / A 36.2% | Medium | Selected score is the most probable bucket. |
| Group L: England vs Ghana | England 3-0 Ghana | 2-0 (11.5%) | H 80% / D 12.9% / A 7.1% | High | Selected differs by 0.7% but remains in the near-equal band. |
| Group L: Panama vs Croatia | Panama 2-3 Croatia | 1-2 (8.4%) | H 21.7% / D 18.3% / A 60% | Medium | Selected differs by 2.7% but remains in the near-equal band. |

## Match Details

### Group A

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Czechia vs South Africa | 2026-06-18 12:00 local; Atlanta Stadium, Atlanta | 2-2 | Czechia 2-2 South Africa | 1-1 (9.6%) | 1.96-1.39 | 1-1 (9.6%), 2-1 (9.5%), 1-0 (6.8%), 2-0 (6.7%), 1-2 (6.7%) | Czechia lean leads outcome probabilities at 51%. Most probable bucket is 1-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-1; selected 2-2 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Mexico vs South Korea | 2026-06-18 19:00 local; Guadalajara Stadium, Guadalajara | 2-1 | Mexico 2-1 South Korea | 1-0 (11.5%) | 1.82-0.93 | 1-0 (11.5%), 1-1 (10.9%), 2-0 (10.6%), 2-1 (10%), 3-0 (6.4%) | Mexico lean leads outcome probabilities at 58.4%. Most probable bucket is 1-0; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-0; selected 2-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group B

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Switzerland vs Bosnia and Herzegovina | 2026-06-18 12:00 local; Los Angeles Stadium, Los Angeles | 3-1 | Switzerland 3-1 Bosnia and Herzegovina | 2-1 (9.5%) | 2.15-1.39 | 2-1 (9.5%), 1-1 (8.7%), 3-1 (6.8%), 2-0 (6.7%), 2-2 (6.6%) | Switzerland lean leads outcome probabilities at 55%. Most probable bucket is 2-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 2-1; selected 3-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Canada vs Qatar | 2026-06-18 15:00 local; BC Place Vancouver, Vancouver | 2-0 | Canada 2-0 Qatar | 1-0 (16.3%) | 1.81-0.60 | 1-0 (16.3%), 2-0 (14.9%), 1-1 (9.8%), 2-1 (9%), 3-0 (8.9%) | Canada lean leads outcome probabilities at 66.8%. Most probable bucket is 1-0; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-0; selected 2-0 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group C

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Brazil vs Haiti | 2026-06-19 20:30 local; Philadelphia Stadium, Philadelphia | 3-1 | Brazil 3-1 Haiti | 2-1 (9.3%) | 2.45-1.31 | 2-1 (9.3%), 3-1 (7.6%), 1-1 (7.5%), 2-0 (7%), 2-2 (6.1%) | Brazil lean leads outcome probabilities at 62.6%. Most probable bucket is 2-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 2-1; selected 3-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Scotland vs Morocco | 2026-06-19 18:00 local; Boston Stadium, Boston | 1-2 | Scotland 1-2 Morocco | 0-2 (10.5%) | 0.95-2.03 | 0-2 (10.5%), 0-1 (10.2%), 1-2 (10.1%), 1-1 (9.9%), 0-3 (7.1%) | Morocco lean leads outcome probabilities at 62.5%. Most probable bucket is 0-2; selected score remains close enough for the existing tiebreak rule. Most probable score is 0-2; selected 1-2 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group D

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Turkey vs Paraguay | 2026-06-19 20:00 local; San Francisco Bay Area Stadium, San Francisco Bay Area | 3-1 | Turkey 3-1 Paraguay | 2-1 (9.2%) | 2.11-1.48 | 2-1 (9.2%), 1-1 (8.6%), 2-2 (6.9%), 3-1 (6.5%), 1-2 (6.4%) | Turkey lean leads outcome probabilities at 52.3%. Most probable bucket is 2-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 2-1; selected 3-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| United States vs Australia | 2026-06-19 12:00 local; Seattle Stadium, Seattle | 2-2 | United States 2-2 Australia | 1-1 (9%) | 1.72-1.84 | 1-1 (9%), 1-2 (8.4%), 2-1 (7.8%), 2-2 (7.3%), 0-1 (5.2%) | Australia lean leads outcome probabilities at 41.5%. Most probable bucket is 1-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-1; selected 2-2 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group E

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Germany vs Ivory Coast | 2026-06-20 16:00 local; Toronto Stadium, Toronto | 3-1 | Germany 3-1 Ivory Coast | 2-1 (9.5%) | 2.09-1.40 | 2-1 (9.5%), 1-1 (8.9%), 2-0 (6.7%), 2-2 (6.7%), 3-1 (6.6%) | Germany lean leads outcome probabilities at 53.6%. Most probable bucket is 2-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 2-1; selected 3-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Ecuador vs Curacao | 2026-06-20 19:00 local; Kansas City Stadium, Kansas City | 2-1 | Ecuador 2-1 Curacao | 1-1 (11.7%) | 1.65-1.05 | 1-1 (11.7%), 1-0 (11%), 2-1 (9.8%), 2-0 (9.2%), 0-1 (7%) | Ecuador lean leads outcome probabilities at 51.5%. Most probable bucket is 1-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-1; selected 2-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group F

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Netherlands vs Sweden | 2026-06-20 12:00 local; Houston Stadium, Houston | 4-1 | Netherlands 4-1 Sweden | 3-1 (8.2%) | 3.37-1.06 | 3-1 (8.2%), 3-0 (7.7%), 2-1 (7.2%), 4-1 (7%), 2-0 (6.7%) | Netherlands lean leads outcome probabilities at 81.3%. Most probable bucket is 3-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 3-1; selected 4-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Tunisia vs Japan | 2026-06-20 22:00 local; Monterrey Stadium, Monterrey | 1-3 | Tunisia 1-3 Japan | 1-2 (9.9%) | 1.00-2.29 | 1-2 (9.9%), 0-2 (9.9%), 1-1 (8.5%), 0-1 (8.5%), 1-3 (7.6%) | Japan lean leads outcome probabilities at 66.7%. Most probable bucket is 1-2; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-2; selected 1-3 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group G

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Belgium vs Iran | 2026-06-21 12:00 local; Los Angeles Stadium, Los Angeles | 2-1 | Belgium 2-1 Iran | 2-1 (10%) | 1.98-1.19 | 2-1 (10%), 1-1 (9.9%), 2-0 (8.3%), 1-0 (8.2%), 3-1 (6.6%) | Belgium lean leads outcome probabilities at 55.9%. Selected score is the most probable bucket. Selected score is the most probable v2 Markov bucket after Matchday 1 calibration. |
| New Zealand vs Egypt | 2026-06-21 18:00 local; BC Place Vancouver, Vancouver | 0-2 | New Zealand 0-2 Egypt | 0-2 (13.2%) | 0.71-2.20 | 0-2 (13.2%), 0-1 (11.9%), 0-3 (9.7%), 1-2 (9.5%), 1-1 (8.5%) | Egypt lean leads outcome probabilities at 71.7%. Selected score is the most probable bucket. Selected score is the most probable v2 Markov bucket after Matchday 1 calibration. |

### Group H

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Uruguay vs Cape Verde | 2026-06-21 18:00 local; Miami Stadium, Miami | 2-1 | Uruguay 2-1 Cape Verde | 1-1 (11.6%) | 1.57-1.33 | 1-1 (11.6%), 2-1 (9.2%), 1-0 (8.6%), 1-2 (7.7%), 0-1 (7.3%) | Uruguay lean leads outcome probabilities at 43.1%. Most probable bucket is 1-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-1; selected 2-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Spain vs Saudi Arabia | 2026-06-21 12:00 local; Atlanta Stadium, Atlanta | 4-0 | Spain 4-0 Saudi Arabia | 3-0 (10.3%) | 3.16-0.78 | 3-0 (10.3%), 2-0 (9.7%), 4-0 (8.2%), 3-1 (8.2%), 2-1 (7.6%) | Spain lean leads outcome probabilities at 83.8%. Most probable bucket is 3-0; selected score remains close enough for the existing tiebreak rule. Most probable score is 3-0; selected 4-0 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group I

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Norway vs Senegal | 2026-06-22 20:00 local; New York/New Jersey Stadium, New Jersey | 3-1 | Norway 3-1 Senegal | 2-1 (9.2%) | 2.06-1.48 | 2-1 (9.2%), 1-1 (8.9%), 2-2 (6.9%), 1-2 (6.6%), 3-1 (6.3%) | Norway lean leads outcome probabilities at 51%. Most probable bucket is 2-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 2-1; selected 3-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| France vs Iraq | 2026-06-22 17:00 local; Philadelphia Stadium, Philadelphia | 3-1 | France 2-1 Iraq | 2-0 (10.2%) | 2.12-0.97 | 2-0 (10.2%), 2-1 (10.1%), 1-0 (9.6%), 1-1 (9.4%), 3-0 (7.2%) | France lean leads outcome probabilities at 63.8%. Most probable bucket is 2-0; selected score remains close enough for the existing tiebreak rule. Most probable score is 2-0; selected 2-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group J

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Argentina vs Austria | 2026-06-22 12:00 local; Dallas Stadium, Dallas | 1-1 | Argentina 1-1 Austria | 1-1 (13.1%) | 1.33-1.07 | 1-1 (13.1%), 1-0 (12.1%), 0-1 (9.7%), 0-0 (9%), 2-1 (8.7%) | Argentina lean leads outcome probabilities at 42.7%. Selected score is the most probable bucket. Selected score is the most probable v2 Markov bucket after Matchday 1 calibration. |
| Jordan vs Algeria | 2026-06-22 20:00 local; San Francisco Bay Area Stadium, San Francisco Bay Area | 1-3 | Jordan 1-3 Algeria | 1-2 (9.9%) | 1.03-2.34 | 1-2 (9.9%), 0-2 (9.5%), 1-1 (8.3%), 0-1 (8%), 1-3 (7.7%) | Algeria lean leads outcome probabilities at 66.8%. Most probable bucket is 1-2; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-2; selected 1-3 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

### Group K

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Portugal vs Uzbekistan | 2026-06-23 12:00 local; Houston Stadium, Houston | 2-1 | Portugal 2-1 Uzbekistan | 1-1 (10%) | 1.95-1.25 | 1-1 (10%), 2-1 (9.9%), 1-0 (7.9%), 2-0 (7.8%), 3-1 (6.4%) | Portugal lean leads outcome probabilities at 53.9%. Most probable bucket is 1-1; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-1; selected 2-1 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Colombia vs DR Congo | 2026-06-23 20:00 local; Guadalajara Stadium, Guadalajara | 1-1 | Colombia 1-1 DR Congo | 1-1 (13%) | 1.24-1.23 | 1-1 (13%), 1-0 (10.4%), 0-1 (10.3%), 0-0 (8.3%), 2-1 (8.1%) | Colombia lean leads outcome probabilities at 36.6%. Selected score is the most probable bucket. Selected score is the most probable v2 Markov bucket after Matchday 1 calibration. |

### Group L

| Match | Date / Venue | Previous pick | Selected score | Most probable | Expected goals | Top scorelines | Interpretation |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| England vs Ghana | 2026-06-23 16:00 local; Boston Stadium, Boston | 3-0 | England 3-0 Ghana | 2-0 (11.5%) | 2.78-0.74 | 2-0 (11.5%), 3-0 (10.7%), 2-1 (8.6%), 1-0 (8.1%), 3-1 (8%) | England lean leads outcome probabilities at 80%. Most probable bucket is 2-0; selected score remains close enough for the existing tiebreak rule. Most probable score is 2-0; selected 3-0 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |
| Panama vs Croatia | 2026-06-23 19:00 local; Toronto Stadium, Toronto | 2-3 | Panama 2-3 Croatia | 1-2 (8.4%) | 1.55-2.58 | 1-2 (8.4%), 1-3 (7.3%), 2-2 (6.6%), 1-1 (6.4%), 2-3 (5.7%) | Croatia lean leads outcome probabilities at 60%. Most probable bucket is 1-2; selected score remains close enough for the existing tiebreak rule. Most probable score is 1-2; selected 2-3 remains in the near-equal band after the v2 goal-rate and quality-spread calibration. |

## Coefficient Changes Used

| Coefficient | Previous | Updated | Status |
| --- | ---: | ---: | --- |
| markovMonteCarlo.modelParameters.baseGoalRateMultiplier | 1 | 0.9923 | updated |
| markovMonteCarlo.modelParameters.qualityMultiplierScale | 0.65 | 0.6285 | updated |
| markovMonteCarlo.qualityWeights | v1 weights | unchanged | unchanged |
| deterministicFeatureWeights | v1 weights | unchanged | unchanged |
| squadQuality | not collected | not collected | not_available |
| venueHostAdvantage | not used | unchanged | unchanged |
| marketImpliedProbability | not collected | not collected | not_available |
| qualitativeOverlay.llmWeight | 0 | 0 | unchanged |

## Matchday 1 Non-Final Fixtures At Update Time

- Group J: Austria vs Jordan (provisional_result, score at fetch 3-1).
- Group L: Ghana vs Panama (scheduled).
- Group L: England vs Croatia (scheduled).
- Group K: Portugal vs DR Congo (scheduled).
- Group K: Uzbekistan vs Colombia (scheduled).

