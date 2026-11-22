import { TOMBSTONE_RETENTION_MS } from '../../../api/lib/userIndex.js';
import { pMap } from './concurrency.js';
import { expectedEnvelopeDelta } from './delta.js';
import { isMalformedRow, itemKey } from './inventory.js';
import { KIND_SPECS } from './kinds.js';
import { createProgress, type Progress } from './progress.js';
import { reverify } from './reverify.js';
import type Redis from 'ioredis';
import type { Finding, Inventory, Kind } from './types.js';

interface AnalyzeOpts {
  fetchPayloads: boolean;
  staleTombstoneMs?: number;
  /** Per-fetch deadline in ms. Default 15s. */
  fetchTimeoutMs?: number;
  /**
   * Re-read each flagged item to separate real corruption from writes that
   * landed mid-scan. Requires a redis handle; skipped when absent.
   */
  reverifyWith?: Redis;
  progress?: Progress;
}

export interface AnalyzeResult {
  findings: Finding[];
  suppressed: Finding[];
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export async function analyzeWithReverify(
  inv: Inventory,
  opts: AnalyzeOpts
): Promise<AnalyzeResult> {
  const progress = opts.progress ?? createProgress(false);
  const candidates = await analyze(inv, opts);
  if (!opts.reverifyWith || candidates.length === 0) {
    return { findings: candidates, suppressed: [] };
  }
  progress.phase('re-verifying candidates');
  const { confirmed, suppressed } = await reverify(
    opts.reverifyWith,
    inv,
    candidates,
    opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
    (done, total) => progress.update(`${done}/${total}`)
  );
  progress.done(`${confirmed.length} confirmed, ${suppressed.length} in-flight`);
  return { findings: confirmed, suppressed };
}

export async function analyze(
  inv: Inventory,
  opts: AnalyzeOpts = { fetchPayloads: true }
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const staleAge = opts.staleTombstoneMs ?? TOMBSTONE_RETENTION_MS;
  const now = Date.now();

  for (const row of inv.indexRows) {
    if (isMalformedRow(row)) {
      findings.push({
        kind: 'malformed_index_entry',
        uid: row.uid,
        itemKind: row.kind,
        id: row.id,
        severity: 'error',
        detail: `index entry not parseable as { modifiedAt, sizeBytes }`,
      });
      continue;
    }

    const blob = inv.blobMap.get(itemKey(row.uid, row.kind, row.id));

    if (row.tombstone) {
      const age = now - (row.entry.deletedAt ?? row.entry.modifiedAt);
      if (blob) {
        findings.push({
          kind: 'tombstone_with_blob',
          uid: row.uid,
          itemKind: row.kind,
          id: row.id,
          severity: 'error',
          detail: `tombstone has surviving blob (deleted ${Math.round(age / 86400000)}d ago)`,
          data: { blobSize: blob.size, ageMs: age },
        });
      } else if (age > staleAge) {
        findings.push({
          kind: 'stale_tombstone',
          uid: row.uid,
          itemKind: row.kind,
          id: row.id,
          severity: 'info',
          detail: `tombstone older than ${Math.round(staleAge / 86400000)}d`,
          data: { ageMs: age },
        });
      }
      continue;
    }

    if (!blob) {
      findings.push({
        kind: 'missing_blob',
        uid: row.uid,
        itemKind: row.kind,
        id: row.id,
        severity: 'error',
        detail: 'live index entry has no blob',
        data: { sizeBytes: row.entry.sizeBytes, modifiedAt: row.entry.modifiedAt },
      });
      continue;
    }

    const expected = expectedEnvelopeDelta(row.kind, row.entry.modifiedAt);
    const delta = blob.size - row.entry.sizeBytes;
    if (delta < expected) {
      // index > what's stored: user is over-charged. Fix is safe (lowers sizeBytes).
      findings.push({
        kind: 'sanitization_drift',
        uid: row.uid,
        itemKind: row.kind,
        id: row.id,
        severity: 'warn',
        detail: `index sizeBytes over-counts by ${expected - delta}B (quota leak)`,
        data: {
          indexSize: row.entry.sizeBytes,
          blobSize: blob.size,
          drift: delta - expected,
          modifiedAt: row.entry.modifiedAt,
        },
      });
    } else if (delta > expected) {
      // index < what's stored: index under-counts the blob. Suggests the blob
      // was rewritten without a matching index update, or some other atomicity
      // gap. Severity bumped to error since it can hide quota usage.
      findings.push({
        kind: 'index_size_undercount',
        uid: row.uid,
        itemKind: row.kind,
        id: row.id,
        severity: 'error',
        detail: `index sizeBytes under-counts by ${delta - expected}B`,
        data: {
          indexSize: row.entry.sizeBytes,
          blobSize: blob.size,
          drift: delta - expected,
          modifiedAt: row.entry.modifiedAt,
        },
      });
    }
  }

  for (const blob of inv.blobs) {
    const row = inv.indexMap.get(itemKey(blob.uid, blob.kind, blob.id));
    if (!row) {
      findings.push({
        kind: 'orphan_blob',
        uid: blob.uid,
        itemKind: blob.kind,
        id: blob.id,
        severity: 'error',
        detail: 'blob has no index entry',
        data: { blobSize: blob.size },
      });
    }
  }

  if (opts.fetchPayloads) {
    const timeoutMs = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const liveBlobs = inv.blobs.filter((b) => {
      const r = inv.indexMap.get(itemKey(b.uid, b.kind, b.id));
      // Skip rows that are tombstoned or malformed — payload-validation
      // findings would be misleading or use NaN values in the detail line.
      return r && !r.tombstone && !isMalformedRow(r);
    });
    const progress = opts.progress ?? createProgress(false);
    progress.phase('validating payloads');
    let done = 0;
    const payloadFindings = await pMap(liveBlobs, async (blob) => {
      const out = await validateBlob(blob, inv, timeoutMs);
      progress.update(`${++done}/${liveBlobs.length}`);
      return out;
    });
    progress.done(`${liveBlobs.length} blobs`);
    for (const list of payloadFindings) findings.push(...list);
  }

  return findings;
}

async function validateBlob(
  blob: { uid: string; kind: Kind; id: string; url: string; size: number },
  inv: Inventory,
  timeoutMs: number
): Promise<Finding[]> {
  const out: Finding[] = [];
  let body: unknown;
  let fetchedBytes = 0;
  try {
    const r = await fetch(blob.url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      return [
        {
          kind: 'envelope_invalid',
          uid: blob.uid,
          itemKind: blob.kind,
          id: blob.id,
          severity: 'error',
          detail: `HTTP ${r.status} fetching blob`,
        },
      ];
    }
    const text = await r.text();
    fetchedBytes = Buffer.byteLength(text, 'utf8');
    body = JSON.parse(text);
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
    return [
      {
        kind: isTimeout ? 'fetch_timeout' : 'envelope_invalid',
        uid: blob.uid,
        itemKind: blob.kind,
        id: blob.id,
        severity: 'error',
        detail: isTimeout
          ? `blob fetch exceeded ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : String(err),
      },
    ];
  }

  if (!body || typeof body !== 'object') {
    out.push({
      kind: 'envelope_invalid',
      uid: blob.uid,
      itemKind: blob.kind,
      id: blob.id,
      severity: 'error',
      detail: 'envelope not an object',
    });
    return out;
  }
  const env = body as Record<string, unknown>;
  const spec = KIND_SPECS[blob.kind];
  const version = env.schemaVersion;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > spec.schemaVersion
  ) {
    out.push({
      kind: 'envelope_invalid',
      uid: blob.uid,
      itemKind: blob.kind,
      id: blob.id,
      severity: 'error',
      detail: `schemaVersion=${String(version)} (expected 1 to ${spec.schemaVersion})`,
    });
  }
  if (typeof env.modifiedAt !== 'number' || !Number.isFinite(env.modifiedAt)) {
    out.push({
      kind: 'envelope_invalid',
      uid: blob.uid,
      itemKind: blob.kind,
      id: blob.id,
      severity: 'error',
      detail: `modifiedAt=${String(env.modifiedAt)}`,
    });
  } else {
    const row = inv.indexMap.get(itemKey(blob.uid, blob.kind, blob.id));
    if (row && !row.tombstone && row.entry.modifiedAt !== env.modifiedAt) {
      out.push({
        kind: 'modifiedAt_mismatch',
        uid: blob.uid,
        itemKind: blob.kind,
        id: blob.id,
        severity: 'error',
        detail: `envelope=${env.modifiedAt} index=${row.entry.modifiedAt}`,
        data: { envelope: env.modifiedAt, index: row.entry.modifiedAt },
      });
    }
  }

  // The stored envelope stands in for the PUT body: it carries the payload
  // under the same key and the schemaVersion that the write declared.
  const built = spec.buildPut(env[spec.payloadKey], Number(env.modifiedAt), blob.id, env);
  if (!built.ok) {
    out.push({
      kind: 'payload_invalid',
      uid: blob.uid,
      itemKind: blob.kind,
      id: blob.id,
      severity: 'error',
      detail: `${built.reason ?? built.code}: ${built.error}`,
    });
  }

  if (fetchedBytes !== blob.size) {
    out.push({
      kind: 'listing_size_mismatch',
      uid: blob.uid,
      itemKind: blob.kind,
      id: blob.id,
      severity: 'warn',
      detail: `listing reports ${blob.size}B, fetched ${fetchedBytes}B`,
      data: { listingSize: blob.size, fetchedBytes },
    });
  }

  return out;
}
