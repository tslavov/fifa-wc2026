# FIFA World Cup 2026 First-Round Score Predictions

Generated from existing project data on 2026-06-11. These score predictions are estimates, not facts.

## Methodology

- Monte Carlo outputs provide group and tournament context, especially average points, positions, and advancement probabilities.
- Markov-chain outputs provide fixture-level expected goals and scoreline distributions. This report reconstructs the full Markov score distribution from the stored fixture lambdas and model parameters.
- Team strength, recent form, and the qualification-performance notes in `fifa-world-cup-2026-groups.md` are used as context for tie explanations and sanity checks.
- LLM reasoning is used only to explain and sanity-check the model outputs; it does not add injuries, lineups, weather, or tactical news.
- Near-equal scorelines are those within 5% relative probability of the leader or within 0.03 absolute probability points. Near-equal clusters are resolved by selecting the highest-scoring result, then preferring the stronger team winning, then better recent form, then the safer draw.

## Data Availability

Inputs inspected: `fifa-world-cup-2026-groups.md`, `data\model-input\team-strength.json`, `data\model-input\recent-form.json`, `data\squads\squad-quality.json`, `data\predictions\group-stage-monte-carlo-v1.json`, and `data\predictions\group-stage-markov-chain-v1.json`.

- Missing or omitted input: squad quality is present only as a placeholder and was not used numerically.
- Missing or omitted input: venue/host advantage is unavailable in Phase 1 model input.
- Missing or omitted input: injuries, lineups, weather, xG, coach/tactics, and tactical news are unavailable and omitted.
- Prediction artifacts are treated as quarantined outputs and are used here only for this report, not as future model inputs.

## Summary

Confidence counts: High 1, Medium 41, Low 30. Higher-score tiebreak applied in 59 of 72 matches.

| Match | Selected score | Confidence | Notes |
| --- | --- | --- | --- |
| Group A: Mexico vs South Africa | Mexico 2-1 South Africa | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group A: Mexico vs South Korea | Mexico 2-1 South Korea | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group A: Mexico vs Czechia | Mexico 2-1 Czechia | Medium | 3 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group A: South Africa vs South Korea | South Africa 1-2 South Korea | Medium | 3 near-equal scorelines; higher-score tiebreak selects 1-2. |
| Group A: South Africa vs Czechia | South Africa 2-2 Czechia | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group A: South Korea vs Czechia | South Korea 2-2 Czechia | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-2. |
| Group B: Canada vs Switzerland | Canada 1-1 Switzerland | Medium | 3 near-equal scorelines; leader survives the tiebreak. |
| Group B: Canada vs Qatar | Canada 2-0 Qatar | Medium | 2 near-equal scorelines; higher-score tiebreak selects 2-0. |
| Group B: Canada vs Bosnia and Herzegovina | Canada 1-1 Bosnia and Herzegovina | Medium | 2 near-equal scorelines; leader survives the tiebreak. |
| Group B: Switzerland vs Qatar | Switzerland 3-1 Qatar | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group B: Switzerland vs Bosnia and Herzegovina | Switzerland 3-1 Bosnia and Herzegovina | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group B: Qatar vs Bosnia and Herzegovina | Qatar 1-3 Bosnia and Herzegovina | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group C: Brazil vs Morocco | Brazil 1-2 Morocco | Medium | 4 near-equal scorelines; higher-score tiebreak selects 1-2. |
| Group C: Brazil vs Haiti | Brazil 3-1 Haiti | Medium | 4 near-equal scorelines; higher-score tiebreak selects 3-1. |
| Group C: Brazil vs Scotland | Brazil 3-2 Scotland | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group C: Morocco vs Haiti | Morocco 2-0 Haiti | Medium | 2 near-equal scorelines; leader survives the tiebreak. |
| Group C: Morocco vs Scotland | Morocco 2-1 Scotland | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group C: Haiti vs Scotland | Haiti 1-3 Scotland | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group D: United States vs Paraguay | United States 2-2 Paraguay | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-2. |
| Group D: United States vs Australia | United States 2-2 Australia | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-2. |
| Group D: United States vs Turkey | United States 3-2 Turkey | Low | 8 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group D: Paraguay vs Australia | Paraguay 1-1 Australia | High | Clear scoreline leader in the Markov distribution. |
| Group D: Paraguay vs Turkey | Paraguay 1-3 Turkey | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group D: Australia vs Turkey | Australia 1-3 Turkey | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group E: Germany vs Curacao | Germany 4-1 Curacao | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group E: Germany vs Ivory Coast | Germany 3-1 Ivory Coast | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group E: Germany vs Ecuador | Germany 2-1 Ecuador | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group E: Curacao vs Ivory Coast | Curacao 1-3 Ivory Coast | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group E: Curacao vs Ecuador | Curacao 1-2 Ecuador | Medium | 4 near-equal scorelines; higher-score tiebreak selects 1-2. |
| Group E: Ivory Coast vs Ecuador | Ivory Coast 1-1 Ecuador | Medium | 3 near-equal scorelines; leader survives the tiebreak. |
| Group F: Netherlands vs Japan | Netherlands 2-1 Japan | Medium | 2 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group F: Netherlands vs Tunisia | Netherlands 4-1 Tunisia | Low | 7 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group F: Netherlands vs Sweden | Netherlands 4-1 Sweden | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group F: Japan vs Tunisia | Japan 3-1 Tunisia | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group F: Japan vs Sweden | Japan 3-1 Sweden | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group F: Tunisia vs Sweden | Tunisia 3-1 Sweden | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group G: Belgium vs Egypt | Belgium 2-1 Egypt | Medium | 4 near-equal scorelines; leader survives the tiebreak. |
| Group G: Belgium vs Iran | Belgium 2-1 Iran | Medium | 4 near-equal scorelines; leader survives the tiebreak. |
| Group G: Belgium vs New Zealand | Belgium 5-0 New Zealand | Medium | 3 near-equal scorelines; higher-score tiebreak selects 5-0. |
| Group G: Egypt vs Iran | Egypt 1-1 Iran | Medium | 2 near-equal scorelines; leader survives the tiebreak. |
| Group G: Egypt vs New Zealand | Egypt 2-0 New Zealand | Medium | 2 near-equal scorelines; leader survives the tiebreak. |
| Group G: Iran vs New Zealand | Iran 3-0 New Zealand | Medium | 2 near-equal scorelines; higher-score tiebreak selects 3-0. |
| Group H: Spain vs Cape Verde | Spain 3-1 Cape Verde | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group H: Spain vs Saudi Arabia | Spain 4-0 Saudi Arabia | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group H: Spain vs Uruguay | Spain 2-1 Uruguay | Medium | 3 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group H: Cape Verde vs Saudi Arabia | Cape Verde 2-2 Saudi Arabia | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-2. |
| Group H: Cape Verde vs Uruguay | Cape Verde 1-2 Uruguay | Medium | 2 near-equal scorelines; higher-score tiebreak selects 1-2. |
| Group H: Saudi Arabia vs Uruguay | Saudi Arabia 1-2 Uruguay | Medium | 4 near-equal scorelines; higher-score tiebreak selects 1-2. |
| Group I: France vs Senegal | France 2-2 Senegal | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group I: France vs Norway | France 2-2 Norway | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-2. |
| Group I: France vs Iraq | France 3-1 Iraq | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group I: Senegal vs Norway | Senegal 1-3 Norway | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group I: Senegal vs Iraq | Senegal 2-1 Iraq | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group I: Norway vs Iraq | Norway 3-1 Iraq | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group J: Argentina vs Algeria | Argentina 1-1 Algeria | Medium | 2 near-equal scorelines; higher-score tiebreak selects 1-1. |
| Group J: Argentina vs Austria | Argentina 1-1 Austria | Medium | 2 near-equal scorelines; leader survives the tiebreak. |
| Group J: Argentina vs Jordan | Argentina 3-1 Jordan | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group J: Algeria vs Austria | Algeria 1-1 Austria | Medium | 2 near-equal scorelines; leader survives the tiebreak. |
| Group J: Algeria vs Jordan | Algeria 3-1 Jordan | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group J: Austria vs Jordan | Austria 4-1 Jordan | Low | 8 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group K: Portugal vs Uzbekistan | Portugal 2-1 Uzbekistan | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group K: Portugal vs Colombia | Portugal 3-2 Colombia | Low | 7 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group K: Portugal vs DR Congo | Portugal 1-1 DR Congo | Medium | 2 near-equal scorelines; leader survives the tiebreak. |
| Group K: Uzbekistan vs Colombia | Uzbekistan 1-2 Colombia | Medium | 3 near-equal scorelines; higher-score tiebreak selects 1-2. |
| Group K: Uzbekistan vs DR Congo | Uzbekistan 1-1 DR Congo | Medium | 3 near-equal scorelines; higher-score tiebreak selects 1-1. |
| Group K: Colombia vs DR Congo | Colombia 1-1 DR Congo | Medium | 3 near-equal scorelines; leader survives the tiebreak. |
| Group L: England vs Croatia | England 2-1 Croatia | Medium | 4 near-equal scorelines; higher-score tiebreak selects 2-1. |
| Group L: England vs Ghana | England 3-0 Ghana | Medium | 3 near-equal scorelines; higher-score tiebreak selects 3-0. |
| Group L: England vs Panama | England 3-1 Panama | Low | 6 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group L: Croatia vs Ghana | Croatia 3-1 Ghana | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group L: Croatia vs Panama | Croatia 3-2 Panama | Low | 5 near-equal scorelines, so confidence is low and the higher-score rule matters heavily. |
| Group L: Ghana vs Panama | Ghana 1-3 Panama | Medium | 4 near-equal scorelines; higher-score tiebreak selects 1-3. |

## Match Details

| Match | Top scoreline probabilities | Selected score | Why this score was selected | Higher-score tiebreak applied? |
| --- | --- | --- | --- | --- |
| Group A: Mexico vs South Africa | 1-0 12.4% (top); 2-0 11.4%; 1-1 10.8%; 2-1 9.9% (selected); 3-0 6.9% | Mexico 2-1 South Africa | Top was 1-0 at 12.4%, but 2-1 stayed inside the near-equal band at 9.9% and had more total goals; Mexico is stronger by ranking/Elo inputs; Mexico has the better recent-form profile. | Yes |
| Group A: Mexico vs South Korea | 1-0 11.4% (top); 1-1 10.8%; 2-0 10.6%; 2-1 10.0% (selected); 3-0 6.5% | Mexico 2-1 South Korea | Top was 1-0 at 11.4%, but 2-1 stayed inside the near-equal band at 10.0% and had more total goals; Mexico is stronger by ranking/Elo inputs; Mexico has the better recent-form profile. | Yes |
| Group A: Mexico vs Czechia | 1-1 11.7% (top); 1-0 10.5%; 2-1 9.7% (selected); 2-0 8.7%; 0-1 7.0% | Mexico 2-1 Czechia | Top was 1-1 at 11.7%, but 2-1 stayed inside the near-equal band at 9.7% and had more total goals; Mexico is stronger by ranking/Elo inputs; Mexico has the better recent-form profile. | Yes |
| Group A: South Africa vs South Korea | 1-1 10.3% (top); 1-2 8.7% (selected); 2-1 8.1%; 2-2 6.9%; 0-1 6.4% | South Africa 1-2 South Korea | Top was 1-1 at 10.3%, but 1-2 stayed inside the near-equal band at 8.7% and had more total goals; South Korea is stronger by ranking/Elo inputs; South Korea has the better recent-form profile. | Yes |
| Group A: South Africa vs Czechia | 1-2 9.5% (top); 1-1 9.5%; 2-2 6.7% (selected); 0-2 6.7%; 2-1 6.7% | South Africa 2-2 Czechia | Top was 1-2 at 9.5%, but 2-2 stayed inside the near-equal band at 6.7% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group A: South Korea vs Czechia | 1-2 9.1% (top); 1-1 9.0%; 2-2 7.0% (selected); 2-1 6.9%; 1-3 6.1% | South Korea 2-2 Czechia | Top was 1-2 at 9.1%, but 2-2 stayed inside the near-equal band at 7.0% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group B: Canada vs Switzerland | 1-1 13.2% (top, selected); 0-1 11.4%; 1-0 10.5%; 0-0 9.1%; 1-2 8.2% | Canada 1-1 Switzerland | Probability leader remained the pick at 13.2%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group B: Canada vs Qatar | 1-0 16.1% (top); 2-0 14.9% (selected); 1-1 9.7%; 3-0 9.0%; 2-1 9.0% | Canada 2-0 Qatar | Top was 1-0 at 16.1%, but 2-0 stayed inside the near-equal band at 14.9% and had more total goals; Canada is stronger by ranking/Elo inputs; Canada has the better recent-form profile. | Yes |
| Group B: Canada vs Bosnia and Herzegovina | 1-1 12.5% (top, selected); 1-0 12.1%; 2-1 9.3%; 2-0 8.9%; 0-1 8.4% | Canada 1-1 Bosnia and Herzegovina | Probability leader remained the pick at 12.5%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group B: Switzerland vs Qatar | 2-0 10.9% (top); 3-0 9.9%; 2-1 9.0%; 3-1 8.1% (selected); 1-0 8.0% | Switzerland 3-1 Qatar | Top was 2-0 at 10.9%, but 3-1 stayed inside the near-equal band at 8.1% and had more total goals; Switzerland is stronger by ranking/Elo inputs; Switzerland has the better recent-form profile. | Yes |
| Group B: Switzerland vs Bosnia and Herzegovina | 2-1 9.4% (top); 1-1 8.6%; 3-1 6.9% (selected); 2-0 6.7%; 2-2 6.6% | Switzerland 3-1 Bosnia and Herzegovina | Top was 2-1 at 9.4%, but 3-1 stayed inside the near-equal band at 6.9% and had more total goals; Switzerland is stronger by ranking/Elo inputs; Switzerland has the better recent-form profile. | Yes |
| Group B: Qatar vs Bosnia and Herzegovina | 1-2 10.0% (top); 0-2 9.4%; 1-1 8.8%; 0-1 8.3%; 1-3 7.4% (selected) | Qatar 1-3 Bosnia and Herzegovina | Top was 1-2 at 10.0%, but 1-3 stayed inside the near-equal band at 7.4% and had more total goals; Bosnia and Herzegovina has the better recent-form profile. | Yes |
| Group C: Brazil vs Morocco | 1-1 10.2% (top); 1-2 10.0% (selected); 0-1 8.7%; 0-2 8.5%; 1-3 6.5% | Brazil 1-2 Morocco | Top was 1-1 at 10.2%, but 1-2 stayed inside the near-equal band at 10.0% and had more total goals; Morocco has the better recent-form profile. | Yes |
| Group C: Brazil vs Haiti | 2-1 9.2% (top); 3-1 7.7% (selected); 1-1 7.3%; 2-0 6.9%; 2-2 6.1% | Brazil 3-1 Haiti | Top was 2-1 at 9.2%, but 3-1 stayed inside the near-equal band at 7.7% and had more total goals; Brazil is stronger by ranking/Elo inputs; Brazil has the better recent-form profile. | Yes |
| Group C: Brazil vs Scotland | 2-1 8.3% (top); 1-1 7.3%; 2-2 7.3%; 1-2 6.4%; 3-1 6.2%; 3-2 5.4% (selected) | Brazil 3-2 Scotland | Top was 2-1 at 8.3%, but 3-2 stayed inside the near-equal band at 5.4% and had more total goals; Brazil is stronger by ranking/Elo inputs; Brazil has the better recent-form profile. | Yes |
| Group C: Morocco vs Haiti | 2-0 13.0% (top, selected); 1-0 11.2%; 3-0 9.9%; 2-1 9.5%; 1-1 8.1% | Morocco 2-0 Haiti | Probability leader remained the pick at 13.0%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group C: Morocco vs Scotland | 2-0 10.4% (top); 2-1 10.1% (selected); 1-0 10.1%; 1-1 9.7%; 3-0 7.1% | Morocco 2-1 Scotland | Top was 2-0 at 10.4%, but 2-1 stayed inside the near-equal band at 10.1% and had more total goals; Morocco is stronger by ranking/Elo inputs; Morocco has the better recent-form profile. | Yes |
| Group C: Haiti vs Scotland | 1-2 9.5% (top); 1-1 9.1%; 0-2 6.7%; 2-2 6.6%; 1-3 6.5% (selected) | Haiti 1-3 Scotland | Top was 1-2 at 9.5%, but 1-3 stayed inside the near-equal band at 6.5% and had more total goals; Scotland is stronger by ranking/Elo inputs; Scotland has the better recent-form profile. | Yes |
| Group D: United States vs Paraguay | 1-1 9.2% (top); 2-1 8.3%; 1-2 8.1%; 2-2 7.3% (selected); 1-0 5.2% | United States 2-2 Paraguay | Top was 1-1 at 9.2%, but 2-2 stayed inside the near-equal band at 7.3% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group D: United States vs Australia | 1-1 8.9% (top); 1-2 8.4%; 2-1 7.8%; 2-2 7.3% (selected); 1-3 5.2% | United States 2-2 Australia | Top was 1-1 at 8.9%, but 2-2 stayed inside the near-equal band at 7.3% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group D: United States vs Turkey | 1-2 7.1% (top); 2-2 6.8%; 1-3 6.4%; 2-3 6.1%; 1-1 5.2%; 3-2 4.3% (selected) | United States 3-2 Turkey | Top was 1-2 at 7.1%, but 3-2 stayed inside the near-equal band at 4.3% and had more total goals; United States is stronger by ranking/Elo inputs. | Yes |
| Group D: Paraguay vs Australia | 1-1 11.9% (top, selected); 1-2 8.8%; 0-1 8.6%; 2-1 8.1%; 1-0 7.9% | Paraguay 1-1 Australia | Clear Markov probability leader; no other scoreline met the near-equal threshold. | No |
| Group D: Paraguay vs Turkey | 1-2 9.2% (top); 1-1 8.5%; 2-2 6.9%; 1-3 6.6% (selected); 2-1 6.4% | Paraguay 1-3 Turkey | Top was 1-2 at 9.2%, but 1-3 stayed inside the near-equal band at 6.6% and had more total goals; Turkey is stronger by ranking/Elo inputs; Turkey has the better recent-form profile. | Yes |
| Group D: Australia vs Turkey | 1-2 8.9% (top); 1-1 8.4%; 2-2 7.1%; 2-1 6.7%; 1-3 6.2% (selected) | Australia 1-3 Turkey | Top was 1-2 at 8.9%, but 1-3 stayed inside the near-equal band at 6.2% and had more total goals; Turkey has the better recent-form profile. | Yes |
| Group E: Germany vs Curacao | 3-1 8.2% (top); 2-1 7.7%; 3-0 6.5%; 4-1 6.5% (selected); 2-0 6.1% | Germany 4-1 Curacao | Top was 3-1 at 8.2%, but 4-1 stayed inside the near-equal band at 6.5% and had more total goals; Germany is stronger by ranking/Elo inputs; Germany has the better recent-form profile. | Yes |
| Group E: Germany vs Ivory Coast | 2-1 9.4% (top); 1-1 8.8%; 3-1 6.7% (selected); 2-2 6.7%; 2-0 6.6% | Germany 3-1 Ivory Coast | Top was 2-1 at 9.4%, but 3-1 stayed inside the near-equal band at 6.7% and had more total goals; Germany is stronger by ranking/Elo inputs; Germany has the better recent-form profile. | Yes |
| Group E: Germany vs Ecuador | 1-1 12.0% (top); 1-0 11.7%; 2-1 9.7% (selected); 2-0 9.5%; 0-1 7.3% | Germany 2-1 Ecuador | Top was 1-1 at 12.0%, but 2-1 stayed inside the near-equal band at 9.7% and had more total goals; Germany is stronger by ranking/Elo inputs; Germany has the better recent-form profile. | Yes |
| Group E: Curacao vs Ivory Coast | 1-2 9.3% (top); 1-1 7.8%; 1-3 7.2% (selected); 0-2 6.6%; 2-2 6.5% | Curacao 1-3 Ivory Coast | Top was 1-2 at 9.3%, but 1-3 stayed inside the near-equal band at 7.2% and had more total goals; Ivory Coast is stronger by ranking/Elo inputs; Ivory Coast has the better recent-form profile. | Yes |
| Group E: Curacao vs Ecuador | 1-1 11.6% (top); 0-1 10.9%; 1-2 9.8% (selected); 0-2 9.2%; 1-0 6.8% | Curacao 1-2 Ecuador | Top was 1-1 at 11.6%, but 1-2 stayed inside the near-equal band at 9.8% and had more total goals; Ecuador is stronger by ranking/Elo inputs; Ecuador has the better recent-form profile. | Yes |
| Group E: Ivory Coast vs Ecuador | 1-1 13.4% (top, selected); 1-0 11.8%; 0-1 11.1%; 0-0 9.8%; 2-1 8.0% | Ivory Coast 1-1 Ecuador | Probability leader remained the pick at 13.4%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group F: Netherlands vs Japan | 1-1 10.8% (top); 2-1 9.2% (selected); 1-2 7.7%; 1-0 7.4%; 2-2 6.6% | Netherlands 2-1 Japan | Top was 1-1 at 10.8%, but 2-1 stayed inside the near-equal band at 9.2% and had more total goals; Netherlands is stronger by ranking/Elo inputs. | Yes |
| Group F: Netherlands vs Tunisia | 2-1 8.6% (top); 3-1 8.4%; 2-0 8.1%; 3-0 7.9%; 4-1 6.1% (selected) | Netherlands 4-1 Tunisia | Top was 2-1 at 8.6%, but 4-1 stayed inside the near-equal band at 6.1% and had more total goals; Netherlands is stronger by ranking/Elo inputs; Netherlands has the better recent-form profile. | Yes |
| Group F: Netherlands vs Sweden | 3-1 8.2% (top); 3-0 7.6%; 2-1 7.1%; 4-1 7.0% (selected); 2-0 6.6% | Netherlands 4-1 Sweden | Top was 3-1 at 8.2%, but 4-1 stayed inside the near-equal band at 7.0% and had more total goals; Netherlands is stronger by ranking/Elo inputs; Netherlands has the better recent-form profile. | Yes |
| Group F: Japan vs Tunisia | 2-1 9.9% (top); 2-0 9.8%; 1-1 8.4%; 1-0 8.3%; 3-1 7.7% (selected) | Japan 3-1 Tunisia | Top was 2-1 at 9.9%, but 3-1 stayed inside the near-equal band at 7.7% and had more total goals; Japan is stronger by ranking/Elo inputs; Japan has the better recent-form profile. | Yes |
| Group F: Japan vs Sweden | 2-1 9.1% (top); 2-0 8.8%; 3-1 8.3% (selected); 3-0 8.1%; 1-1 6.5% | Japan 3-1 Sweden | Top was 2-1 at 9.1%, but 3-1 stayed inside the near-equal band at 8.3% and had more total goals; Japan is stronger by ranking/Elo inputs; Japan has the better recent-form profile. | Yes |
| Group F: Tunisia vs Sweden | 2-1 8.4% (top); 1-1 8.2%; 2-2 7.3%; 1-2 7.2%; 3-1 5.6% (selected) | Tunisia 3-1 Sweden | Top was 2-1 at 8.4%, but 3-1 stayed inside the near-equal band at 5.6% and had more total goals; Tunisia has the better recent-form profile. | Yes |
| Group G: Belgium vs Egypt | 2-1 10.1% (top, selected); 2-0 9.9%; 1-1 9.6%; 1-0 9.4%; 3-1 7.0% | Belgium 2-1 Egypt | Probability leader remained the pick at 10.1%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group G: Belgium vs Iran | 2-1 10.0% (top, selected); 1-1 9.8%; 2-0 8.2%; 1-0 8.1%; 3-1 6.6% | Belgium 2-1 Iran | Probability leader remained the pick at 10.0%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group G: Belgium vs New Zealand | 4-0 10.4% (top); 3-0 10.0%; 5-0 8.6% (selected); 2-0 7.1%; 4-1 6.8% | Belgium 5-0 New Zealand | Top was 4-0 at 10.4%, but 5-0 stayed inside the near-equal band at 8.6% and had more total goals; Belgium is stronger by ranking/Elo inputs; Belgium has the better recent-form profile. | Yes |
| Group G: Egypt vs Iran | 1-1 13.0% (top, selected); 0-1 11.9%; 1-0 9.7%; 0-0 8.8%; 1-2 8.7% | Egypt 1-1 Iran | Probability leader remained the pick at 13.0%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group G: Egypt vs New Zealand | 2-0 13.2% (top, selected); 1-0 11.6%; 3-0 9.8%; 2-1 9.5%; 1-1 8.4% | Egypt 2-0 New Zealand | Probability leader remained the pick at 13.2%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group G: Iran vs New Zealand | 2-0 12.5% (top); 3-0 11.1% (selected); 1-0 9.3%; 2-1 8.7%; 3-1 7.7% | Iran 3-0 New Zealand | Top was 2-0 at 12.5%, but 3-0 stayed inside the near-equal band at 11.1% and had more total goals; Iran is stronger by ranking/Elo inputs; Iran has the better recent-form profile. | Yes |
| Group H: Spain vs Cape Verde | 2-0 9.5% (top); 3-0 9.2%; 2-1 8.6%; 3-1 8.4% (selected); 4-0 6.6% | Spain 3-1 Cape Verde | Top was 2-0 at 9.5%, but 3-1 stayed inside the near-equal band at 8.4% and had more total goals; Spain is stronger by ranking/Elo inputs; Spain has the better recent-form profile. | Yes |
| Group H: Spain vs Saudi Arabia | 3-0 10.3% (top); 2-0 9.5%; 4-0 8.3% (selected); 3-1 8.1%; 2-1 7.5% | Spain 4-0 Saudi Arabia | Top was 3-0 at 10.3%, but 4-0 stayed inside the near-equal band at 8.3% and had more total goals; Spain is stronger by ranking/Elo inputs; Spain has the better recent-form profile. | Yes |
| Group H: Spain vs Uruguay | 2-0 12.0% (top); 1-0 10.8%; 2-1 9.8% (selected); 1-1 8.9%; 3-0 8.8% | Spain 2-1 Uruguay | Top was 2-0 at 12.0%, but 2-1 stayed inside the near-equal band at 9.8% and had more total goals; Spain is stronger by ranking/Elo inputs; Spain has the better recent-form profile. | Yes |
| Group H: Cape Verde vs Saudi Arabia | 1-1 9.2% (top); 2-1 9.1%; 1-2 7.1%; 2-2 7.0% (selected); 3-1 5.9% | Cape Verde 2-2 Saudi Arabia | Top was 1-1 at 9.2%, but 2-2 stayed inside the near-equal band at 7.0% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group H: Cape Verde vs Uruguay | 1-1 11.5% (top); 1-2 9.2% (selected); 0-1 8.5%; 2-1 7.7%; 1-0 7.1% | Cape Verde 1-2 Uruguay | Top was 1-1 at 11.5%, but 1-2 stayed inside the near-equal band at 9.2% and had more total goals; Uruguay is stronger by ranking/Elo inputs. | Yes |
| Group H: Saudi Arabia vs Uruguay | 1-1 11.1% (top); 1-2 9.9% (selected); 0-1 9.4%; 0-2 8.4%; 2-1 6.4% | Saudi Arabia 1-2 Uruguay | Top was 1-1 at 11.1%, but 1-2 stayed inside the near-equal band at 9.9% and had more total goals; Uruguay is stronger by ranking/Elo inputs; Uruguay has the better recent-form profile. | Yes |
| Group I: France vs Senegal | 2-1 9.4% (top); 1-1 9.1%; 2-2 6.8% (selected); 1-2 6.6%; 2-0 6.4% | France 2-2 Senegal | Top was 2-1 at 9.4%, but 2-2 stayed inside the near-equal band at 6.8% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group I: France vs Norway | 1-1 8.8% (top); 2-1 8.1%; 1-2 7.9%; 2-2 7.4% (selected); 3-1 5.0% | France 2-2 Norway | Top was 1-1 at 8.8%, but 2-2 stayed inside the near-equal band at 7.4% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group I: France vs Iraq | 2-0 10.2% (top); 2-1 10.1%; 1-0 9.4%; 1-1 9.3%; 3-0 7.3%; 3-1 7.2% (selected) | France 3-1 Iraq | Top was 2-0 at 10.2%, but 3-1 stayed inside the near-equal band at 7.2% and had more total goals; France is stronger by ranking/Elo inputs; France has the better recent-form profile. | Yes |
| Group I: Senegal vs Norway | 1-2 9.2% (top); 1-1 8.8%; 2-2 6.9%; 2-1 6.6%; 1-3 6.4% (selected) | Senegal 1-3 Norway | Top was 1-2 at 9.2%, but 1-3 stayed inside the near-equal band at 6.4% and had more total goals; Norway has the better recent-form profile. | Yes |
| Group I: Senegal vs Iraq | 1-1 11.2% (top); 2-1 9.9% (selected); 1-0 9.8%; 2-0 8.6%; 1-2 6.3% | Senegal 2-1 Iraq | Top was 1-1 at 11.2%, but 2-1 stayed inside the near-equal band at 9.9% and had more total goals; Senegal is stronger by ranking/Elo inputs; Senegal has the better recent-form profile. | Yes |
| Group I: Norway vs Iraq | 2-1 10.0% (top); 2-0 9.7%; 1-1 9.1%; 1-0 8.8%; 3-1 7.3% (selected) | Norway 3-1 Iraq | Top was 2-1 at 10.0%, but 3-1 stayed inside the near-equal band at 7.3% and had more total goals; Norway is stronger by ranking/Elo inputs; Norway has the better recent-form profile. | Yes |
| Group J: Argentina vs Algeria | 1-0 14.6% (top); 1-1 12.7% (selected); 2-0 10.3%; 0-0 10.2%; 2-1 8.9% | Argentina 1-1 Algeria | Top was 1-0 at 14.6%, but 1-1 stayed inside the near-equal band at 12.7% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group J: Argentina vs Austria | 1-1 13.0% (top, selected); 1-0 12.0%; 0-1 9.5%; 0-0 8.8%; 2-1 8.8% | Argentina 1-1 Austria | Probability leader remained the pick at 13.0%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group J: Argentina vs Jordan | 3-0 10.2% (top); 2-0 10.0%; 3-1 8.2% (selected); 2-1 8.1%; 4-0 7.6% | Argentina 3-1 Jordan | Top was 3-0 at 10.2%, but 3-1 stayed inside the near-equal band at 8.2% and had more total goals; Argentina is stronger by ranking/Elo inputs; Argentina has the better recent-form profile. | Yes |
| Group J: Algeria vs Austria | 1-1 12.9% (top, selected); 0-1 12.0%; 1-0 9.2%; 1-2 8.9%; 0-0 8.6% | Algeria 1-1 Austria | Probability leader remained the pick at 12.9%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group J: Algeria vs Jordan | 2-1 9.8% (top); 2-0 9.4%; 1-1 8.2%; 1-0 7.8%; 3-1 7.8% (selected) | Algeria 3-1 Jordan | Top was 2-1 at 9.8%, but 3-1 stayed inside the near-equal band at 7.8% and had more total goals; Algeria is stronger by ranking/Elo inputs; Algeria has the better recent-form profile. | Yes |
| Group J: Austria vs Jordan | 2-1 8.5% (top); 2-0 8.5%; 3-1 8.4%; 3-0 8.4%; 4-1 6.2% (selected) | Austria 4-1 Jordan | Top was 2-1 at 8.5%, but 4-1 stayed inside the near-equal band at 6.2% and had more total goals; Austria is stronger by ranking/Elo inputs; Austria has the better recent-form profile. | Yes |
| Group K: Portugal vs Uzbekistan | 1-1 9.8% (top); 2-1 9.8% (selected); 1-0 7.7%; 2-0 7.7%; 3-1 6.5% | Portugal 2-1 Uzbekistan | Top was 1-1 at 9.8%, but 2-1 stayed inside the near-equal band at 9.8% and had more total goals; Portugal is stronger by ranking/Elo inputs; Portugal has the better recent-form profile. | Yes |
| Group K: Portugal vs Colombia | 2-1 7.7% (top); 2-2 7.4%; 1-1 6.8%; 1-2 6.6%; 3-1 5.6%; 3-2 5.5% (selected) | Portugal 3-2 Colombia | Top was 2-1 at 7.7%, but 3-2 stayed inside the near-equal band at 5.5% and had more total goals; Portugal is stronger by ranking/Elo inputs; Portugal has the better recent-form profile. | Yes |
| Group K: Portugal vs DR Congo | 1-1 12.9% (top, selected); 1-0 11.1%; 0-1 9.5%; 2-1 8.7%; 0-0 8.1% | Portugal 1-1 DR Congo | Probability leader remained the pick at 12.9%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group K: Uzbekistan vs Colombia | 1-1 10.2% (top); 1-2 9.6% (selected); 0-1 7.5%; 0-2 7.0%; 2-1 6.9% | Uzbekistan 1-2 Colombia | Top was 1-1 at 10.2%, but 1-2 stayed inside the near-equal band at 9.6% and had more total goals; Colombia is stronger by ranking/Elo inputs; Colombia has the better recent-form profile. | Yes |
| Group K: Uzbekistan vs DR Congo | 0-1 16.1% (top); 0-0 14.3%; 1-1 13.4% (selected); 1-0 11.9%; 0-2 8.9% | Uzbekistan 1-1 DR Congo | Top was 0-1 at 16.1%, but 1-1 stayed inside the near-equal band at 13.4% and had more total goals; the draw is the safer fallback after the total-goals check. | Yes |
| Group K: Colombia vs DR Congo | 1-1 13.0% (top, selected); 1-0 10.3%; 0-1 10.2%; 2-1 8.2%; 0-0 8.1% | Colombia 1-1 DR Congo | Probability leader remained the pick at 13.0%; near-equal alternatives were not higher-scoring enough to move the estimate. | No |
| Group L: England vs Croatia | 1-1 9.9% (top); 2-1 9.8% (selected); 1-0 7.6%; 2-0 7.5%; 3-1 6.4% | England 2-1 Croatia | Top was 1-1 at 9.9%, but 2-1 stayed inside the near-equal band at 9.8% and had more total goals; England is stronger by ranking/Elo inputs; England has the better recent-form profile. | Yes |
| Group L: England vs Ghana | 2-0 11.3% (top); 3-0 10.7% (selected); 2-1 8.5%; 3-1 8.1%; 1-0 7.8% | England 3-0 Ghana | Top was 2-0 at 11.3%, but 3-0 stayed inside the near-equal band at 10.7% and had more total goals; England is stronger by ranking/Elo inputs; England has the better recent-form profile. | Yes |
| Group L: England vs Panama | 2-1 9.1% (top); 2-0 8.5%; 3-1 8.3% (selected); 3-0 7.7%; 1-1 6.6% | England 3-1 Panama | Top was 2-1 at 9.1%, but 3-1 stayed inside the near-equal band at 8.3% and had more total goals; England is stronger by ranking/Elo inputs; England has the better recent-form profile. | Yes |
| Group L: Croatia vs Ghana | 2-1 9.1% (top); 3-1 8.3% (selected); 2-0 8.2%; 3-0 7.5%; 1-1 6.5% | Croatia 3-1 Ghana | Top was 2-1 at 9.1%, but 3-1 stayed inside the near-equal band at 8.3% and had more total goals; Croatia is stronger by ranking/Elo inputs; Croatia has the better recent-form profile. | Yes |
| Group L: Croatia vs Panama | 2-1 8.3% (top); 3-1 7.3%; 2-2 6.5%; 1-1 6.3%; 3-2 5.7% (selected) | Croatia 3-2 Panama | Top was 2-1 at 8.3%, but 3-2 stayed inside the near-equal band at 5.7% and had more total goals; Croatia is stronger by ranking/Elo inputs; Croatia has the better recent-form profile. | Yes |
| Group L: Ghana vs Panama | 1-2 9.0% (top); 1-1 7.9%; 2-2 6.9%; 1-3 6.8% (selected); 2-1 6.0% | Ghana 1-3 Panama | Top was 1-2 at 9.0%, but 1-3 stayed inside the near-equal band at 6.8% and had more total goals; Panama is stronger by ranking/Elo inputs; Panama has the better recent-form profile. | Yes |

