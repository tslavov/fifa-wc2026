# Group Stage Matchday 3 Predictions

Generated: 2026-06-23T17:28:18.956Z

## Data Update

- Official Matchday 1-2 finals collected: 44/48.
- Result source: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
- Current standings and team metrics: `data\model\group-performance-metrics-after-matchday-2.json`

## Performance So Far

- Selected/LLM-explained exact-score hits: 3/44 (6.8%).
- Selected/LLM-explained outcome hits: 23/44 (52.3%).
- Markov most-probable exact-score hits: 8/44 (18.2%).
- Markov most-probable outcome hits: 28/44 (63.6%).
- Team-goals hit rate, selected/Markov: 33% / 40.9%.
- Monte Carlo after-MD1 top-two coverage against current standings: 87.5%.

## Algorithm Changes

- LLM-only predictions: unchanged. No invented squad, lineup, injury, weather, tactical, xG, or market signal is introduced; LLM remains narrative only.
- Monte Carlo group simulations: small_adjustment. Simulations should start from official Matchday 1-2 standings and use the same capped global goal/quality calibration as Markov.
- Markov-chain score predictions: small_adjustment. The score-selection override is tightened and global goal/quality parameters move only within a small cap.

## Matchday 3 Score Predictions

| Match | Selected | Most probable | W/D/L | xG | Confidence | Note |
| --- | ---: | ---: | --- | ---: | --- | --- |
| C: Scotland vs Brazil | 1-2 | 1-2 (8.5%) | 30.6% / 20.7% / 48.7% | 1.7039-2.1637 | Low | Current points Scotland 3, Brazil 4. Brazil has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| C: Morocco vs Haiti | 2-0 | 2-0 (13.2%) | 72.1% / 17.6% / 10.3% | 2.2224-0.711 | High | Current points Morocco 4, Haiti 0. Morocco has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| B: Switzerland vs Canada | 1-1 | 1-1 (13.3%) | 38.3% / 28.2% / 33.5% | 1.211-1.1145 | Medium | Current points Switzerland 4, Canada 4. Switzerland has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| B: Bosnia and Herzegovina vs Qatar | 2-1 | 2-1 (10.1%) | 63.7% / 19.7% / 16.6% | 2.1716-1.0246 | Medium | Current points Bosnia and Herzegovina 1, Qatar 1. Bosnia and Herzegovina has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| A: Czechia vs Mexico | 1-1 | 1-1 (12%) | 25.5% / 25% / 49.5% | 1.0796-1.5998 | Low | Current points Czechia 1, Mexico 6. Mexico has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| A: South Africa vs South Korea | 1-1 | 1-1 (10.6%) | 35.9% / 23.6% / 40.6% | 1.5341-1.6434 | Low | Current points South Africa 1, South Korea 3. South Korea has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| E: Curacao vs Ivory Coast | 1-2 | 1-2 (9.4%) | 22.1% / 19.9% / 58% | 1.3611-2.2659 | Medium | Current points Curacao 1, Ivory Coast 3. Ivory Coast has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| E: Ecuador vs Germany | 0-1 | 0-1 (12.2%) | 23.8% / 25.4% / 50.8% | 0.986-1.5632 | Medium | Current points Ecuador 1, Germany 6. Germany has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| F: Japan vs Sweden | 2-1 | 2-1 (9.2%) | 73.1% / 15.5% / 11.5% | 2.6592-0.9926 | Medium | Current points Japan 4, Sweden 3. Japan has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| F: Tunisia vs Netherlands | 1-2 | 1-2 (8.9%) | 10.8% / 14.5% / 74.7% | 1.0292-2.8132 | Medium | Current points Tunisia 0, Netherlands 4. Netherlands has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| D: Turkey vs United States | 2-1 | 2-1 (7.3%) | 54.5% / 18.6% / 27% | 2.6085-1.8564 | Medium | Current points Turkey 0, United States 6. Turkey has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| D: Paraguay vs Australia | 1-1 | 1-1 (12.1%) | 34.5% / 25.5% / 40% | 1.3262-1.4446 | Medium | Current points Paraguay 3, Australia 3. Australia has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| I: Norway vs France | 1-1 | 1-1 (9.1%) | 38.2% / 22.3% / 39.6% | 1.7544-1.7869 | Low | Current points Norway 6, France 6. France has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| I: Senegal vs Iraq | 1-1 | 1-1 (11.5%) | 51.4% / 24% / 24.5% | 1.7023-1.1051 | Low | Current points Senegal 0, Iraq 0. Senegal has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| G: Egypt vs Iran | 1-1 | 1-1 (13.2%) | 30.3% / 27.8% / 41.9% | 1.0573-1.2939 | Medium | Current points Egypt 4, Iran 2. Iran has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| G: New Zealand vs Belgium | 0-4 | 0-4 (10.6%) | 2.2% / 5.3% / 92.5% | 0.6353-3.994 | High | Current points New Zealand 1, Belgium 2. Belgium has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| H: Cape Verde vs Saudi Arabia | 1-1 | 1-1 (9.5%) | 47.6% / 22.3% / 30.2% | 1.9103-1.4926 | Low | Current points Cape Verde 2, Saudi Arabia 1. Cape Verde has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| H: Uruguay vs Spain | 0-2 | 0-2 (12.3%) | 12.6% / 19.1% / 68.3% | 0.794-2.1266 | Medium | Current points Uruguay 2, Spain 4. Spain has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| L: Panama vs England | 1-2 | 1-2 (9.3%) | 12.4% / 15.9% / 71.7% | 1.0376-2.6299 | Medium | Current points Panama 0, England 3. England has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| L: Croatia vs Ghana | 2-1 | 2-1 (9.3%) | 71% / 16.1% / 12.9% | 2.6345-1.0712 | Medium | Current points Croatia 0, Ghana 3. Croatia has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| J: Algeria vs Austria | 1-1 | 1-1 (13%) | 28.7% / 27.4% / 43.9% | 1.0337-1.3438 | Medium | Current points Algeria 3, Austria 3. Austria has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| J: Jordan vs Argentina | 0-2 | 0-2 (10.5%) | 7% / 12.2% / 80.7% | 0.7902-2.9098 | High | Current points Jordan 0, Argentina 6. Argentina has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| K: Colombia vs Portugal | 1-2 | 1-2 (7.9%) | 34.3% / 20.6% / 45.1% | 1.8694-2.1495 | Low | Current points Colombia 3, Portugal 1. Portugal has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| K: DR Congo vs Uzbekistan | 1-0 | 1-0 (16.5%) | 41.8% / 31.5% / 26.7% | 1.083-0.8026 | Medium | Current points DR Congo 1, Uzbekistan 0. DR Congo has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |

## Fantasy Expected Points

Scoring rule: 6 points for exact score, 3 for correct outcome if not exact, and +1 for each team goal count guessed correctly.

| Match | selectedMostProbableScore | selectedExpectedPointsScore | expectedPoints | reasonForDifference |
| --- | ---: | ---: | ---: | --- |
| C: Scotland vs Brazil | 1-2 (2.2975 pts) | 1-2 | 2.2975 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| C: Morocco vs Haiti | 2-0 (3.321 pts) | 2-0 | 3.321 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| B: Switzerland vs Canada | 1-1 (1.9759 pts) | 1-0 | 2.1905 | Different scoreline: 1-0 has higher probability-weighted fantasy value (2.1905) than the most probable 1-1 (1.9759). |
| B: Bosnia and Herzegovina vs Qatar | 2-1 (2.8546 pts) | 2-1 | 2.8546 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| A: Czechia vs Mexico | 1-1 (1.8009 pts) | 0-1 | 2.4741 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.4741) than the most probable 1-1 (1.8009). |
| A: South Africa vs South Korea | 1-1 (1.6763 pts) | 1-2 | 2.0756 | Different scoreline: 1-2 has higher probability-weighted fantasy value (2.0756) than the most probable 1-1 (1.6763). |
| E: Curacao vs Ivory Coast | 1-2 (2.6433 pts) | 1-2 | 2.6433 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| E: Ecuador vs Germany | 0-1 (2.5903 pts) | 0-1 | 2.5903 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| F: Japan vs Sweden | 2-1 (3.0896 pts) | 2-1 | 3.0896 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| F: Tunisia vs Netherlands | 1-2 (3.1147 pts) | 1-2 | 3.1147 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| D: Turkey vs United States | 2-1 (2.3969 pts) | 2-1 | 2.3969 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| D: Paraguay vs Australia | 1-1 (1.8229 pts) | 0-1 | 2.0744 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.0744) than the most probable 1-1 (1.8229). |
| I: Norway vs France | 1-1 (1.5453 pts) | 1-2 | 2.0085 | Different scoreline: 1-2 has higher probability-weighted fantasy value (2.0085) than the most probable 1-1 (1.5453). |
| I: Senegal vs Iraq | 1-1 (1.744 pts) | 1-0 | 2.4887 | Different scoreline: 1-0 has higher probability-weighted fantasy value (2.4887) than the most probable 1-1 (1.744). |
| G: Egypt vs Iran | 1-1 (1.9552 pts) | 0-1 | 2.328 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.328) than the most probable 1-1 (1.9552). |
| G: New Zealand vs Belgium | 0-4 (3.8193 pts) | 0-4 | 3.8193 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| H: Cape Verde vs Saudi Arabia | 1-1 (1.5736 pts) | 2-1 | 2.3141 | Different scoreline: 2-1 has higher probability-weighted fantasy value (2.3141) than the most probable 1-1 (1.5736). |
| H: Uruguay vs Spain | 0-2 (3.1406 pts) | 0-2 | 3.1406 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| L: Panama vs England | 1-2 (3.0502 pts) | 1-2 | 3.0502 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| L: Croatia vs Ghana | 2-1 (3.0294 pts) | 2-1 | 3.0294 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| J: Algeria vs Austria | 1-1 (1.9361 pts) | 0-1 | 2.3951 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.3951) than the most probable 1-1 (1.9361). |
| J: Jordan vs Argentina | 0-2 (3.4204 pts) | 0-2 | 3.4204 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| K: Colombia vs Portugal | 1-2 (2.1499 pts) | 1-2 | 2.1499 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| K: DR Congo vs Uzbekistan | 1-0 (2.5623 pts) | 1-0 | 2.5623 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |

## Top Scorelines

### C: Scotland vs Brazil

Selected score: 1-2. Most probable: 1-2.

1-2 8.5%, xFP 2.2975; 1-1 7.7%, xFP 1.4115; 2-2 7.3%, xFP 1.3786; 2-1 6.6%, xFP 1.6315; 1-3 6.1%, xFP 2.1519

### C: Morocco vs Haiti

Selected score: 2-0. Most probable: 2-0.

2-0 13.2%, xFP 3.321; 1-0 11.8%, xFP 3.2459; 3-0 9.8%, xFP 3.1493; 2-1 9.5%, xFP 3.0703; 1-1 8.4%, xFP 1.3718

### B: Switzerland vs Canada

Selected score: 1-1. Most probable: 1-1.

1-1 13.3%, xFP 1.9759; 1-0 11.8%, xFP 2.1905; 0-1 10.9%, xFP 1.995; 0-0 9.6%, xFP 1.7548; 2-1 8.1%, xFP 1.9789

### B: Bosnia and Herzegovina vs Qatar

Selected score: 2-1. Most probable: 2-1.

2-1 10.1%, xFP 2.8546; 2-0 9.7%, xFP 2.8313; 1-1 9.1%, xFP 1.4808; 1-0 8.8%, xFP 2.7797; 3-1 7.3%, xFP 2.6972

### A: Czechia vs Mexico

Selected score: 1-1. Most probable: 1-1.

1-1 12%, xFP 1.8009; 0-1 10.9%, xFP 2.4741; 1-2 9.6%, xFP 2.4036; 0-2 8.8%, xFP 2.3471; 1-0 7.3%, xFP 1.554

### A: South Africa vs South Korea

Selected score: 1-1. Most probable: 1-1.

1-1 10.6%, xFP 1.6763; 1-2 8.8%, xFP 2.0756; 2-1 8.2%, xFP 1.896; 0-1 6.8%, xFP 1.9509; 2-2 6.8%, xFP 1.4316

### E: Curacao vs Ivory Coast

Selected score: 1-2. Most probable: 1-2.

1-2 9.4%, xFP 2.6433; 1-1 8.2%, xFP 1.4271; 1-3 7.2%, xFP 2.5093; 0-2 6.8%, xFP 2.4676; 2-2 6.5%, xFP 1.299

### E: Ecuador vs Germany

Selected score: 0-1. Most probable: 0-1.

0-1 12.2%, xFP 2.5903; 1-1 12.2%, xFP 1.8254; 0-2 9.6%, xFP 2.4421; 1-2 9.6%, xFP 2.4403; 0-0 7.7%, xFP 1.5694

### F: Japan vs Sweden

Selected score: 2-1. Most probable: 2-1.

2-1 9.2%, xFP 3.0896; 2-0 9.2%, xFP 3.0867; 3-1 8.3%, xFP 3.0336; 3-0 8.2%, xFP 3.0307; 1-1 6.8%, xFP 1.2224

### F: Tunisia vs Netherlands

Selected score: 1-2. Most probable: 1-2.

1-2 8.9%, xFP 3.1147; 0-2 8.5%, xFP 3.0888; 1-3 8.4%, xFP 3.0879; 0-3 8%, xFP 3.0625; 1-1 6.2%, xFP 1.1562

### D: Turkey vs United States

Selected score: 2-1. Most probable: 2-1.

2-1 7.3%, xFP 2.3969; 2-2 6.9%, xFP 1.2881; 3-1 6.4%, xFP 2.3383; 3-2 6%, xFP 2.308; 1-1 5.5%, xFP 1.2036

### D: Paraguay vs Australia

Selected score: 1-1. Most probable: 1-1.

1-1 12.1%, xFP 1.8229; 0-1 9%, xFP 2.0744; 1-2 8.8%, xFP 2.0661; 1-0 8.2%, xFP 1.8702; 2-1 8.1%, xFP 1.8558

### I: Norway vs France

Selected score: 1-1. Most probable: 1-1.

1-1 9.1%, xFP 1.5453; 1-2 8.2%, xFP 2.0085; 2-1 8.1%, xFP 1.9563; 2-2 7.3%, xFP 1.4257; 0-1 5.1%, xFP 1.8098

### I: Senegal vs Iraq

Selected score: 1-1. Most probable: 1-1.

1-1 11.5%, xFP 1.744; 1-0 10.2%, xFP 2.4887; 2-1 9.8%, xFP 2.472; 2-0 8.8%, xFP 2.4011; 0-1 6.6%, xFP 1.4812

### G: Egypt vs Iran

Selected score: 1-1. Most probable: 1-1.

1-1 13.2%, xFP 1.9552; 0-1 12.3%, xFP 2.328; 1-0 10%, xFP 1.85; 0-0 9.4%, xFP 1.7315; 1-2 8.6%, xFP 2.1146

### G: New Zealand vs Belgium

Selected score: 0-4. Most probable: 0-4.

0-4 10.6%, xFP 3.8193; 0-3 10.5%, xFP 3.8139; 0-5 8.4%, xFP 3.7156; 0-2 7.7%, xFP 3.6778; 1-4 6.8%, xFP 3.515

### H: Cape Verde vs Saudi Arabia

Selected score: 1-1. Most probable: 1-1.

1-1 9.5%, xFP 1.5736; 2-1 9.2%, xFP 2.3141; 1-2 7.2%, xFP 1.6549; 2-2 6.9%, xFP 1.4012; 1-0 6.3%, xFP 2.1206

### H: Uruguay vs Spain

Selected score: 0-2. Most probable: 0-2.

0-2 12.3%, xFP 3.1406; 0-1 11.4%, xFP 3.0945; 1-2 9.8%, xFP 2.9792; 1-1 9.1%, xFP 1.4603; 0-3 8.7%, xFP 2.9551

### L: Panama vs England

Selected score: 1-2. Most probable: 1-2.

1-2 9.3%, xFP 3.0502; 0-2 8.8%, xFP 3.0182; 1-3 8.2%, xFP 2.9881; 0-3 7.8%, xFP 2.9579; 1-1 6.9%, xFP 1.2439

### L: Croatia vs Ghana

Selected score: 2-1. Most probable: 2-1.

2-1 9.3%, xFP 3.0294; 2-0 8.6%, xFP 2.9784; 3-1 8.2%, xFP 2.9682; 3-0 7.6%, xFP 2.9196; 1-1 6.9%, xFP 1.2457

### J: Algeria vs Austria

Selected score: 1-1. Most probable: 1-1.

1-1 13%, xFP 1.9361; 0-1 12.4%, xFP 2.3951; 1-0 9.5%, xFP 1.7744; 0-0 9.1%, xFP 1.7079; 1-2 8.8%, xFP 2.1874

### J: Jordan vs Argentina

Selected score: 0-2. Most probable: 0-2.

0-2 10.5%, xFP 3.4204; 0-3 10.3%, xFP 3.4093; 1-2 8.4%, xFP 3.2655; 1-3 8.2%, xFP 3.2556; 0-4 7.5%, xFP 3.2629

### K: Colombia vs Portugal

Selected score: 1-2. Most probable: 1-2.

1-2 7.9%, xFP 2.1499; 2-2 7.4%, xFP 1.3864; 1-1 7.2%, xFP 1.3737; 2-1 6.8%, xFP 1.7546; 1-3 5.6%, xFP 2.0069

### K: DR Congo vs Uzbekistan

Selected score: 1-0. Most probable: 1-0.

1-0 16.5%, xFP 2.5623; 0-0 15%, xFP 2.1777; 1-1 13.3%, xFP 2.0765; 0-1 12.2%, xFP 1.8633; 2-0 8.9%, xFP 2.1674

## Contamination Controls

- Previous prediction artifacts were used only for evaluation.
- Matchday 3 predictions use official results, current standings/metrics, existing collected team-strength/recent-form inputs, and the documented aggregate adjustment file.
- Injuries, lineups, weather, xG, market odds, squad news, and tactical news are omitted because they are not sourced in this project.

