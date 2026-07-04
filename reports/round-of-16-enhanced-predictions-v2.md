# Round of 16 Enhanced Predictions v2

Generated: 2026-07-04T09:44:08.076Z

## Collection Summary

- Collected: official fixture venue/time, team rest days, previous extra-time flag and team-level accumulated match-minute estimate.
- Missing: confirmed injuries, suspensions, yellow-card eligibility, expected/confirmed player lineups, player minutes/events/xG/xA, travel distance, time-zone change, altitude and official match-time weather forecast values.
- Retained features: none.
- Rejected features: fatigue, restDifference, lineupStrength, playerAvailability, attackingForm, defensiveForm, goalkeeperForm, travel, altitude, weather.
- Model changes: none; contextual features were neutral or failed validation.

## Backtest

- Current: exact 28.6%, outcome 78.6%, Brier 0.3533, log loss n/a, fantasy 4.0714.
- Candidate: exact 28.6%, outcome 78.6%, Brier 0.3535, log loss n/a, fantasy 4.0714.

## Predictions

| Match | Original xG | Adjusted xG | Top five | W/D/L | ET | Pens | Qualify | Markov | Monte Carlo | LLM-only | Fantasy | Confidence | Absences | Note |
| ---: | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 89: Paraguay vs France | 0.584-4.2498 | 0.584-4.2498 | 0-4 11%; 0-3 10.2%; 0-5 9.4%; 0-2 7%; 0-6 6.6% | 1.6% / 4.2% / 94.3% | 4.2% | 1.5% | Paraguay 3%, France 97% | 0-4 France | 0-4 France | 0-2 France | 0-4 xFP 3.9125 | High | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |
| 90: Canada vs Morocco | 2.0865-1.9966 | 2.0865-1.9966 | 2-2 7.5%; 2-1 7.4%; 1-2 7.1%; 1-1 7%; 3-2 5.2% | 41.4% / 20.6% / 38% | 20.6% | 7.2% | Canada 51%, Morocco 49% | 2-2 Canada | 2-1 Canada | 1-1 Morocco | 2-1 xFP 2.009 | Low | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |
| 91: Brazil vs Norway | 4.2065-1.3678 | 4.2065-1.3678 | 4-1 7%; 3-1 6.5%; 5-1 5.9%; 4-0 5%; 4-2 4.8% | 84.9% / 8.5% / 6.6% | 8.5% | 3% | Brazil 89.8%, Norway 10.2% | 4-1 Brazil | 4-1 Brazil | 2-0 Brazil | 4-1 xFP 3.3046 | High | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |
| 92: Mexico vs England | 2.0741-0.9235 | 2.0741-0.9235 | 2-0 10.8%; 1-0 10.3%; 2-1 10.1%; 1-1 9.6%; 3-0 7.5% | 64.1% / 20.2% / 15.7% | 20.2% | 7.1% | Mexico 73.8%, England 26.2% | 2-0 Mexico | 2-0 Mexico | 1-1 Mexico | 2-0 xFP 2.9163 | Medium | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |
| 93: Portugal vs Spain | 0.8952-2.0187 | 0.8952-2.0187 | 0-2 11.1%; 0-1 10.9%; 1-2 10.1%; 1-1 9.9%; 0-3 7.5% | 15.7% / 20.6% / 63.7% | 20.6% | 7.2% | Portugal 25.2%, Spain 74.8% | 0-2 Spain | 0-2 Spain | 0-2 Spain | 0-2 xFP 2.9244 | Medium | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |
| 94: United States vs Belgium | 2.2618-2.5416 | 2.2618-2.5416 | 2-2 6.9%; 1-2 6%; 2-3 5.9%; 2-1 5.3%; 3-2 5.2% | 35.6% / 18.8% / 45.6% | 18.8% | 6.6% | United States 44.5%, Belgium 55.5% | 2-2 Belgium | 2-2 Belgium | 1-1 Belgium | 1-2 xFP 2.0406 | Low | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |
| 95: Argentina vs Egypt | 4.0899-1.0421 | 4.0899-1.0421 | 4-1 7.4%; 3-1 7.1%; 4-0 7%; 3-0 6.8%; 5-1 6.1% | 88.2% / 7.3% / 4.5% | 7.3% | 2.6% | Argentina 92.9%, Egypt 7.1% | 4-1 Argentina | 3-1 Argentina | 2-0 Argentina | 4-1 xFP 3.4374 | High | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |
| 96: Switzerland vs Colombia | 1.2563-1.8678 | 1.2563-1.8678 | 1-1 10.4%; 1-2 9.8%; 0-1 8.1%; 0-2 7.7%; 2-1 6.5% | 25.5% / 22.7% / 51.8% | 22.7% | 7.9% | Switzerland 36.3%, Colombia 63.7% | 1-1 Colombia | 1-1 Colombia | 1-1 Colombia | 1-2 xFP 2.4808 | Medium | unavailable | No contextual feature passed validation or source sufficiency, so expected goals are unchanged from the baseline. |

## Final Fantasy Picks

- 89: Paraguay vs France: 0-4 (3.9125 xFP)
- 90: Canada vs Morocco: 2-1 (2.009 xFP)
- 91: Brazil vs Norway: 4-1 (3.3046 xFP)
- 92: Mexico vs England: 2-0 (2.9163 xFP)
- 93: Portugal vs Spain: 0-2 (2.9244 xFP)
- 94: United States vs Belgium: 1-2 (2.0406 xFP)
- 95: Argentina vs Egypt: 4-1 (3.4374 xFP)
- 96: Switzerland vs Colombia: 1-2 (2.4808 xFP)
