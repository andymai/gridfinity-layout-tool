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

INT_SIZE_RE = re.compile(r"^\d+x\d+x\d+$")
LAPLACE_ALPHA = 1.0
TOP_N_SIZES = 3
SCHEMA_VERSION = 1


@dataclass(slots=True)
class SizeEntry:
    size: str
    p: float
    n: int


def fetch_hash_map(client: redis.Redis, prefix: str) -> dict[str, dict[str, int]]:
    """Read every `{prefix}{key}` hash into `{key -> {field -> count}}`."""
    out: dict[str, dict[str, int]] = {}
    for raw_key in client.scan_iter(match=f"{prefix}*", count=500):
        key = raw_key.decode() if isinstance(raw_key, bytes) else raw_key
        suffix = key[len(prefix) :]
        fields = client.hgetall(raw_key)
        out[suffix] = {
            (f.decode() if isinstance(f, bytes) else f): int(v)
            for f, v in fields.items()
        }
    return out


def top_sizes(counts: dict[str, int]) -> list[SizeEntry]:
    """Filter to integer sizes, top-N by count, Laplace-smoothed probabilities."""
    filtered = {size: n for size, n in counts.items() if INT_SIZE_RE.match(size)}
    if not filtered:
        return []
    ranked = sorted(filtered.items(), key=lambda kv: kv[1], reverse=True)[:TOP_N_SIZES]
    smoothed_total = sum(n + LAPLACE_ALPHA for _, n in ranked)
    return [
        SizeEntry(size=size, p=(n + LAPLACE_ALPHA) / smoothed_total, n=n)
        for size, n in ranked
    ]


def serialize(entries: list[SizeEntry]) -> list[dict[str, float | int | str]]:
    return [{"size": e.size, "p": round(e.p, 4), "n": e.n} for e in entries]


def build_table(
    raw: dict[str, dict[str, int]], min_samples: int
) -> tuple[dict[str, list[dict]], int]:
    """Apply the min_samples floor and serialize. Returns (table, total_samples)."""
    table: dict[str, list[dict]] = {}
    total = 0
    for key, counts in raw.items():
        sample_n = sum(counts.values())
        if sample_n < min_samples:
            continue
        entries = top_sizes(counts)
        if not entries:
            continue
        table[key] = serialize(entries)
        total += sample_n
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
