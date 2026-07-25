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
- Bounds (`POP_TOP_K`, `COOCCUR_TOP_KEYS`, `COOCCUR_TOP_NEIGHBORS`) cap the file
  size; raise them in `train.py` if the model is too sparse.
- Blend weights live client-side in `src/features/bin-inspector/labelSuggest/model.ts`
  (`W_POPULARITY`, `W_COOCCUR`) — deliberately gentle so the prior never overrides
  a literal text match.

## Retrain when

- The co-occurrence / label keyspaces have grown materially (≥ ~20%).
- The vocabulary version bumps (hashes are text-based and unaffected, but it's a
  good cadence signal).
