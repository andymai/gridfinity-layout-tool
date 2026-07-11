import { validateShareLayout, isValidationError } from '../../../api/lib/validation.js';
import { validateDesignerShare } from '../../../api/lib/designerValidation.js';
import { validateBaseplateShare } from '../../../api/lib/baseplateValidation.js';
import { TOMBSTONE_RETENTION_MS } from '../../../api/lib/userIndex.js';
import { pMap } from './concurrency.js';
import { expectedEnvelopeDelta } from './delta.js';
import { isMalformedRow, itemKey } from './inventory.js';
import type { Finding, Inventory, Kind } from './types.js';

interface AnalyzeOpts {
  fetchPayloads: boolean;
  staleTombstoneMs?: number;
  /** Per-fetch deadline in ms. Default 15s. */
  fetchTimeoutMs?: number;
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

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
    const payloadFindings = await pMap(liveBlobs, async (blob) => {
      return validateBlob(blob, inv, timeoutMs);
    });
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
  if (env.schemaVersion !== 1) {
    out.push({
      kind: 'envelope_invalid',
      uid: blob.uid,
      itemKind: blob.kind,
      id: blob.id,
      severity: 'error',
      detail: `schemaVersion=${String(env.schemaVersion)} (expected 1)`,
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

  if (blob.kind === 'layouts') {
    const inner = JSON.stringify({ layout: env.layout });
    const v = validateShareLayout(env.layout, Buffer.byteLength(inner, 'utf8'));
    if (isValidationError(v)) {
      out.push({
        kind: 'payload_invalid',
        uid: blob.uid,
        itemKind: blob.kind,
        id: blob.id,
        severity: 'error',
        detail: `${v.error.code}: ${v.error.message}`,
      });
    }
  } else if (blob.kind === 'baseplates') {
    const u = unwrapWrapper(env.baseplate);
    if (!u) {
      out.push({
        kind: 'payload_invalid',
        uid: blob.uid,
        itemKind: blob.kind,
        id: blob.id,
        severity: 'error',
        detail: 'baseplate payload not unwrappable',
      });
    } else {
      const wrapped = { type: 'baseplate' as const, version: 1 as const, params: u.params };
      const inner = JSON.stringify(wrapped);
      const v = validateBaseplateShare(wrapped, Buffer.byteLength(inner, 'utf8'));
      if (!v.valid) {
        out.push({
          kind: 'payload_invalid',
          uid: blob.uid,
          itemKind: blob.kind,
          id: blob.id,
          severity: 'error',
          detail: `${v.error.code}: ${v.error.message}`,
        });
      }
    }
  } else {
    const u = unwrapWrapper(env.design);
    if (!u) {
      out.push({
        kind: 'payload_invalid',
        uid: blob.uid,
        itemKind: blob.kind,
        id: blob.id,
        severity: 'error',
        detail: 'design payload not unwrappable',
      });
    } else {
      const wrapped = { type: 'designer' as const, version: 1 as const, params: u.params };
      const inner = JSON.stringify(wrapped);
      const v = validateDesignerShare(wrapped, Buffer.byteLength(inner, 'utf8'));
      if (!v.valid) {
        out.push({
          kind: 'payload_invalid',
          uid: blob.uid,
          itemKind: blob.kind,
          id: blob.id,
          severity: 'error',
          detail: `${v.error.code}: ${v.error.message}`,
        });
      }
    }
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

function unwrapWrapper(wrapper: unknown): { name: string | null; params: unknown } | null {
  if (wrapper === null || typeof wrapper !== 'object') return null;
  const { name, params } = wrapper as { name?: unknown; params?: unknown };
  if (typeof params === 'object' && params !== null) {
    if (name !== undefined && typeof name !== 'string') return null;
    return { name: (name as string) ?? null, params };
  }
  return { name: null, params: wrapper };
}
