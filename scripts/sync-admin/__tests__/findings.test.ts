import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyze } from '../lib/findings';
import { expectedEnvelopeDelta } from '../lib/delta';
import type { Inventory, BlobRow, IndexRow } from '../lib/types';
import { itemKey } from '../lib/inventory';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => fetchMock.mockReset());

function makeInventory(blobs: BlobRow[], indexRows: IndexRow[]): Inventory {
  const blobMap = new Map<string, BlobRow>();
  const blobUsers = new Set<string>();
  for (const b of blobs) {
    blobMap.set(itemKey(b.uid, b.kind, b.id), b);
    blobUsers.add(b.uid);
  }
  const indexMap = new Map<string, IndexRow>();
  const redisUsers = new Set<string>();
  for (const r of indexRows) {
    indexMap.set(itemKey(r.uid, r.kind, r.id), r);
    redisUsers.add(r.uid);
  }
  return { blobs, blobMap, indexRows, indexMap, blobUsers, redisUsers };
}

const T = 1_780_000_000_000;
const layoutPayload = {
  drawer: { width: 5, depth: 5, height: 3 },
  gridUnitMm: 42,
  heightUnitMm: 7,
  printBedSize: 256,
  bins: [],
  layers: [{ id: 'l1', name: 'L1', heightUnits: 3 }],
  categories: [{ id: 'c1', name: 'C1', color: '#000000' }],
};

function layoutBlob(uid: string, id: string, modifiedAt = T, payload = layoutPayload): BlobRow {
  const body = JSON.stringify({ layout: payload, modifiedAt, schemaVersion: 1 });
  return {
    uid,
    kind: 'layouts',
    id,
    size: Buffer.byteLength(body),
    url: `https://blob/${uid}/${id}`,
    uploadedAt: new Date(modifiedAt),
  };
}

function layoutEntry(uid: string, id: string, modifiedAt = T, sizeBytes?: number): IndexRow {
  const indexBody = JSON.stringify({ layout: layoutPayload });
  return {
    uid,
    kind: 'layouts',
    id,
    entry: { modifiedAt, sizeBytes: sizeBytes ?? Buffer.byteLength(indexBody) },
    tombstone: false,
  };
}

function tombstoneEntry(uid: string, id: string, deletedAt: number): IndexRow {
  return {
    uid,
    kind: 'layouts',
    id,
    entry: { modifiedAt: deletedAt, sizeBytes: 0, deletedAt },
    tombstone: true,
  };
}

function mockPayload(body: unknown): void {
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(body) });
}

// Mirror the real design envelope + index-size accounting from
// api/sync/designs/[id].ts, including the `tags` sibling. Tags appear with the
// same key+value on both sides, so a consistent pair must produce no drift —
// the regression guard for the tags-are-byte-neutral invariant in delta.ts.
const designParams = { width: 2, depth: 2, height: 6, style: 'standard' };

function designBlob(
  uid: string,
  id: string,
  tags: string[],
  name = 'Bin',
  modifiedAt = T
): BlobRow {
  const body = JSON.stringify({
    design: { name, params: designParams, tags },
    modifiedAt,
    schemaVersion: 1,
  });
  return {
    uid,
    kind: 'designs',
    id,
    size: Buffer.byteLength(body),
    url: `https://blob/${uid}/${id}`,
    uploadedAt: new Date(modifiedAt),
  };
}

function designEntry(
  uid: string,
  id: string,
  tags: string[],
  name = 'Bin',
  modifiedAt = T
): IndexRow {
  const indexBody = JSON.stringify({
    name,
    tags,
    type: 'designer',
    version: 1,
    params: designParams,
  });
  return {
    uid,
    kind: 'designs',
    id,
    entry: { modifiedAt, sizeBytes: Buffer.byteLength(indexBody) },
    tombstone: false,
  };
}

describe('analyze', () => {
  it('clean inventory produces no membership findings', async () => {
    const blob = layoutBlob('u1', 'a');
    const entry = layoutEntry('u1', 'a');
    const findings = await analyze(makeInventory([blob], [entry]), { fetchPayloads: false });
    expect(findings).toEqual([]);
  });

  it('a tagged design with consistent blob/index sizes produces no drift', async () => {
    const tags = ['kitchen', 'screws'];
    const blob = designBlob('u1', 'd1', tags);
    const entry = designEntry('u1', 'd1', tags);
    // Tags cancel in delta = blob.size - index.sizeBytes, so the delta must
    // equal the structural envelope overhead exactly.
    expect(blob.size - entry.entry.sizeBytes).toBe(expectedEnvelopeDelta('designs', T));
    const findings = await analyze(makeInventory([blob], [entry]), { fetchPayloads: false });
    expect(findings).toEqual([]);
  });

  it('an untagged design (tags=[]) is also drift-free', async () => {
    const blob = designBlob('u1', 'd2', []);
    const entry = designEntry('u1', 'd2', []);
    expect(blob.size - entry.entry.sizeBytes).toBe(expectedEnvelopeDelta('designs', T));
    const findings = await analyze(makeInventory([blob], [entry]), { fetchPayloads: false });
    expect(findings).toEqual([]);
  });

  it('flags orphan blob (blob without index entry)', async () => {
    const blob = layoutBlob('u1', 'orphan');
    mockPayload({ layout: layoutPayload, modifiedAt: T, schemaVersion: 1 });
    const findings = await analyze(makeInventory([blob], []));
    expect(findings.find((f) => f.kind === 'orphan_blob')).toBeDefined();
  });

  it('flags missing blob (index entry without blob)', async () => {
    const entry = layoutEntry('u1', 'gone');
    const findings = await analyze(makeInventory([], [entry]));
    expect(findings.find((f) => f.kind === 'missing_blob')).toBeDefined();
  });

  it('flags tombstone with surviving blob exactly once (no duplicate orphan_blob)', async () => {
    const blob = layoutBlob('u1', 'zombie');
    const entry = tombstoneEntry('u1', 'zombie', T);
    const findings = await analyze(makeInventory([blob], [entry]), { fetchPayloads: false });
    expect(findings.filter((f) => f.kind === 'tombstone_with_blob')).toHaveLength(1);
    expect(findings.filter((f) => f.kind === 'orphan_blob')).toHaveLength(0);
  });

  it('flags sanitization drift when index over-counts (delta < expected)', async () => {
    const blob = layoutBlob('u1', 'x');
    const inflated = layoutEntry(
      'u1',
      'x',
      T,
      blob.size - expectedEnvelopeDelta('layouts', T) + 100
    );
    const findings = await analyze(makeInventory([blob], [inflated]), { fetchPayloads: false });
    const drift = findings.find((f) => f.kind === 'sanitization_drift');
    expect(drift).toBeDefined();
    expect((drift?.data as { drift: number }).drift).toBe(-100);
    expect(findings.some((f) => f.kind === 'index_size_undercount')).toBe(false);
  });

  it('flags index_size_undercount when index under-counts (delta > expected)', async () => {
    const blob = layoutBlob('u1', 'x');
    const undercount = layoutEntry(
      'u1',
      'x',
      T,
      blob.size - expectedEnvelopeDelta('layouts', T) - 50
    );
    const findings = await analyze(makeInventory([blob], [undercount]), { fetchPayloads: false });
    const f = findings.find((finding) => finding.kind === 'index_size_undercount');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('error');
    expect((f?.data as { drift: number }).drift).toBe(50);
    expect(findings.some((finding) => finding.kind === 'sanitization_drift')).toBe(false);
  });

  it('skips payload validation for malformed index rows', async () => {
    const blob = layoutBlob('u1', 'mal');
    const malformed: IndexRow = {
      uid: 'u1',
      kind: 'layouts',
      id: 'mal',
      entry: { modifiedAt: NaN, sizeBytes: NaN },
      tombstone: false,
    };
    const findings = await analyze(makeInventory([blob], [malformed]));
    expect(findings.some((f) => f.kind === 'malformed_index_entry')).toBe(true);
    expect(findings.some((f) => f.kind === 'modifiedAt_mismatch')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flags fetch_timeout when fetch exceeds the deadline', async () => {
    const blob = layoutBlob('u1', 'slow');
    const entry = layoutEntry('u1', 'slow');
    fetchMock.mockImplementationOnce(async (_url: string, opts?: { signal?: AbortSignal }) => {
      return new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          const err = new DOMException('timed out', 'TimeoutError');
          reject(err);
        });
      });
    });
    const findings = await analyze(makeInventory([blob], [entry]), {
      fetchPayloads: true,
      fetchTimeoutMs: 5,
    });
    expect(findings.find((f) => f.kind === 'fetch_timeout')).toBeDefined();
  });

  it('flags stale tombstone older than retention', async () => {
    const old = Date.now() - 100 * 86400000;
    const entry = tombstoneEntry('u1', 'old', old);
    const findings = await analyze(makeInventory([], [entry]), { fetchPayloads: false });
    expect(findings.find((f) => f.kind === 'stale_tombstone')).toBeDefined();
  });

  it('does not flag recent tombstone as stale', async () => {
    const recent = Date.now() - 10 * 86400000;
    const entry = tombstoneEntry('u1', 'recent', recent);
    const findings = await analyze(makeInventory([], [entry]), { fetchPayloads: false });
    expect(findings.find((f) => f.kind === 'stale_tombstone')).toBeUndefined();
  });

  it('flags malformed index entries', async () => {
    const malformed: IndexRow = {
      uid: 'u1',
      kind: 'layouts',
      id: 'bad',
      entry: { modifiedAt: NaN, sizeBytes: NaN },
      tombstone: false,
    };
    const findings = await analyze(makeInventory([], [malformed]), { fetchPayloads: false });
    expect(findings.find((f) => f.kind === 'malformed_index_entry')).toBeDefined();
  });

  it('flags modifiedAt mismatch between envelope and index', async () => {
    const blob = layoutBlob('u1', 'mm', T);
    const entry = layoutEntry('u1', 'mm', T + 9999);
    mockPayload({ layout: layoutPayload, modifiedAt: T, schemaVersion: 1 });
    const findings = await analyze(makeInventory([blob], [entry]));
    expect(findings.find((f) => f.kind === 'modifiedAt_mismatch')).toBeDefined();
  });

  it('flags invalid schemaVersion in envelope', async () => {
    const blob = layoutBlob('u1', 'sv');
    const entry = layoutEntry('u1', 'sv');
    mockPayload({ layout: layoutPayload, modifiedAt: T, schemaVersion: 2 });
    const findings = await analyze(makeInventory([blob], [entry]));
    expect(findings.find((f) => f.kind === 'envelope_invalid')).toBeDefined();
  });

  it('flags listing_size_mismatch when fetched bytes diverge from listing.size', async () => {
    const blob = layoutBlob('u1', 'a');
    const entry = layoutEntry('u1', 'a');
    const body = JSON.stringify({ layout: layoutPayload, modifiedAt: T, schemaVersion: 1 });
    const oversized = { ...blob, size: Buffer.byteLength(body) + 50 };
    mockPayload({ layout: layoutPayload, modifiedAt: T, schemaVersion: 1 });
    const findings = await analyze(makeInventory([oversized], [entry]));
    const m = findings.find((f) => f.kind === 'listing_size_mismatch');
    expect(m).toBeDefined();
    expect((m?.data as { listingSize: number }).listingSize).toBe(Buffer.byteLength(body) + 50);
  });

  it('skips payload fetching when fetchPayloads=false', async () => {
    const blob = layoutBlob('u1', 'a');
    const entry = layoutEntry('u1', 'a');
    await analyze(makeInventory([blob], [entry]), { fetchPayloads: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
