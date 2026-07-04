# Round of 16 Predictions

Generated: 2026-07-04T09:08:43.777Z

## Round of 32 Evaluation

- Markov: exact 28.6%, 90-minute outcome 78.6%, advancing 81.3%, Brier 0.3533.
- Monte Carlo: exact 28.6%, 90-minute outcome 85.7%, advancing 81.3%, Brier 0.3542.
- LLM-only: exact 28.6%, 90-minute outcome 78.6%, advancing 87.5%.

## Calibration

- baseGoalRateMultiplier: 0.9675 -> 0.94. Small global dampening for knockout scoring, capped to avoid overfitting one round.
- qualityMultiplierScale: 0.6285 -> 0.61. Slightly reduce favorite separation while preserving ranking/strength signal.
- penaltyShootoutConditionalOnDraw: null -> 0.35. Expose qualification probabilities without feeding old predictions into model inputs.

## Picks

| Match | 90-min score | Top two scorelines | W/D/L | xG | ET | Pens | Qualify | Pick | Confidence | Note |
| ---: | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 89 | Paraguay 0-4 France | 0-4 11% xFP 3.9125, 0-3 10.2% xFP 3.8741 | 1.6% / 4.2% / 94.3% | 0.584-4.2498 | 4.2% | 1.5% | Paraguay 3%, France 97% | France | High | Paraguay totals 3-5 vs France 13-2; qualification lean France. |
| 90 | Canada 2-2 Morocco | 2-2 7.5% xFP 1.3895, 2-1 7.4% xFP 2.009 | 41.4% / 20.6% / 38% | 2.0865-1.9966 | 20.6% | 7.2% | Canada 51%, Morocco 49% | Canada | Low | Canada totals 9-3 vs Morocco 7-4; qualification lean Canada. |
| 91 | Brazil 4-1 Norway | 4-1 7% xFP 3.3046, 3-1 6.5% xFP 3.2788 | 84.9% / 8.5% / 6.6% | 4.2065-1.3678 | 8.5% | 3% | Brazil 89.8%, Norway 10.2% | Brazil | High | Brazil totals 9-2 vs Norway 10-8; qualification lean Brazil. |
| 92 | Mexico 2-0 England | 2-0 10.8% xFP 2.9163, 1-0 10.3% xFP 2.8878 | 64.1% / 20.2% / 15.7% | 2.0741-0.9235 | 20.2% | 7.1% | Mexico 73.8%, England 26.2% | Mexico | Medium | Mexico totals 8-0 vs England 6-3; qualification lean Mexico. |
| 93 | Portugal 0-2 Spain | 0-2 11.1% xFP 2.9244, 0-1 10.9% xFP 2.9118 | 15.7% / 20.6% / 63.7% | 0.8952-2.0187 | 20.6% | 7.2% | Portugal 25.2%, Spain 74.8% | Spain | Medium | Portugal totals 8-2 vs Spain 8-0; qualification lean Spain. |
| 94 | United States 2-2 Belgium | 2-2 6.9% xFP 1.2974, 1-2 6% xFP 2.0406 | 35.6% / 18.8% / 45.6% | 2.2618-2.5416 | 18.8% | 6.6% | United States 44.5%, Belgium 55.5% | Belgium | Low | United States totals 10-4 vs Belgium 9-4; qualification lean Belgium. |
| 95 | Argentina 4-1 Egypt | 4-1 7.4% xFP 3.4374, 3-1 7.1% xFP 3.4227 | 88.2% / 7.3% / 4.5% | 4.0899-1.0421 | 7.3% | 2.6% | Argentina 92.9%, Egypt 7.1% | Argentina | High | Argentina totals 11-3 vs Egypt 6-4; qualification lean Argentina. |
| 96 | Switzerland 1-1 Colombia | 1-1 10.4% xFP 1.64, 1-2 9.8% xFP 2.4808 | 25.5% / 22.7% / 51.8% | 1.2563-1.8678 | 22.7% | 7.9% | Switzerland 36.3%, Colombia 63.7% | Colombia | Medium | Switzerland totals 9-3 vs Colombia 5-1; qualification lean Colombia. |
