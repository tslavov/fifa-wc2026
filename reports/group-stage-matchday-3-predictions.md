# Group Stage Matchday 3 Predictions

Generated: 2026-06-27T22:36:08.920Z

## Data Update

- Official Matchday 1-2 finals collected: 48/48.
- Result source: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
- Current standings and team metrics: `data\model\group-performance-metrics-after-matchday-2.json`

## Performance So Far

- Selected/LLM-explained exact-score hits: 3/48 (6.3%).
- Selected/LLM-explained outcome hits: 25/48 (52.1%).
- Markov most-probable exact-score hits: 8/48 (16.7%).
- Markov most-probable outcome hits: 29/48 (60.4%).
- Team-goals hit rate, selected/Markov: 32.3% / 39.6%.
- Monte Carlo after-MD1 top-two coverage against current standings: 91.7%.

## Algorithm Changes

- LLM-only predictions: unchanged. No invented squad, lineup, injury, weather, tactical, xG, or market signal is introduced; LLM remains narrative only.
- Monte Carlo group simulations: small_adjustment. Simulations should start from official Matchday 1-2 standings and use the same capped global goal/quality calibration as Markov.
- Markov-chain score predictions: small_adjustment. The score-selection override is tightened and global goal/quality parameters move only within a small cap.

## Matchday 3 Score Predictions

| Match | Selected | Most probable | W/D/L | xG | Confidence | Note |
| --- | ---: | ---: | --- | ---: | --- | --- |
| C: Scotland vs Brazil | 1-2 | 1-2 (8.5%) | 30.6% / 20.8% / 48.6% | 1.6883-2.1452 | Low | Current points Scotland 3, Brazil 4. Brazil has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| C: Morocco vs Haiti | 2-0 | 2-0 (13.4%) | 71.9% / 17.8% / 10.3% | 2.202-0.7047 | High | Current points Morocco 4, Haiti 0. Morocco has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| B: Switzerland vs Canada | 1-1 | 1-1 (13.4%) | 38.2% / 28.3% / 33.5% | 1.1999-1.1048 | Medium | Current points Switzerland 4, Canada 4. Switzerland has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| B: Bosnia and Herzegovina vs Qatar | 2-1 | 2-1 (10.1%) | 63.6% / 19.8% / 16.6% | 2.1531-1.0146 | Medium | Current points Bosnia and Herzegovina 1, Qatar 1. Bosnia and Herzegovina has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| A: Czechia vs Mexico | 1-1 | 1-1 (12%) | 25.5% / 25.1% / 49.4% | 1.0708-1.5861 | Medium | Current points Czechia 1, Mexico 6. Mexico has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| A: South Africa vs South Korea | 1-1 | 1-1 (10.7%) | 35.8% / 23.7% / 40.5% | 1.5203-1.6287 | Low | Current points South Africa 1, South Korea 3. South Korea has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| E: Curacao vs Ivory Coast | 1-2 | 1-2 (9.5%) | 22.1% / 20% / 57.9% | 1.3489-2.2478 | Medium | Current points Curacao 1, Ivory Coast 3. Ivory Coast has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| E: Ecuador vs Germany | 0-1 | 0-1 (12.4%) | 23.8% / 25.6% / 50.7% | 0.9768-1.5484 | Medium | Current points Ecuador 1, Germany 6. Germany has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| F: Japan vs Sweden | 2-0 | 2-0 (9.3%) | 72.9% / 15.6% / 11.5% | 2.6374-0.9852 | Medium | Current points Japan 4, Sweden 3. Japan has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| F: Tunisia vs Netherlands | 1-2 | 1-2 (8.9%) | 10.9% / 14.6% / 74.5% | 1.0201-2.7875 | Medium | Current points Tunisia 0, Netherlands 4. Netherlands has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| D: Turkey vs United States | 2-1 | 2-1 (7.4%) | 54.4% / 18.7% / 27% | 2.5841-1.8381 | Medium | Current points Turkey 0, United States 6. Turkey has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| D: Paraguay vs Australia | 1-1 | 1-1 (12.2%) | 34.5% / 25.6% / 39.9% | 1.3149-1.4328 | Medium | Current points Paraguay 3, Australia 3. Australia has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| I: Norway vs France | 1-1 | 1-1 (9.3%) | 38.1% / 22.4% / 39.5% | 1.737-1.7711 | Low | Current points Norway 6, France 6. France has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| I: Senegal vs Iraq | 1-1 | 1-1 (11.5%) | 51.3% / 24.2% / 24.5% | 1.687-1.095 | Low | Current points Senegal 0, Iraq 0. Senegal has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| G: Egypt vs Iran | 1-1 | 1-1 (13.2%) | 30.2% / 27.9% / 41.8% | 1.0476-1.2829 | Medium | Current points Egypt 4, Iran 2. Iran has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| G: New Zealand vs Belgium | 0-4 | 0-4 (10.6%) | 2.2% / 5.4% / 92.3% | 0.6293-3.9599 | High | Current points New Zealand 1, Belgium 2. Belgium has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| H: Cape Verde vs Saudi Arabia | 1-1 | 1-1 (9.7%) | 47.5% / 22.4% / 30.1% | 1.8933-1.4786 | Low | Current points Cape Verde 2, Saudi Arabia 1. Cape Verde has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| H: Uruguay vs Spain | 0-2 | 0-2 (12.4%) | 12.7% / 19.2% / 68.1% | 0.7872-2.1079 | Medium | Current points Uruguay 2, Spain 4. Spain has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| L: Panama vs England | 1-2 | 1-2 (9.4%) | 12.5% / 16.1% / 71.5% | 1.0283-2.6066 | Medium | Current points Panama 0, England 4. England has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| L: Croatia vs Ghana | 2-1 | 2-1 (9.3%) | 70.8% / 16.2% / 13% | 2.6119-1.0621 | Medium | Current points Croatia 3, Ghana 4. Croatia has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| J: Algeria vs Austria | 1-1 | 1-1 (13.1%) | 28.7% / 27.6% / 43.8% | 1.0243-1.3331 | Medium | Current points Algeria 3, Austria 3. Austria has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| J: Jordan vs Argentina | 0-2 | 0-2 (10.7%) | 7.1% / 12.4% / 80.6% | 0.7823-2.8834 | High | Current points Jordan 0, Argentina 6. Argentina has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| K: Colombia vs Portugal | 1-2 | 1-2 (7.9%) | 34.2% / 20.7% / 45.1% | 1.8526-2.1312 | Low | Current points Colombia 6, Portugal 4. Portugal has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |
| K: DR Congo vs Uzbekistan | 1-0 | 1-0 (16.6%) | 41.7% / 31.7% / 26.7% | 1.0733-0.7958 | Medium | Current points DR Congo 1, Uzbekistan 0. DR Congo has the strongest outcome bucket; selected score uses the tightened post-MD2 probability-leader rule. |

## Fantasy Expected Points

Scoring rule: 6 points for exact score, 3 for correct outcome if not exact, and +1 for each team goal count guessed correctly.

| Match | selectedMostProbableScore | selectedExpectedPointsScore | expectedPoints | reasonForDifference |
| --- | ---: | ---: | ---: | --- |
| C: Scotland vs Brazil | 1-2 (2.2992 pts) | 1-2 | 2.2992 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| C: Morocco vs Haiti | 2-0 (3.3222 pts) | 2-0 | 3.3222 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| B: Switzerland vs Canada | 1-1 (1.9828 pts) | 1-0 | 2.1961 | Different scoreline: 1-0 has higher probability-weighted fantasy value (2.1961) than the most probable 1-1 (1.9828). |
| B: Bosnia and Herzegovina vs Qatar | 2-1 (2.8515 pts) | 2-1 | 2.8515 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| A: Czechia vs Mexico | 1-1 (1.8091 pts) | 0-1 | 2.4801 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.4801) than the most probable 1-1 (1.8091). |
| A: South Africa vs South Korea | 1-1 (1.686 pts) | 1-2 | 2.0747 | Different scoreline: 1-2 has higher probability-weighted fantasy value (2.0747) than the most probable 1-1 (1.686). |
| E: Curacao vs Ivory Coast | 1-2 (2.6432 pts) | 1-2 | 2.6432 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| E: Ecuador vs Germany | 0-1 (2.5962 pts) | 0-1 | 2.5962 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| F: Japan vs Sweden | 2-0 (3.0892 pts) | 2-0 | 3.0892 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| F: Tunisia vs Netherlands | 1-2 (3.1129 pts) | 1-2 | 3.1129 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| D: Turkey vs United States | 2-1 (2.4008 pts) | 2-1 | 2.4008 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| D: Paraguay vs Australia | 1-1 (1.832 pts) | 0-1 | 2.0808 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.0808) than the most probable 1-1 (1.832). |
| I: Norway vs France | 1-1 (1.5569 pts) | 1-2 | 2.0097 | Different scoreline: 1-2 has higher probability-weighted fantasy value (2.0097) than the most probable 1-1 (1.5569). |
| I: Senegal vs Iraq | 1-1 (1.753 pts) | 1-0 | 2.4947 | Different scoreline: 1-0 has higher probability-weighted fantasy value (2.4947) than the most probable 1-1 (1.753). |
| G: Egypt vs Iran | 1-1 (1.9617 pts) | 0-1 | 2.3344 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.3344) than the most probable 1-1 (1.9617). |
| G: New Zealand vs Belgium | 0-4 (3.8201 pts) | 0-4 | 3.8201 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| H: Cape Verde vs Saudi Arabia | 1-1 (1.5844 pts) | 2-1 | 2.3139 | Different scoreline: 2-1 has higher probability-weighted fantasy value (2.3139) than the most probable 1-1 (1.5844). |
| H: Uruguay vs Spain | 0-2 (3.1407 pts) | 0-2 | 3.1407 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| L: Panama vs England | 1-2 (3.0476 pts) | 1-2 | 3.0476 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| L: Croatia vs Ghana | 2-1 (3.0268 pts) | 2-1 | 3.0268 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| J: Algeria vs Austria | 1-1 (1.942 pts) | 0-1 | 2.4007 | Different scoreline: 0-1 has higher probability-weighted fantasy value (2.4007) than the most probable 1-1 (1.942). |
| J: Jordan vs Argentina | 0-2 (3.4254 pts) | 0-2 | 3.4254 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| K: Colombia vs Portugal | 1-2 (2.1529 pts) | 1-2 | 2.1529 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |
| K: DR Congo vs Uzbekistan | 1-0 (2.5654 pts) | 1-0 | 2.5654 | Same scoreline: the most probable exact score also maximizes expected fantasy points among the top scorelines. |

## Top Scorelines

### C: Scotland vs Brazil

Selected score: 1-2. Most probable: 1-2.

1-2 8.5%, xFP 2.2992; 1-1 7.8%, xFP 1.4235; 2-2 7.3%, xFP 1.3815; 2-1 6.7%, xFP 1.6342; 1-3 6.1%, xFP 2.1493

### C: Morocco vs Haiti

Selected score: 2-0. Most probable: 2-0.

2-0 13.4%, xFP 3.3222; 1-0 12%, xFP 3.2523; 3-0 9.8%, xFP 3.1452; 2-1 9.5%, xFP 3.0642; 1-1 8.5%, xFP 1.3807

### B: Switzerland vs Canada

Selected score: 1-1. Most probable: 1-1.

1-1 13.4%, xFP 1.9828; 1-0 11.9%, xFP 2.1961; 0-1 11%, xFP 2.0011; 0-0 9.8%, xFP 1.7717; 2-1 8%, xFP 1.9736

### B: Bosnia and Herzegovina vs Qatar

Selected score: 2-1. Most probable: 2-1.

2-1 10.1%, xFP 2.8515; 2-0 9.8%, xFP 2.8335; 1-1 9.2%, xFP 1.4908; 1-0 9%, xFP 2.7864; 3-1 7.2%, xFP 2.6904

### A: Czechia vs Mexico

Selected score: 1-1. Most probable: 1-1.

1-1 12%, xFP 1.8091; 0-1 11.1%, xFP 2.4801; 1-2 9.6%, xFP 2.3979; 0-2 8.9%, xFP 2.3472; 1-0 7.5%, xFP 1.5599

### A: South Africa vs South Korea

Selected score: 1-1. Most probable: 1-1.

1-1 10.7%, xFP 1.686; 1-2 8.8%, xFP 2.0747; 2-1 8.2%, xFP 1.8956; 0-1 6.9%, xFP 1.9584; 2-2 6.7%, xFP 1.4308

### E: Curacao vs Ivory Coast

Selected score: 1-2. Most probable: 1-2.

1-2 9.5%, xFP 2.6432; 1-1 8.3%, xFP 1.4381; 1-3 7.1%, xFP 2.5053; 0-2 6.9%, xFP 2.4709; 2-2 6.4%, xFP 1.3012

### E: Ecuador vs Germany

Selected score: 0-1. Most probable: 0-1.

0-1 12.4%, xFP 2.5962; 1-1 12.2%, xFP 1.8341; 0-2 9.6%, xFP 2.4414; 1-2 9.5%, xFP 2.4337; 0-0 7.8%, xFP 1.5863

### F: Japan vs Sweden

Selected score: 2-0. Most probable: 2-0.

2-0 9.3%, xFP 3.0892; 2-1 9.3%, xFP 3.0868; 3-0 8.3%, xFP 3.0287; 3-1 8.2%, xFP 3.026; 1-0 6.9%, xFP 2.9537

### F: Tunisia vs Netherlands

Selected score: 1-2. Most probable: 1-2.

1-2 8.9%, xFP 3.1129; 0-2 8.6%, xFP 3.0923; 1-3 8.4%, xFP 3.0816; 0-3 8.1%, xFP 3.0615; 1-1 6.3%, xFP 1.1665

### D: Turkey vs United States

Selected score: 2-1. Most probable: 2-1.

2-1 7.4%, xFP 2.4008; 2-2 6.9%, xFP 1.2933; 3-1 6.5%, xFP 2.338; 3-2 6%, xFP 2.3033; 1-1 5.7%, xFP 1.2153

### D: Paraguay vs Australia

Selected score: 1-1. Most probable: 1-1.

1-1 12.2%, xFP 1.832; 0-1 9.1%, xFP 2.0808; 1-2 8.8%, xFP 2.0627; 1-0 8.4%, xFP 1.8761; 2-1 8%, xFP 1.8532

### I: Norway vs France

Selected score: 1-1. Most probable: 1-1.

1-1 9.3%, xFP 1.5569; 1-2 8.3%, xFP 2.0097; 2-1 8.1%, xFP 1.9573; 2-2 7.3%, xFP 1.427; 0-1 5.2%, xFP 1.8167

### I: Senegal vs Iraq

Selected score: 1-1. Most probable: 1-1.

1-1 11.5%, xFP 1.753; 1-0 10.4%, xFP 2.4947; 2-1 9.8%, xFP 2.467; 2-0 8.8%, xFP 2.4014; 0-1 6.7%, xFP 1.4878

### G: Egypt vs Iran

Selected score: 1-1. Most probable: 1-1.

1-1 13.2%, xFP 1.9617; 0-1 12.5%, xFP 2.3344; 1-0 10.1%, xFP 1.8554; 0-0 9.6%, xFP 1.7479; 1-2 8.5%, xFP 2.1097

### G: New Zealand vs Belgium

Selected score: 0-4. Most probable: 0-4.

0-4 10.6%, xFP 3.8201; 0-3 10.6%, xFP 3.8192; 0-5 8.4%, xFP 3.712; 0-2 7.9%, xFP 3.6847; 1-4 6.7%, xFP 3.5092

### H: Cape Verde vs Saudi Arabia

Selected score: 1-1. Most probable: 1-1.

1-1 9.7%, xFP 1.5844; 2-1 9.2%, xFP 2.3139; 1-2 7.2%, xFP 1.6562; 2-2 6.9%, xFP 1.402; 1-0 6.4%, xFP 2.1278

### H: Uruguay vs Spain

Selected score: 0-2. Most probable: 0-2.

0-2 12.4%, xFP 3.1407; 0-1 11.6%, xFP 3.0996; 1-2 9.8%, xFP 2.9723; 1-1 9.2%, xFP 1.4694; 0-3 8.7%, xFP 2.9501

### L: Panama vs England

Selected score: 1-2. Most probable: 1-2.

1-2 9.4%, xFP 3.0476; 0-2 9%, xFP 3.0215; 1-3 8.2%, xFP 2.9809; 0-3 7.9%, xFP 2.9563; 1-1 7%, xFP 1.2536

### L: Croatia vs Ghana

Selected score: 2-1. Most probable: 2-1.

2-1 9.3%, xFP 3.0268; 2-0 8.7%, xFP 2.9808; 3-1 8.2%, xFP 2.9612; 3-0 7.6%, xFP 2.9176; 1-1 7%, xFP 1.2558

### J: Algeria vs Austria

Selected score: 1-1. Most probable: 1-1.

1-1 13.1%, xFP 1.942; 0-1 12.6%, xFP 2.4007; 1-0 9.7%, xFP 1.7799; 0-0 9.3%, xFP 1.7241; 1-2 8.7%, xFP 2.1817

### J: Jordan vs Argentina

Selected score: 0-2. Most probable: 0-2.

0-2 10.7%, xFP 3.4254; 0-3 10.4%, xFP 3.4094; 1-2 8.4%, xFP 3.2633; 1-3 8.2%, xFP 3.2494; 0-4 7.5%, xFP 3.259

### K: Colombia vs Portugal

Selected score: 1-2. Most probable: 1-2.

1-2 7.9%, xFP 2.1529; 2-2 7.4%, xFP 1.3889; 1-1 7.3%, xFP 1.3847; 2-1 6.9%, xFP 1.7576; 1-3 5.6%, xFP 2.0059

### K: DR Congo vs Uzbekistan

Selected score: 1-0. Most probable: 1-0.

1-0 16.6%, xFP 2.5654; 0-0 15.3%, xFP 2.1972; 1-1 13.3%, xFP 2.0807; 0-1 12.3%, xFP 1.8677; 2-0 8.9%, xFP 2.1645

## Contamination Controls

- Previous prediction artifacts were used only for evaluation.
- Matchday 3 predictions use official results, current standings/metrics, existing collected team-strength/recent-form inputs, and the documented aggregate adjustment file.
- Injuries, lineups, weather, xG, market odds, squad news, and tactical news are omitted because they are not sourced in this project.

