# FIFA World Cup 2026 Data Collection System

This project collects sourced, normalized data for FIFA World Cup 2026 group-stage prediction models. It does not predict standings yet.

The guiding rule is simple: do not guess. If a value is collected, it must carry source metadata:

- `sourceUrl`
- `sourceName`
- `collectedAt`
- `confidence`: `high`, `medium`, or `low`
- `notes` when the value is estimated, incomplete, derived, or needs verification

## Current Sources

Primary official sources:

- FIFA Regulations for the FIFA World Cup 26: https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
- FIFA rules explainer: https://www.fifa.com/en/articles/groups-how-teams-qualify-tie-breakers
- FIFA match schedule page: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums
- FIFA match schedule PDF: https://digitalhub.fifa.com/m/1be9ce37eb98fcc5/original/FWC26-Match-Schedule_English.pdf
- FIFA team-ranking pages for the Group A sample rankings

The full source index is stored at `data/sources/source-index.json`.

## Encoded Tournament Rules

The rules collector encodes the official FIFA format:

- 48 teams
- 12 groups of 4
- 3 group matches per team
- Top 2 teams in each group qualify
- 8 best third-place teams qualify
- Round of 32 follows the group stage
- Group ranking starts with points, then FIFA Article 13 tied-team criteria
- Third-place ranking uses points, goal difference, goals scored, team conduct, and FIFA rankings
- Fair-play/team-conduct deductions are captured as sourced values

Output: `data/rules/world-cup-2026-rules.json`

## Data Outputs

Required normalized outputs:

- `data/rules/world-cup-2026-rules.json`
- `data/teams/teams.normalized.json`
- `data/rankings/fifa-rankings.json`
- `data/rankings/elo-ratings.json`
- `data/form/team-form.json`
- `data/squads/squad-quality.json`
- `data/fixtures/group-fixtures.json`
- `data/sources/source-index.json`
- `data/model-input/world-cup-2026-model-input.json`

Additional generated exports:

- `data/world-cup-2026-data-bundle.json`
- `data/teams/teams.normalized.csv`
- `data/rankings/fifa-rankings.csv`
- `data/fixtures/group-fixtures.csv`

## Current Sample Scope

The current concrete sample is Group A only:

- Mexico
- South Africa
- Korea Republic
- Czechia

Collected sample values include:

- Team names and country codes from official FIFA schedule sources
- Group A fixture dates, teams, match numbers, and venues from official FIFA schedule sources
- FIFA ranking ranks for Group A teams from official FIFA ranking team pages

Not yet collected:

- Elo ratings
- Squad lists and market values
- Player minutes, goals, assists
- xG for/xG against
- Injury and suspension data
- Tactical/coaching style tags
- Venue climate, altitude, travel distance, and rest-day calculations

Those files exist as valid empty datasets until allowed sources are configured.

## Commands

Install dependencies:

```bash
npm install
```

Run all collectors:

```bash
npm run collect:all
```

Or run individual collectors:

```bash
npm run collect:rules
npm run collect:fixtures
npm run collect:rankings
npm run collect:elo
npm run collect:squads
npm run collect:form
```

Validate all required outputs:

```bash
npm run validate
```

Typecheck:

```bash
npm run typecheck
```

Export combined JSON and CSV extracts:

```bash
npm run export:json
npm run export:csv
npm run export:model-input
```

The model-input export combines team strength, squad quality, recent form, coaching context, fixture/environment data, and tournament rules into numeric feature objects. Missing or unsourced model features are written as `null` and paired with warnings; this export never imputes values.

## Validation Rules

The validator checks:

- No team without a country code
- Sourced values must include source metadata
- Estimated or incomplete sourced values must include notes
- Tournament rules must be sourced from FIFA domains
- Form and injury source dates warn when older than 30 days
- Squad-quality source dates warn when older than 90 days
- Historical-performance data is allowed to be older

You can make freshness checks deterministic by setting:

```bash
VALIDATION_DATE=2026-06-07 npm run validate
```

## How This Feeds Prediction Models

Later prediction code can join these datasets by `teamId` and `countryCode`.

Useful downstream model inputs:

- Elo/FIFA ranking strength priors
- Attack and defense estimates for Poisson goal models
- xG and recent form for weighted current-strength adjustment
- Squad quality and availability risk for pre-match adjustments
- Fixture venue, rest, travel, climate, and altitude for match environment effects
- Tournament rules for Monte Carlo group advancement and third-place qualification logic
- Group tiebreakers for deterministic simulation resolution

Recommended flow:

1. Validate data.
2. Normalize all team identifiers.
3. Build model feature tables from sourced metrics only.
4. Run Elo/xG/Poisson/Monte Carlo/Markov models.
5. Apply FIFA group and third-place tiebreakers from `world-cup-2026-rules.json`.

## What The LLM Must Never Guess

Never invent these values:

- Rankings, Elo ratings, xG, goals, assists, minutes, injuries, suspensions, market values, squad lists, coach tenure, formations, climate data, altitude, travel distance, or rest days
- Missing country codes or team identities
- Fixture dates, venues, match numbers, or kickoff times
- FIFA tournament rules or tiebreaker order
- Player availability or tactical style tags

If a source is unavailable, leave the field absent or write an empty dataset with notes. The pipeline should make uncertainty visible, not decorative.

## Source Collection Ethics

- Prefer official FIFA pages for tournament rules and schedule facts.
- Use low-volume manual snapshots where possible.
- Do not scrape aggressively.
- Respect robots.txt and source terms.
- Store raw snapshots separately under `src/data/sources/raw/` when practical.

