# Quarter-Final Markov vs Monte Carlo

Generated: 2026-07-08T09:27:03.559Z

## Files Used

- data\predictions\quarter-final-score-predictions-v1.json
- data\knockout\quarter-final-team-stats-v1.json
- data\model\calibration-changes-after-round-of-32-v1.json
- data\model\quarter-final-model-adjustments-v1.json

## Commands Executed

- `node scripts/updateAfterRoundOf16.mjs`
- `node scripts/reportQuarterFinalMarkovMonteCarlo.mjs`

## Seeds

- Monte Carlo iterations per fixture: 250000
- Monte Carlo seed base: 2026070800
- 97: France vs Morocco seed 2026070897
- 98: Spain vs Belgium seed 2026070898
- 99: Norway vs England seed 2026070899
- 100: Argentina vs Switzerland seed 2026070900

## Results

| Match | Method | Expected goals | Most probable score | Selected score | Home win | Draw | Away win | Extra time | Penalties | Qualification |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 97: France vs Morocco | Markov | 3.0368-1.1974 | 3-1 (8.3%) | 3-1 | 74.6% | 13.9% | 11.5% | 13.9% | 6.1% | France 84%, Morocco 16% |
| 97: France vs Morocco | Monte Carlo | 3.0461-1.192 | 3-1 (8.3%) | 3-1 | 74.7% | 13.8% | 11.5% | 13.8% | 6.1% | France 84.1%, Morocco 15.9% |
| 98: Spain vs Belgium | Markov | 2.5827-1.08 | 2-1 (9.4%) | 2-1 | 70% | 16.5% | 13.5% | 16.5% | 8% | Spain 80.8%, Belgium 19.2% |
| 98: Spain vs Belgium | Monte Carlo | 2.5863-1.0782 | 2-1 (9.2%) | 2-1 | 70% | 16.5% | 13.6% | 16.5% | 7.9% | Spain 80.7%, Belgium 19.3% |
| 99: Norway vs England | Markov | 1.5999-3.1481 | 1-3 (7.4%) | 1-3 | 16.4% | 15% | 68.6% | 15% | 6.3% | Norway 21.7%, England 78.3% |
| 99: Norway vs England | Monte Carlo | 1.6007-3.1446 | 1-3 (7.3%) | 1-3 | 16.5% | 15.1% | 68.5% | 15.1% | 6.4% | Norway 21.8%, England 78.3% |
| 100: Argentina vs Switzerland | Markov | 2.6644-1.4665 | 2-1 (8.5%) | 2-1 | 63.3% | 17.5% | 19.3% | 17.5% | 8% | Argentina 74.2%, Switzerland 25.8% |
| 100: Argentina vs Switzerland | Monte Carlo | 2.6696-1.4674 | 2-1 (8.5%) | 2-1 | 63.1% | 17.6% | 19.3% | 17.6% | 8% | Argentina 74.2%, Switzerland 25.8% |

## Method Comparison

| Match | Monte Carlo pick | Markov pick | Same winner | Same score |
| --- | --- | --- | --- | --- |
| 97: France vs Morocco | France | France | Yes | Yes |
| 98: Spain vs Belgium | Spain | Spain | Yes | Yes |
| 99: Norway vs England | England | England | Yes | Yes |
| 100: Argentina vs Switzerland | Argentina | Argentina | Yes | Yes |

## Disagreements

- No winner or exact-score disagreements; qualification differences are sampling noise only.

## Validation

- 97 Markov: pass; score matrix 0.9996, 1X2 1, qualification 1, penalties<=ET true.
- 97 Monte Carlo: pass; score matrix 1, 1X2 1, qualification 1, penalties<=ET true.
- 98 Markov: pass; score matrix 0.9998, 1X2 0.9999, qualification 1, penalties<=ET true.
- 98 Monte Carlo: pass; score matrix 1, 1X2 1, qualification 1, penalties<=ET true.
- 99 Markov: pass; score matrix 1.0001, 1X2 1, qualification 1, penalties<=ET true.
- 99 Monte Carlo: pass; score matrix 1, 1X2 1, qualification 1, penalties<=ET true.
- 100 Markov: pass; score matrix 0.9994, 1X2 1, qualification 1, penalties<=ET true.
- 100 Monte Carlo: pass; score matrix 1, 1X2 1, qualification 1, penalties<=ET true.
