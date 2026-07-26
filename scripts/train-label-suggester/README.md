# train-label-suggester

Builds the label-autocomplete's learned prior — `labelSuggester.model.json` — from
aggregate Redis telemetry. Runs offline, on demand (not in CI), like
[`train-bin-recommender`](../train-bin-recommender/README.md).

## What it produces

A hash-keyed model with two maps:

- **`popularity`**: `labelHash → 0..1` — how common each label is globally
  (from `ml:label_hash:*`), scaled so the most common label is `1.0`.
- **`cooccur`**: `labelHash → { neighborHash → P(label | neighbor) }` —
  row-normalized from the symmetric co-occurrence matrix `ml:cooccur:*`.

Only one-way `simpleHash` values are read; no raw label text exists to read. The
client computes the same hashes from candidate text and the current bin's
neighbor labels, so it only ever looks up hashes it already holds — it never
reverses one.

## Run

```bash
vercel env pull .env --environment=production
uv run train.py --redis-url "$(grep ^REDIS_URL= .env | cut -d= -f2-)" \
    --out ../../src/features/bin-inspector/labelSuggest/labelSuggester.model.json
rm .env  # contains the prod Redis password
```

Then commit the regenerated `labelSuggester.model.json`. The client lazy-loads it
and, once `sampleCount > 0`, blends the prior into ranking (popularity nudges
common labels up; co-occurrence surfaces labels that tend to sit next to the
current bin's neighbors). Until then the committed placeholder (`sampleCount: 0`)
is inert and the autocomplete runs on heuristics alone.

## Tuning

- `--min-label-samples` (default 5): floor before a label enters `popularity`.
- `--min-cooccur-samples` (default 5): floor before a co-occurrence row is kept.
- `--min-growth-pct` (default 0): skip the retrain unless the label OR co-occurrence
  keyspace has grown at least this percent since the committed model (compared via
  the `labelKeyCount`/`cooccurKeyCount` metadata the previous run stored). 0 always
  retrains. The automated workflow passes 20.
- Bounds (`POP_TOP_K`, `COOCCUR_TOP_KEYS`, `COOCCUR_TOP_NEIGHBORS`) cap the file
  size; the committed model must stay under the `Total JS` size-limit budget, so
  raise them only with a local `pnpm run build && pnpm run size:check`.
- Blend weights live client-side in `src/features/bin-inspector/labelSuggest/model.ts`
  (`W_POPULARITY`, `W_COOCCUR`) — deliberately gentle so the prior never overrides
  a literal text match.

## Automated retraining

`.github/workflows/retrain-label-suggester.yml` runs this monthly (06:00 UTC on the
1st) and on manual dispatch. It retrains **only when telemetry grew ≥20%** since the
committed model (`--min-growth-pct 20`; manual dispatch with `force: true` overrides),
then opens a PR with the new `model.json`. It is **never auto-merged** — each model is
reviewed like any other change (the PR's size check + a glance at the diff).

**Required once:** add a `REDIS_URL` repo secret (Settings → Secrets and variables →
Actions) with the production Redis URL — e.g. from `vercel env pull`. It's only exposed
to scheduled / dispatch runs on the default branch, never fork PRs. Rotate it here if
the Redis credential changes.

Cadence rationale: co-occurrence carries a ~90-day TTL (rolling window) while popularity
persists all-time, so co-occurrence freshness — not popularity — drives the cadence. A
vocabulary-version bump is also a good moment to `workflow_dispatch --force`.
