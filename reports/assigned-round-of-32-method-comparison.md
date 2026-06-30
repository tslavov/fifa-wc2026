# Assigned Round of 32 Method Comparison

Generated: 2026-06-30T21:25:54.762Z

## Scope

- Compared fixtures: 16.
- Unanimous 90-minute lean: 15.
- Split 90-minute lean: 1.
- Markov/Monte Carlo exact-score agreement: 13/16.
- Markov/Pure LLM exact-score agreement: 5/16.
- Extra time and penalties are not modeled.

## Comparison Table

| Match | Markov chain | Monte Carlo | Pure LLM | Lean agreement |
| --- | --- | --- | --- | --- |
| 73: South Africa vs Canada | 0-2 (H 10.4% / D 15.5% / A 74.1%) | 0-2 (H 11% / D 15.7% / A 73.4%) | 1-2 (away) | 3/3 |
| 74: Germany vs Paraguay | 3-0 (H 83.3% / D 10.1% / A 6.6%) | 3-0 (H 83.1% / D 10.2% / A 6.8%) | 2-0 (home) | 3/3 |
| 75: Netherlands vs Morocco | 2-1 (H 51.5% / D 18.8% / A 29.7%) | 2-2 (H 51.2% / D 19% / A 29.8%) | 2-1 (home) | 3/3 |
| 76: Brazil vs Japan | 2-1 (H 65.6% / D 18.9% / A 15.5%) | 2-1 (H 65.2% / D 19% / A 15.8%) | 2-1 (home) | 3/3 |
| 77: France vs Sweden | 4-1 (H 88.6% / D 7% / A 4.4%) | 4-1 (H 88.6% / D 6.8% / A 4.6%) | 3-1 (home) | 3/3 |
| 78: Ivory Coast vs Norway | 2-1 (H 44.8% / D 20.7% / A 34.5%) | 2-1 (H 44.5% / D 20.7% / A 34.9%) | 1-2 (away) | 2/3 |
| 79: Mexico vs Ecuador | 1-0 (H 71.3% / D 20.9% / A 7.8%) | 1-0 (H 70.5% / D 21.4% / A 8.1%) | 2-0 (home) | 3/3 |
| 80: England vs DR Congo | 2-0 (H 82% / D 12.2% / A 5.8%) | 2-0 (H 82.1% / D 12% / A 5.9%) | 2-0 (home) | 3/3 |
| 81: United States vs Bosnia and Herzegovina | 4-1 (H 81.4% / D 10% / A 8.6%) | 4-1 (H 81% / D 10% / A 9%) | 2-1 (home) | 3/3 |
| 82: Belgium vs Senegal | 2-1 (H 64.8% / D 16.5% / A 18.7%) | 3-1 (H 64.9% / D 16% / A 19.1%) | 2-1 (home) | 3/3 |
| 83: Portugal vs Croatia | 3-0 (H 86.2% / D 8.6% / A 5.2%) | 3-0 (H 85.5% / D 8.8% / A 5.7%) | 2-1 (home) | 3/3 |
| 84: Spain vs Austria | 3-0 (H 86.2% / D 9.5% / A 4.3%) | 3-0 (H 85.9% / D 9.7% / A 4.4%) | 2-0 (home) | 3/3 |
| 85: Switzerland vs Algeria | 3-1 (H 80.4% / D 10.7% / A 8.9%) | 3-1 (H 80% / D 10.7% / A 9.3%) | 2-1 (home) | 3/3 |
| 86: Argentina vs Cape Verde | 2-0 (H 89.1% / D 8.5% / A 2.4%) | 3-0 (H 89.2% / D 8.4% / A 2.4%) | 2-0 (home) | 3/3 |
| 87: Colombia vs Ghana | 1-0 (H 56.3% / D 30.3% / A 13.4%) | 1-0 (H 55.8% / D 30.6% / A 13.6%) | 2-0 (home) | 3/3 |
| 88: Australia vs Egypt | 1-1 (H 29.8% / D 27.2% / A 43%) | 1-1 (H 29.8% / D 27.2% / A 43%) | 0-1 (away) | 3/3 |

## Pure LLM Notes

- 73: South Africa vs Canada: Canada's group scoring and goal difference look more convincing than South Africa's lower-output route.
- 74: Germany vs Paraguay: Germany's attack and group goal difference point to control, but a knockout setting argues for a slightly lower score than the model's 3-0.
- 75: Netherlands vs Morocco: Netherlands have the higher attacking ceiling, while Morocco's group strength keeps the margin narrow.
- 76: Brazil vs Japan: Brazil have the stronger defensive profile and top-end quality, with Japan still likely to score.
- 77: France vs Sweden: France's group dominance is the clearest signal, though Sweden's scoring record makes a consolation plausible.
- 78: Ivory Coast vs Norway: Norway's attack and Elo profile are appealing enough to override Ivory Coast's cleaner group table.
- 79: Mexico vs Ecuador: Mexico's perfect group record and clean-sheet profile make them a strong qualitative pick against Ecuador.
- 80: England vs DR Congo: England have the stronger squad baseline and DR Congo's group record is still weak even with the assigned slot.
- 81: United States vs Bosnia and Herzegovina: The United States have the better group result and home-region context, but Bosnia's scoring keeps it competitive.
- 82: Belgium vs Senegal: Belgium's unbeaten group and stronger baseline edge Senegal, while Senegal's attack keeps the score close.
- 83: Portugal vs Croatia: Portugal's attacking return and squad quality point slightly above Croatia's uneven group phase.
- 84: Spain vs Austria: Spain's defensive group record and control profile make them a clear pick over Austria.
- 85: Switzerland vs Algeria: Switzerland's balance and group consistency look safer than Algeria's third-place route.
- 86: Argentina vs Cape Verde: Argentina are the stronger side, while Cape Verde's low-scoring profile points to a controlled match.
- 87: Colombia vs Ghana: Colombia's group position and defensive profile give them the qualitative edge over Ghana.
- 88: Australia vs Egypt: Egypt's unbeaten group profile and better scoring form edge Australia in a tight knockout game.

## Method Notes

- Markov chain: exact score distribution from the assigned Round of 32 prediction artifact.
- Monte Carlo: 20,000 seeded score samples per fixture from the Markov expected-goals baseline.
- Pure LLM: qualitative pick only, deliberately not fed back into model inputs.

## Warnings

- Group stage is still provisional in the source prediction artifact.
- All three methods are 90-minute comparisons; extra time and penalties are not modeled.
- Monte Carlo uses the same xG baseline as Markov, so differences are sampling/aggregation differences rather than independent data.
