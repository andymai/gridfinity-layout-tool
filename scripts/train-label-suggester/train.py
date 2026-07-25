"""Build the label-suggester's static prior from Redis telemetry.

Emits a JSON model the client bundles. Like the bin-size recommender it does
**no hashing of its own** — label hashes in the output are exactly what the
server already wrote, so train/serve parity holds by construction. Only
one-way hashes are read; no raw label text exists anywhere to read.

Two signals:
  * popularity  — how often each label hash appears (from ml:label_hash:*),
                  normalized so the most common label is 1.0.
  * cooccur     — P(label | neighbor label), row-normalized from the symmetric
                  co-occurrence matrix (ml:cooccur:*). The client looks up
                  cooccur[neighborHash][candidateHash] for the current bin's
                  neighbors.

Usage:
    vercel env pull .env --environment=production
    uv run train.py --redis-url "$REDIS_URL" \
        --out ../../src/features/bin-inspector/labelSuggest/labelSuggester.model.json
    rm .env  # contains the prod Redis password
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

import click
import redis

SCHEMA_VERSION = 1
SCAN_PAGE_SIZE = 500

# Bounds keep the committed JSON small and the client lookups cheap.
POP_TOP_K = 2000
MIN_LABEL_SAMPLES = 5
COOCCUR_TOP_KEYS = 2000
COOCCUR_TOP_NEIGHBORS = 12
MIN_COOCCUR_SAMPLES = 5


def fetch_hash_map(client: redis.Redis, prefix: str) -> dict[str, dict[str, int]]:
    """Read every `{prefix}{key}` hash into `{key -> {field -> count}}`.

    Pipelined by SCAN page to avoid an N+1 round-trip against production Redis.
    """
    out: dict[str, dict[str, int]] = {}
    page: list[bytes | str] = []
    for raw_key in client.scan_iter(match=f"{prefix}*", count=SCAN_PAGE_SIZE):
        page.append(raw_key)
        if len(page) >= SCAN_PAGE_SIZE:
            _drain_page(client, prefix, page, out)
    _drain_page(client, prefix, page, out)
    return out


def _drain_page(
    client: redis.Redis,
    prefix: str,
    page: list[bytes | str],
    out: dict[str, dict[str, int]],
) -> None:
    if not page:
        return
    pipe = client.pipeline(transaction=False)
    for key in page:
        pipe.hgetall(key)
    results = pipe.execute()
    for key, fields in zip(page, results):
        decoded_key = key.decode() if isinstance(key, bytes) else key
        suffix = decoded_key[len(prefix) :]
        out[suffix] = {
            (f.decode() if isinstance(f, bytes) else f): int(v)
            for f, v in fields.items()
        }
    page.clear()


def build_popularity(
    raw: dict[str, dict[str, int]], min_samples: int, top_k: int
) -> tuple[dict[str, float], int]:
    """Normalized label popularity (0..1) and the total sample count.

    Each ml:label_hash:{hash} maps size -> count; the label's frequency is the
    sum over sizes. Kept to the top_k most frequent labels above the floor,
    scaled so the most common label is 1.0.
    """
    totals = {h: sum(sizes.values()) for h, sizes in raw.items()}
    totals = {h: n for h, n in totals.items() if n >= min_samples}
    if not totals:
        return {}, 0
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
    max_n = ranked[0][1]
    popularity = {h: round(n / max_n, 4) for h, n in ranked}
    return popularity, sum(totals.values())


def build_cooccur(
    raw: dict[str, dict[str, int]], min_samples: int, top_keys: int, top_neighbors: int
) -> dict[str, dict[str, float]]:
    """Row-normalized co-occurrence: cooccur[hash] = {neighbor -> P(hash | neighbor)}.

    The matrix is symmetric, so a row keyed by the *neighbor* hash yields the
    conditional distribution the client needs. Rows below the sample floor are
    dropped; each kept row holds its top_neighbors entries.
    """
    row_totals = {h: sum(row.values()) for h, row in raw.items()}
    eligible = sorted(
        ((h, n) for h, n in row_totals.items() if n >= min_samples),
        key=lambda kv: kv[1],
        reverse=True,
    )[:top_keys]

    cooccur: dict[str, dict[str, float]] = {}
    for h, total in eligible:
        ranked = sorted(raw[h].items(), key=lambda kv: kv[1], reverse=True)[:top_neighbors]
        cooccur[h] = {n: round(c / total, 4) for n, c in ranked}
    return cooccur


def existing_keyspace_counts(out_path: str) -> tuple[int | None, int | None]:
    """Baseline (labelKeyCount, cooccurKeyCount) from the committed model, if any.

    Used by the growth gate to decide whether a retrain is worth a PR. Absent
    counts (an older or placeholder model) → treat as "always retrain".
    """
    try:
        with open(out_path) as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None, None
    return existing.get("labelKeyCount"), existing.get("cooccurKeyCount")


def dominant_vocab_version(client: redis.Redis) -> str:
    versions = client.hgetall("ml:meta:vocab_versions")
    if not versions:
        return "unknown"
    decoded = {
        (k.decode() if isinstance(k, bytes) else k): int(v) for k, v in versions.items()
    }
    return max(decoded.items(), key=lambda kv: kv[1])[0]


@click.command()
@click.option("--redis-url", envvar="REDIS_URL", required=True, help="Redis connection URL.")
@click.option(
    "--min-label-samples",
    type=int,
    default=MIN_LABEL_SAMPLES,
    show_default=True,
    help="Minimum occurrences before a label enters the popularity prior.",
)
@click.option(
    "--min-cooccur-samples",
    type=int,
    default=MIN_COOCCUR_SAMPLES,
    show_default=True,
    help="Minimum row total before a co-occurrence row is kept.",
)
@click.option(
    "--min-growth-pct",
    type=float,
    default=0.0,
    show_default=True,
    help="Skip the retrain unless the label OR co-occurrence keyspace has grown at "
    "least this percent since the committed model. 0 always retrains.",
)
@click.option("--out", type=click.Path(dir_okay=False), required=True, help="Output JSON path.")
def main(
    redis_url: str,
    min_label_samples: int,
    min_cooccur_samples: int,
    min_growth_pct: float,
    out: str,
) -> None:
    client = redis.Redis.from_url(redis_url)
    click.echo(f"Connecting to Redis at {redis_url.split('@')[-1]}…")
    client.ping()

    click.echo("Reading ml:label_hash:* …")
    label_raw = fetch_hash_map(client, "ml:label_hash:")
    click.echo(f"  {len(label_raw)} label keys")

    click.echo("Reading ml:cooccur:* …")
    cooccur_raw = fetch_hash_map(client, "ml:cooccur:")
    click.echo(f"  {len(cooccur_raw)} co-occurrence keys")

    label_key_count = len(label_raw)
    cooccur_key_count = len(cooccur_raw)

    # Growth gate: skip the retrain (and the PR it would open) unless telemetry
    # has grown materially since the committed model. Co-occurrence is the
    # freshness driver (90-day TTL); popularity accrues all-time.
    if min_growth_pct > 0:
        base_labels, base_cooccur = existing_keyspace_counts(out)
        if base_labels and base_cooccur:
            growth = (
                max(
                    (label_key_count - base_labels) / base_labels,
                    (cooccur_key_count - base_cooccur) / base_cooccur,
                )
                * 100
            )
            if growth < min_growth_pct:
                click.echo(
                    f"\nKeyspace grew {growth:.1f}% "
                    f"(labels {base_labels}→{label_key_count}, "
                    f"cooccur {base_cooccur}→{cooccur_key_count}) — below "
                    f"--min-growth-pct {min_growth_pct}. Not retraining."
                )
                return
            click.echo(f"Keyspace grew {growth:.1f}% — retraining.")
        else:
            click.echo("Committed model has no baseline counts — retraining.")

    popularity, sample_count = build_popularity(label_raw, min_label_samples, POP_TOP_K)
    cooccur = build_cooccur(
        cooccur_raw, min_cooccur_samples, COOCCUR_TOP_KEYS, COOCCUR_TOP_NEIGHBORS
    )

    model = {
        "schemaVersion": SCHEMA_VERSION,
        "vocabVersion": dominant_vocab_version(client),
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sampleCount": sample_count,
        # Full keyspace sizes (pre-trim) — the growth gate's baseline for next run.
        "labelKeyCount": label_key_count,
        "cooccurKeyCount": cooccur_key_count,
        "popularity": popularity,
        "cooccur": cooccur,
    }

    with open(out, "w") as f:
        json.dump(model, f, indent=2, sort_keys=True)
        f.write("\n")

    click.echo(
        f"\nWrote {out}: {len(popularity)} popular labels, "
        f"{len(cooccur)} co-occurrence rows, {sample_count} total label samples."
    )


if __name__ == "__main__":
    main(auto_envvar_prefix="LABEL_SUGGESTER")
    sys.exit(0)
