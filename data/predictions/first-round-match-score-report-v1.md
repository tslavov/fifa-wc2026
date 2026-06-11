# FIFA World Cup 2026 First Round Match Score Predictions

Generated: 2026-06-08T22:37:46.618Z

noFutureUse: true

This is a prediction report only. Do not use it as collected data, training data, model input, or future prediction input.

## Method

Predicted scores combine:

- Monte Carlo group-stage simulation context from `data/predictions/group-stage-monte-carlo-v1.json`.
- Markov-chain match-state score distributions from `data/predictions/group-stage-markov-chain-v1.json`.
- LLM football reasoning as a qualitative overlay using available team strength, recent form, group context, and qualification-performance notes.

The exact score pick is only the largest individual bucket in the Markov score distribution. Because exact score buckets are small, the report also aggregates win/draw/loss, expected goals, 3+ goal wins, 4+ team-goal chances, clean sheets, and top scorelines so strong favorites are not flattened into a conservative single score.

LLM reasoning is used to explain and sanity-check the distribution-aware scenario, not to invent unavailable squad, injury, tactical, weather, or venue data.

## Assumptions And Missing Data

- First round means the first two matches in each group: listed team 1 vs team 2 and listed team 3 vs team 4.
- Group A fixture metadata is available from the existing fixture sample; Groups B-L fixture dates, times, venues, weather, and travel context are not collected in Phase 1 and are marked as assumptions.
- Squad quality, injuries, suspensions, tactical style, current weather/forecast, detailed venue effects, and head-to-head features are not available in the current model input, so they are not used as factual inputs.
- If a team has no Elo field, the existing model already omits it and relies on FIFA ranking/points plus recent form.

## Predictions

### Group A

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Mexico vs South Africa (2026-06-11, 15:00 ET, Mexico City Stadium) | Mexico 1-0 South Africa | H 60.2% / D 22.5% / A 17.3% | 1.82-0.87 | Mexico 16.2% / South Africa 1.3% | Mexico 11.1% / South Africa 1.1% | Mexico 41.9% / South Africa 15.8% | 1-0 (12.4%), 2-0 (11.4%), 1-1 (10.8%), 2-1 (9.9%), 3-0 (6.9%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Fixture metadata sourced from current Group A sample; no squad/injury/weather/tactical facts collected. |
| South Korea vs Czechia (2026-06-11, 22:00 ET, Estadio Guadalajara) | South Korea 1-2 Czechia | H 29.3% / D 21.7% / A 49% | 1.52-2.00 | South Korea 5% / Czechia 13.2% | South Korea 6.6% / Czechia 14.1% | South Korea 13.2% / Czechia 21.6% | 1-2 (9.1%), 1-1 (9%), 2-2 (7%), 2-1 (6.9%), 1-3 (6.1%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Fixture metadata sourced from current Group A sample; no squad/injury/weather/tactical facts collected. |

### Group B

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Canada vs Switzerland | Canada 1-1 Switzerland | H 33.6% / D 27.8% / A 38.6% | 1.14-1.24 | Canada 4.2% / Switzerland 5.6% | Canada 2.8% / Switzerland 3.6% | Canada 28.6% / Switzerland 31.7% | 1-1 (13.2%), 0-1 (11.4%), 1-0 (10.5%), 0-0 (9.1%), 1-2 (8.2%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Qatar vs Bosnia and Herzegovina | Qatar 1-2 Bosnia and Herzegovina | H 16.5% / D 19.3% / A 64.2% | 1.05-2.23 | Qatar 1.6% / Bosnia and Herzegovina 21.8% | Qatar 2.1% / Bosnia and Herzegovina 18.4% | Qatar 10.5% / Bosnia and Herzegovina 34.8% | 1-2 (10%), 0-2 (9.4%), 1-1 (8.9%), 0-1 (8.3%), 1-3 (7.4%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group C

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Brazil vs Morocco | Brazil 1-1 Morocco | H 22.3% / D 22% / A 55.7% | 1.16-1.94 | Brazil 2.5% / Morocco 15.4% | Brazil 2.9% / Morocco 13% | Brazil 14.1% / Morocco 31.2% | 1-1 (10.2%), 1-2 (10%), 0-1 (8.7%), 0-2 (8.5%), 1-3 (6.5%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Haiti vs Scotland | Haiti 1-2 Scotland | H 25.7% / D 21.4% / A 53% | 1.39-2.05 | Haiti 3.8% / Scotland 15.1% | Haiti 5.1% / Scotland 15.1% | Haiti 12.5% / Scotland 24.6% | 1-2 (9.5%), 1-1 (9.1%), 0-2 (6.7%), 2-2 (6.7%), 1-3 (6.5%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group D

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| United States vs Paraguay | United States 1-1 Paraguay | H 39.5% / D 22.4% / A 38.1% | 1.77-1.74 | United States 8.7% / Paraguay 8.1% | United States 10.2% / Paraguay 9.7% | United States 17.2% / Paraguay 16.7% | 1-1 (9.2%), 2-1 (8.3%), 1-2 (8.1%), 2-2 (7.3%), 1-0 (5.2%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Australia vs Turkey | Australia 1-2 Turkey | H 29.4% / D 21.2% / A 49.4% | 1.59-2.09 | Australia 5.2% / Turkey 13.9% | Australia 7.5% / Turkey 15.7% | Australia 12.1% / Turkey 20.2% | 1-2 (8.9%), 1-1 (8.4%), 2-2 (7.1%), 2-1 (6.7%), 1-3 (6.2%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group E

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Germany vs Curacao | Germany 3-1 Curacao | H 75.3% / D 13.4% / A 11.3% | 3.16-1.25 | Germany 37.2% / Curacao 1.2% | Germany 38.8% / Curacao 3.7% | Germany 28.5% / Curacao 4% | 3-1 (8.2%), 2-1 (7.7%), 3-0 (6.5%), 4-1 (6.5%), 2-0 (6.1%) | Exact score may understate favorite upside. Germany likely win; 3-1 is the top exact score, but a 3+ goal win remains plausible. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Ivory Coast vs Ecuador | Ivory Coast 1-1 Ecuador | H 37.4% / D 28.3% / A 34.3% | 1.19-1.12 | Ivory Coast 5.1% / Ecuador 4.2% | Ivory Coast 3.2% / Ecuador 2.7% | Ivory Coast 32.3% / Ecuador 30.3% | 1-1 (13.4%), 1-0 (11.8%), 0-1 (11.1%), 0-0 (9.8%), 2-1 (8%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group F

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Netherlands vs Japan | Netherlands 1-1 Japan | H 44% / D 23.6% / A 32.3% | 1.69-1.42 | Netherlands 9.6% / Japan 5.3% | Netherlands 9% / Japan 5.5% | Netherlands 23.8% / Japan 18.1% | 1-1 (10.8%), 2-1 (9.2%), 1-2 (7.7%), 1-0 (7.4%), 2-2 (6.6%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Tunisia vs Sweden | Tunisia 2-1 Sweden | H 45% / D 21.4% / A 33.7% | 2.02-1.74 | Tunisia 11.8% / Sweden 6.9% | Tunisia 14.4% / Sweden 9.7% | Tunisia 17.3% / Sweden 13% | 2-1 (8.4%), 1-1 (8.2%), 2-2 (7.4%), 1-2 (7.2%), 3-1 (5.7%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group G

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Belgium vs Egypt | Belgium 2-1 Egypt | H 62.1% / D 20.5% / A 17.4% | 2.08-1.01 | Belgium 19.4% / Egypt 1.6% | Belgium 15.5% / Egypt 1.9% | Belgium 36.2% / Egypt 12.3% | 2-1 (10.1%), 2-0 (9.9%), 1-1 (9.6%), 1-0 (9.4%), 3-1 (7%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Iran vs New Zealand | Iran 2-0 New Zealand | H 79.2% / D 13.6% / A 7.2% | 2.64-0.69 | Iran 35.8% / New Zealand 0.3% | Iran 27.2% / New Zealand 0.5% | Iran 50% / New Zealand 6.8% | 2-0 (12.5%), 3-0 (11.1%), 1-0 (9.3%), 2-1 (8.7%), 3-1 (7.7%) | Exact score may understate favorite upside. Iran likely win; 2-0 is the top exact score, but a 3+ goal win remains plausible. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group H

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Spain vs Cape Verde | Spain 2-0 Cape Verde | H 78.3% / D 13.2% / A 8.5% | 2.88-0.90 | Spain 37.5% / Cape Verde 0.6% | Spain 32.7% / Cape Verde 1.3% | Spain 40.5% / Cape Verde 5.3% | 2-0 (9.5%), 3-0 (9.2%), 2-1 (8.6%), 3-1 (8.4%), 4-0 (6.6%) | Exact score may understate favorite upside. Spain likely win; 2-0 is the top exact score, but a 3+ goal win remains plausible. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Saudi Arabia vs Uruguay | Saudi Arabia 1-1 Uruguay | H 24.8% / D 23.5% / A 51.7% | 1.16-1.77 | Saudi Arabia 2.9% / Uruguay 12.6% | Saudi Arabia 3% / Uruguay 10.2% | Saudi Arabia 16.8% / Uruguay 31.1% | 1-1 (11.1%), 1-2 (9.9%), 0-1 (9.4%), 0-2 (8.4%), 2-1 (6.4%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group I

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| France vs Senegal | France 2-1 Senegal | H 51.7% / D 21.5% / A 26.9% | 2.03-1.43 | France 14.5% / Senegal 4.2% | France 14.7% / Senegal 5.6% | France 23.6% / Senegal 12.8% | 2-1 (9.4%), 1-1 (9.1%), 2-2 (6.8%), 1-2 (6.6%), 2-0 (6.5%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Norway vs Iraq | Norway 2-1 Iraq | H 64.1% / D 19.6% / A 16.3% | 2.19-1.02 | Norway 21.4% / Iraq 1.5% | Norway 17.6% / Iraq 1.9% | Norway 35.9% / Iraq 10.9% | 2-1 (10%), 2-0 (9.7%), 1-1 (9.1%), 1-0 (8.8%), 3-1 (7.3%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group J

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Argentina vs Algeria | Argentina 1-0 Algeria | H 49.9% / D 27.3% / A 22.9% | 1.41-0.86 | Argentina 9.2% / Algeria 1.8% | Argentina 5.3% / Algeria 1.1% | Argentina 42.2% / Algeria 24.2% | 1-0 (14.6%), 1-1 (12.7%), 2-0 (10.3%), 0-0 (10.2%), 2-1 (9%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Austria vs Jordan | Austria 2-1 Jordan | H 77.3% / D 13.3% / A 9.4% | 2.95-0.99 | Austria 37.2% / Jordan 0.7% | Austria 34.1% / Jordan 1.8% | Austria 36.9% / Jordan 5% | 2-1 (8.5%), 2-0 (8.5%), 3-1 (8.4%), 3-0 (8.4%), 4-1 (6.2%) | Exact score may understate favorite upside. Austria likely win; 2-1 is the top exact score, but a 3+ goal win remains plausible. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group K

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Portugal vs Uzbekistan | Portugal 1-1 Uzbekistan | H 54.3% / D 21.8% / A 23.8% | 1.98-1.25 | Portugal 15.2% / Uzbekistan 3.1% | Portugal 13.7% / Uzbekistan 3.7% | Portugal 28.3% / Uzbekistan 13.5% | 1-1 (9.9%), 2-1 (9.9%), 1-0 (7.7%), 2-0 (7.7%), 3-1 (6.5%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Colombia vs DR Congo | Colombia 1-1 DR Congo | H 36.9% / D 27.1% / A 36% | 1.26-1.24 | Colombia 5.4% / DR Congo 5.1% | Colombia 3.8% / DR Congo 3.6% | Colombia 28.7% / DR Congo 28.2% | 1-1 (13%), 1-0 (10.3%), 0-1 (10.2%), 2-1 (8.2%), 0-0 (8.1%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

### Group L

| Match | Exact Score Pick | W/D/L | Expected Goals | 3+ Goal Win Chance | 4+ Goals Chance | Clean Sheet | Top Scorelines | Interpretation |
|---|---:|---:|---:|---:|---:|---:|---|---|
| England vs Croatia | England 1-1 Croatia | H 53.2% / D 22% / A 24.8% | 1.95-1.28 | England 14.5% / Croatia 3.3% | England 13.3% / Croatia 4% | England 27.5% / Croatia 13.8% | 1-1 (9.9%), 2-1 (9.8%), 1-0 (7.6%), 2-0 (7.5%), 1-2 (6.4%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |
| Ghana vs Panama | Ghana 1-2 Panama | H 25.4% / D 20.2% / A 54.4% | 1.51-2.25 | Ghana 4.1% / Panama 17.1% | Ghana 6.6% / Panama 18.8% | Ghana 10.3% / Panama 21.8% | 1-2 (9%), 1-1 (7.9%), 2-2 (6.9%), 1-3 (6.8%), 2-1 (6%) | Balanced match. No team has clear high-margin upside in the aggregate score distribution. Pairing/date/venue/weather are assumptions or not collected; no squad/injury/weather/tactical facts collected. |

