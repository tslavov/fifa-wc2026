# Finals Score Predictions v1

Generated 2026-07-16T10:51:43.332Z. All scores selected below are 90-minute scores.

## 1. Executive prediction

| Match | Most probable 90-minute score | Selected 90-minute score | Expected winner | Resolution | Confidence |
| --- | ---: | ---: | --- | --- | --- |
| 103: France vs England | 1–0 | 1–0 | France | 90 minutes | low |
| 104: Spain vs Argentina | 0–0 | 0–0 | Spain | penalties | medium |

Predicted third-place team: **France**. Predicted World Cup champion: **Spain**.

## 2. Confirmed semi-final results

| Match | Previous most probable | Previous selected | Actual after 90 | Advanced |
| --- | ---: | ---: | ---: | --- |
| 101: France vs Spain | 1–2 | 1–3 | 0–2 | Spain |
| 102: England vs Argentina | 1–3 | 2–4 | 1–2 | Argentina |

The previous model correctly selected both finalists and both 90-minute away-win outcomes, but neither exact score.

## 3. Data sources and timestamps

- FIFA calendar endpoint: https://api.fifa.com/api/v3/calendar/matches?language=en&count=104&idCompetition=17&idSeason=285023; collected 2026-07-16T10:51:43.332Z; fixtures, venues and kickoffs. Detailed match records were unavailable to this collector.
- [FIFA France–Spain match report](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/france-spain-match-report-highlights); collected 2026-07-16T10:51:43.332Z; official score and scoring events.
- User-confirmed fixed input for England–Argentina; detailed official events, lineups, cards, player minutes and team statistics remain unavailable.
- Repository tournament history: `data\knockout\semi-final-team-stats-v1.json`; team rates, rankings and knockout workload.

## 4. Calibration after the semi-finals

Semi-final Markov performance: exact 0.0%, outcome 100.0%, qualification 100.0%, Brier 0.2079, log loss 0.4493, RPS 0.0896, fantasy 3.

The 5% residual evidence weight and 0.45 form scale were retained. Candidate coefficient, third-place scoring and final scoring changes were rejected. The two new matches are reported but cannot dominate cumulative/historical evidence. Ensemble weights are Markov 60.0% and Monte Carlo 40.0%; the analytical model receives a modest stability preference.

## 5. Markov versus Monte Carlo

| Match | Method | Expected goals | Most probable score | Home win 90 | Draw 90 | Away win 90 | Extra time | Penalties | Final winner |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 103: France vs England | Markov | 1.42–0.40 | 1–0 | 62.9% | 26.7% | 10.3% | 26.7% | 17.8% | France 79.5% |
| 103: France vs England | Monte Carlo | 1.42–0.40 | 1–0 | 62.9% | 26.7% | 10.3% | 26.7% | 17.8% | France 79.4% |
| 104: Spain vs Argentina | Markov | 0.71–0.15 | 0–0 | 45.9% | 46.9% | 7.2% | 46.9% | 38.4% | Spain 72.4% |
| 104: Spain vs Argentina | Monte Carlo | 0.71–0.15 | 0–0 | 46.0% | 46.8% | 7.2% | 46.8% | 38.2% | Spain 72.4% |

## 6. Top scorelines

### France vs England

- 1–0: 22.9%
- 2–0: 16.4%
- 0–0: 16.1%
- 1–1: 9.2%
- 3–0: 7.7%

### Spain vs Argentina

- 0–0: 42.2%
- 1–0: 30.1%
- 2–0: 10.7%
- 0–1: 6.3%
- 1–1: 4.5%

## 7. Context analysis

Facts: France have four rest days and England three; Spain have five and Argentina four. England and Argentina each accumulated 30 extra-time minutes in their quarter-finals, while France and Spain accumulated none. Match 103 is in Miami and match 104 in New York/New Jersey.

Inference: third-place rotation and motivation are more uncertain, while a final can encourage risk management. Neither inference changes expected goals because no repository historical validation supports a directional adjustment. Confirmed lineups, injuries, suspensions and official match-time weather were not collected; they remain missing rather than neutral facts.

## 8. Final selections

### France vs England

Most probable and selected score: **1–0** (22.9%). Second score: 2–0 (16.4%). Difference from second: 6.6%. Expected winner: **France**, by 90 minutes. Confidence: low. The mathematically highest-probability score was retained.

### Spain vs Argentina

Most probable and selected score: **0–0** (42.2%). Second score: 1–0 (30.1%). Difference from second: 12.1%. Expected winner: **Spain**, by penalties. Confidence: medium. The mathematically highest-probability score was retained.

## 9. Final concise answer

Third-place match
France vs England
Most probable score: 1–0
Selected score: 1–0
Expected third-place team: France
Expected resolution: 90 minutes

World Cup final
Spain vs Argentina
Most probable score: 0–0
Selected score: 0–0
Expected champion: Spain
Expected resolution: penalties
