# train-bin-recommender

Builds `src/features/bin-recommender/model.json` from production ML telemetry stored in Redis. Run manually when the telemetry has accumulated enough new high-quality samples to be worth retraining.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (`brew install uv` / `pipx install uv`)
- Access to the production Vercel env (the script reads from prod Redis)

## Workflow

```bash
# 1. Pull production env (REDIS_URL etc.)
vercel env pull .env --environment=production

# 2. Train (defaults to the tiered namespace)
uv run train.py --redis-url "$(grep ^REDIS_URL= .env | cut -d= -f2-)" \
                --out ../../src/features/bin-recommender/model.json

# 3. Clean up — the .env file contains the prod Redis password
rm .env

# 4. Inspect the JSON diff before committing
git diff src/features/bin-recommender/model.json
```

## Flags

| Flag                   | Default           | Meaning                                                                                                                                             |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--source`             | `label_hash_high` | Per-label namespace to train on. Switch to `label_hash` as an escape hatch if tiered data is too sparse — quality is lower but coverage is broader. |
| `--min-samples`        | `10`              | Drop labels with fewer than this many samples (avoids low-confidence rows).                                                                         |
| `--min-embed-samples`  | `20`              | Same floor for embedding buckets (broader categories, higher floor).                                                                                |
| `--min-drawer-samples` | `50`              | Same floor for the drawer-size prior (broadest fallback).                                                                                           |
| `--out`                | —                 | Output path for `model.json`.                                                                                                                       |

## What the script does NOT do

- **No hashing.** Label hashes in the output match exactly what the server already wrote. Adding hashing here would risk train/serve drift; keep it server-side only.
- **No filtering by date.** All accumulated samples count. The `ml:label_hash_high:*` namespace has a 90-day TTL in Redis, so naturally-old keys drop out.
- **No half-bin sizes.** Sizes containing `.5` are filtered out — the recommender is integer-only by design.

## When to retrain

Per the recommender plan, retrain when:

1. The `ml:label_hash_high:*` keyspace has grown by ≥20% since last training, or
2. Vocabulary version bumps (the model embeds the vocab version it was trained against — a mismatch causes the runtime to short-circuit to `null`).

Otherwise, leave the model in place.
