"""Build the bin-size recommender's static lookup table from Redis telemetry.

This script reads pre-hashed counters out of Redis and emits a JSON model
that the client bundles. It does **no hashing of its own** — label hashes
in the output match what the server already wrote, so train/serve parity
is guaranteed by construction.

Usage:
    vercel env pull .env --environment=production
    uv run train.py --redis-url "$REDIS_URL" --out ../../src/features/bin-recommender/model.json
    rm .env  # contains the prod Redis password
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

import click
import redis

INT_SIZE_RE = re.compile(r"^[1-9]\d*x[1-9]\d*x[1-9]\d*$")
LAPLACE_ALPHA = 1.0
TOP_N_SIZES = 3
SCHEMA_VERSION = 1
SCAN_PAGE_SIZE = 500


@dataclass(slots=True)
class SizeEntry:
    size: str
    p: float
    n: int


def fetch_hash_map(client: redis.Redis, prefix: str) -> dict[str, dict[str, int]]:
    """Read every `{prefix}{key}` hash into `{key -> {field -> count}}`.

    Uses a pipeline batched by SCAN page to avoid an N+1 round-trip pattern
    against production Redis. A page of keys is gathered from SCAN, then a
    single pipeline issues `HGETALL` for each and reads them back together.
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


def top_sizes(counts: dict[str, int]) -> list[SizeEntry]:
    """Filter to integer sizes, top-N by count, Laplace-smoothed probabilities.

    The smoothing denominator is computed over the **full** filtered
    distribution (`N + α·V`, where V is the number of distinct sizes seen),
    not just over the top-N. Using only the top-N rows would inflate `p` and
    misrepresent the source distribution.
    """
    filtered = {size: n for size, n in counts.items() if INT_SIZE_RE.match(size)}
    if not filtered:
        return []
    total_n = sum(filtered.values())
    vocab_size = len(filtered)
    denom = total_n + LAPLACE_ALPHA * vocab_size
    ranked = sorted(filtered.items(), key=lambda kv: kv[1], reverse=True)[:TOP_N_SIZES]
    return [
        SizeEntry(size=size, p=(n + LAPLACE_ALPHA) / denom, n=n) for size, n in ranked
    ]


def serialize(entries: list[SizeEntry]) -> list[dict[str, float | int | str]]:
    return [{"size": e.size, "p": round(e.p, 4), "n": e.n} for e in entries]


def build_table(
    raw: dict[str, dict[str, int]], min_samples: int
) -> tuple[dict[str, list[dict]], int]:
    """Apply the min_samples floor and serialize. Returns (table, total_samples).

    The floor is applied to the **top entry's own `n`**, matching the runtime's
    threshold check. Filtering by `sum(counts)` instead would emit rows whose
    top size has fewer than `min_samples` and is always rejected at runtime.
    """
    table: dict[str, list[dict]] = {}
    total = 0
    for key, counts in raw.items():
        entries = top_sizes(counts)
        if not entries or entries[0].n < min_samples:
            continue
        table[key] = serialize(entries)
        total += sum(counts.values())
    return table, total


def dominant_vocab_version(client: redis.Redis) -> str:
    """Return the most-written vocab version, or 'unknown'."""
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
    "--source",
    type=click.Choice(["label_hash_high", "label_hash"]),
    default="label_hash_high",
    show_default=True,
    help="Source namespace for the per-label distribution. `label_hash` is the escape hatch when tiered data is too sparse.",
)
@click.option(
    "--min-samples",
    type=int,
    default=10,
    show_default=True,
    help="Minimum sample count per label before it's included in the model.",
)
@click.option(
    "--min-embed-samples",
    type=int,
    default=20,
    show_default=True,
    help="Minimum sample count per embedding bucket.",
)
@click.option(
    "--min-drawer-samples",
    type=int,
    default=50,
    show_default=True,
    help="Minimum sample count per drawer size (fallback prior).",
)
@click.option("--out", type=click.Path(dir_okay=False), required=True, help="Output JSON path.")
def main(
    redis_url: str,
    source: str,
    min_samples: int,
    min_embed_samples: int,
    min_drawer_samples: int,
    out: str,
) -> None:
    client = redis.Redis.from_url(redis_url)
    click.echo(f"Connecting to Redis at {redis_url.split('@')[-1]}…")
    client.ping()

    click.echo(f"Reading ml:{source}:* …")
    by_label_raw = fetch_hash_map(client, f"ml:{source}:")
    click.echo(f"  {len(by_label_raw)} label keys")

    click.echo("Reading ml:embed:* …")
    by_embed_raw = fetch_hash_map(client, "ml:embed:")
    click.echo(f"  {len(by_embed_raw)} bucket keys")

    click.echo("Reading ml:drawer_sizes:* …")
    by_drawer_raw = fetch_hash_map(client, "ml:drawer_sizes:")
    click.echo(f"  {len(by_drawer_raw)} drawer keys")

    by_label_hash, label_samples = build_table(by_label_raw, min_samples)
    by_embed_bucket, _ = build_table(by_embed_raw, min_embed_samples)
    by_drawer, _ = build_table(by_drawer_raw, min_drawer_samples)

    model = {
        "schemaVersion": SCHEMA_VERSION,
        "vocabVersion": dominant_vocab_version(client),
        "source": source,
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sampleCount": label_samples,
        "byLabelHash": by_label_hash,
        "byEmbedBucket": by_embed_bucket,
        "byDrawer": by_drawer,
    }

    with open(out, "w") as f:
        json.dump(model, f, indent=2, sort_keys=True)
        f.write("\n")

    click.echo(
        f"\nWrote {out}: "
        f"{len(by_label_hash)} labels, {len(by_embed_bucket)} buckets, "
        f"{len(by_drawer)} drawer priors, {label_samples} total label samples."
    )


if __name__ == "__main__":
    main(auto_envvar_prefix="BIN_RECO")
    sys.exit(0)
