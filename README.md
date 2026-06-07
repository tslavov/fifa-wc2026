# FIFA World Cup 2026 Prediction Data Pipeline

Minimal TypeScript pipeline for collecting public FIFA World Cup 2026 prediction inputs, normalizing them, building model-ready features, and generating quarantined prediction artifacts.

The core rule is simple: collected data must come from public reachable sources. Missing values are omitted or warned about, never invented.

## Current Scope

Phase 1 collects only:

- FIFA men's ranking from `https://inside.fifa.com/fifa-world-ranking/men`
- World Football Elo Ratings from `https://www.eloratings.net`
- International match results from `https://github.com/martj42/international_results`
- FIFA World Cup 2026 rules from official FIFA sources

Phase 1 does not collect:

- squad value
- injuries
- xG
- tactical style
- formations
- market value
- coach data

Those need separate real sources before they can be added.

## Project Layout

```text
src/
  collect/        Public-source collectors
  normalize/      Team-name normalization helpers
  features/       Model-input feature builders
  predict/        Quarantined prediction generators
  output/         Model-input orchestration
  schemas.ts      Minimal Zod schemas for current outputs
  validate.ts     Phase 1 output validation

data/
  raw/            Raw source snapshots
  normalized/     Normalized collected data
  model-input/    Source-derived model input features
  predictions/    Prediction outputs only, never future inputs
```

## Install

```bash
npm install
```

## Data Pipeline

Collect public source data:

```bash
npm run collect:all
```

Build model-input features:

```bash
npm run build:model-input
```

Validate Phase 1 outputs:

```bash
npm run validate
```

Typecheck:

```bash
npm run typecheck
```

## Generated Data Outputs

Normalized source-backed data:

- `data/normalized/fifa-rankings.json`
- `data/normalized/elo-ratings.json`
- `data/normalized/results.json`

Model-input features:

- `data/model-input/team-strength.json`
- `data/model-input/recent-form.json`

Raw snapshots:

- `data/raw/fifa-ranking-page.html`
- `data/raw/fifa-ranking-*.json`
- `data/raw/elo-world.tsv`
- `data/raw/elo-teams.tsv`
- `data/raw/international-results.csv`

## Prediction Commands

Deterministic collected-feature ranking:

```bash
npm run predict:groups
```

Poisson Monte Carlo simulation:

```bash
npm run predict:monte-carlo
```

Discrete-time Markov-chain simulation:

```bash
npm run predict:markov
```

Compare deterministic and Monte Carlo position differences:

```bash
npm run compare:predictions
```

Generate a simple all-method standings/differences file:

```bash
npm run compare:all-methods-simple
```

## Prediction Outputs

Prediction artifacts live under `data/predictions/`.

- `group-standings-v1.json`
- `group-stage-monte-carlo-v1.json`
- `group-stage-markov-chain-v1.json`
- `group-position-differences-v1.json`
- `standings-differences-all-methods-v1.json`

These files are prediction outputs, not collected data.

Every prediction or comparison artifact must be treated as no-future-use. Prediction files must not be read by collectors, normalizers, feature builders, model-input builders, or future prediction builders.

## No Future Use Rule

The `data/predictions/` directory is quarantined.

Do not use files in `data/predictions/` as:

- training data
- collected observations
- model input features
- future prediction inputs
- source truth

Prediction scripts should read only source-derived inputs such as:

- `data/model-input/team-strength.json`
- `data/model-input/recent-form.json`
- `data/rules/world-cup-2026-rules.json`
- `fifa-world-cup-2026-groups.md`

## Validation Rules

The validator checks the current Phase 1 outputs for:

- required files
- schema correctness
- no `null` values
- row-level `sourceRefs`
- source-backed country codes where required

Warnings are allowed when public sources are incomplete. Examples include FIFA ranking dates that expose no rows or unscored future rows in the results CSV.

## Modeling Notes

Current prediction methods are intentionally limited to Phase 1 features:

- FIFA rank and points
- Elo rank and rating when available
- last-10-match recent form
- goals for and against
- FIFA group-stage rules

Current models do not use:

- injuries
- squad strength
- xG
- fixtures/venues
- host advantage
- climate
- travel
- fair-play/team-conduct simulation

Those are omitted because they are not currently collected in the Phase 1 model input.

## Source Ethics

- Use public reachable sources only.
- Prefer official FIFA sources for tournament rules.
- Store raw snapshots where practical.
- Do not scrape aggressively.
- Respect source terms and robots.txt.

## Typical Workflow

```bash
npm run collect:all
npm run build:model-input
npm run validate
npm run predict:groups
npm run predict:monte-carlo
npm run predict:markov
npm run compare:all-methods-simple
```

