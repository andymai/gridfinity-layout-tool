import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';
import { reverify, stateFromInventory, stateKey } from '../lib/reverify';
import { itemKey } from '../lib/inventory';
import type { BlobRow, Finding, Inventory, IndexRow } from '../lib/types';

const listMock = vi.fn();
vi.mock('@vercel/blob', () => ({ list: (...a: unknown[]) => listMock(...a) }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  listMock.mockReset();
  fetchMock.mockReset();
});

const UID = 'u1';
const T = 1_780_000_000_000;

function blobRow(id: string, size: number, kind: BlobRow['kind'] = 'layouts'): BlobRow {
  return {
    uid: UID,
    kind,
    id,
    size,
    url: `https://blob.test/users/${UID}/${kind}/${id}.json`,
    uploadedAt: new Date(T),
  };
}

function indexRow(
  id: string,
  sizeBytes: number,
  modifiedAt = T,
  deletedAt?: number,
  kind: IndexRow['kind'] = 'layouts'
): IndexRow {
  return {
    uid: UID,
    kind,
    id,
    entry: { modifiedAt, sizeBytes, ...(deletedAt === undefined ? {} : { deletedAt }) },
    tombstone: deletedAt !== undefined,
  };
}

function inventory(blobs: BlobRow[], rows: IndexRow[], blobsListed = true): Inventory {
  const blobMap = new Map<string, BlobRow>();
  const blobUsers = new Set<string>();
  for (const b of blobs) {
    blobMap.set(itemKey(b.uid, b.kind, b.id), b);
    blobUsers.add(b.uid);
  }
  const indexMap = new Map<string, IndexRow>();
  const redisUsers = new Set<string>();
  for (const r of rows) {
    indexMap.set(itemKey(r.uid, r.kind, r.id), r);
    redisUsers.add(r.uid);
  }
  return {
    blobs,
    blobMap,
    indexRows: rows,
    indexMap,
    blobUsers,
    redisUsers,
    blobsListed,
  };
}

/** Redis stub returning one canned HGET value. */
function redisStub(hget: string | null): Redis {
  return { hget: vi.fn().mockResolvedValue(hget) } as unknown as Redis;
}

function blobPage(rows: { pathname: string; size: number; url?: string }[]): {
  blobs: { pathname: string; size: number; url: string }[];
} {
  return {
    blobs: rows.map((r) => ({
      pathname: r.pathname,
      size: r.size,
      url: r.url ?? `https://blob.test/${r.pathname}`,
    })),
  };
}

const missingBlobFinding: Finding = {
  kind: 'missing_blob',
  uid: UID,
  itemKind: 'layouts',
  id: 'a1',
  severity: 'error',
  detail: 'live index entry has no blob',
  data: { sizeBytes: 100, modifiedAt: T },
};

describe('reverify — in-flight writes', () => {
  it('suppresses a finding whose item changed between the two reads', async () => {
    // Scan saw the index entry at modifiedAt=T with no blob. By re-read time the
    // user has saved again, so modifiedAt moved: the item is being written.
    const inv = inventory([], [indexRow('a1', 100, T)]);
    listMock.mockResolvedValue(blobPage([]));
    const redis = redisStub(JSON.stringify({ modifiedAt: T + 5000, sizeBytes: 140 }));

    const { confirmed, suppressed } = await reverify(redis, inv, [missingBlobFinding], 1000);

    expect(confirmed).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
  });

  it('confirms a finding whose item is byte-identical on re-read', async () => {
    const inv = inventory([], [indexRow('a1', 100, T)]);
    listMock.mockResolvedValue(blobPage([]));
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 100 }));

    const { confirmed, suppressed } = await reverify(redis, inv, [missingBlobFinding], 1000);

    expect(suppressed).toHaveLength(0);
    expect(confirmed).toEqual([missingBlobFinding]);
  });

  it('suppresses missing_blob once the blob has appeared', async () => {
    // Stable index, but the blob landed after the listing — a create that raced.
    const inv = inventory([], [indexRow('a1', 100, T)]);
    listMock.mockResolvedValue(blobPage([{ pathname: `users/${UID}/layouts/a1.json`, size: 132 }]));
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 100 }));

    const { confirmed, suppressed } = await reverify(redis, inv, [missingBlobFinding], 1000);

    expect(confirmed).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
  });

  it('suppresses orphan_blob once the index entry has appeared', async () => {
    const inv = inventory([blobRow('a1', 132)], []);
    listMock.mockResolvedValue(blobPage([{ pathname: `users/${UID}/layouts/a1.json`, size: 132 }]));
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 100 }));

    const finding: Finding = {
      kind: 'orphan_blob',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'blob has no index entry',
    };
    const { confirmed, suppressed } = await reverify(redis, inv, [finding], 1000);

    expect(confirmed).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
  });

  it('confirms a genuine orphan_blob that stays orphaned', async () => {
    const inv = inventory([blobRow('a1', 132)], []);
    listMock.mockResolvedValue(blobPage([{ pathname: `users/${UID}/layouts/a1.json`, size: 132 }]));
    const redis = redisStub(null);

    const finding: Finding = {
      kind: 'orphan_blob',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'blob has no index entry',
    };
    const { confirmed } = await reverify(redis, inv, [finding], 1000);

    expect(confirmed).toEqual([finding]);
  });
});

describe('reverify — kinds that a re-read cannot settle', () => {
  it('keeps malformed_index_entry without re-reading', async () => {
    const inv = inventory([], []);
    const redis = redisStub(null);
    const finding: Finding = {
      kind: 'malformed_index_entry',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'unparseable',
    };

    const { confirmed } = await reverify(redis, inv, [finding], 1000);

    expect(confirmed).toEqual([finding]);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('keeps payload_invalid without re-reading', async () => {
    const inv = inventory([], []);
    const redis = redisStub(null);
    const finding: Finding = {
      kind: 'payload_invalid',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'INVALID: bad',
    };

    const { confirmed } = await reverify(redis, inv, [finding], 1000);

    expect(confirmed).toEqual([finding]);
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe('reverify — payload-dependent kinds', () => {
  const stableInv = (): Inventory => inventory([blobRow('a1', 132)], [indexRow('a1', 100, T)]);

  function stableRead(): void {
    listMock.mockResolvedValue(blobPage([{ pathname: `users/${UID}/layouts/a1.json`, size: 132 }]));
  }

  it('suppresses modifiedAt_mismatch once the envelope agrees with the index', async () => {
    stableRead();
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ modifiedAt: T, schemaVersion: 1 }),
    });
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 100 }));

    const finding: Finding = {
      kind: 'modifiedAt_mismatch',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'envelope=x index=y',
    };
    const { suppressed } = await reverify(redis, stableInv(), [finding], 1000);

    expect(suppressed).toHaveLength(1);
  });

  it('confirms modifiedAt_mismatch that persists', async () => {
    stableRead();
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ modifiedAt: T + 999, schemaVersion: 1 }),
    });
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 100 }));

    const finding: Finding = {
      kind: 'modifiedAt_mismatch',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'envelope=x index=y',
    };
    const { confirmed } = await reverify(redis, stableInv(), [finding], 1000);

    expect(confirmed).toHaveLength(1);
  });

  it('suppresses envelope_invalid when the blob fetches cleanly on retry', async () => {
    // First pass recorded HTTP 404 mid-rewrite; the blob is fine now.
    stableRead();
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ modifiedAt: T, schemaVersion: 1 }),
    });
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 100 }));

    const finding: Finding = {
      kind: 'envelope_invalid',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'HTTP 404 fetching blob',
    };
    const { suppressed } = await reverify(redis, stableInv(), [finding], 1000);

    expect(suppressed).toHaveLength(1);
  });

  it('confirms envelope_invalid when the envelope is still wrong', async () => {
    stableRead();
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ modifiedAt: T, schemaVersion: 99 }),
    });
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 100 }));

    const finding: Finding = {
      kind: 'envelope_invalid',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'error',
      detail: 'schemaVersion=99 (expected 1)',
    };
    const { confirmed } = await reverify(redis, stableInv(), [finding], 1000);

    expect(confirmed).toHaveLength(1);
  });
});

describe('stateKey', () => {
  it('ignores blob fields when the inventory skipped the blob listing', () => {
    const inv = inventory([], [indexRow('a1', 100, T)], false);
    const before = stateFromInventory(inv, UID, 'layouts', 'a1');
    const after = { ...before, blobPresent: true, blobSize: 132, blobUrl: 'https://b' };

    expect(stateKey(before, false)).toBe(stateKey(after, false));
    expect(stateKey(before, true)).not.toBe(stateKey(after, true));
  });

  it('does not suppress a stale_tombstone just because blobs were not listed', async () => {
    const inv = inventory([], [indexRow('a1', 0, T, T, 'layouts')], false);
    listMock.mockResolvedValue(blobPage([{ pathname: `users/${UID}/layouts/a1.json`, size: 132 }]));
    const redis = redisStub(JSON.stringify({ modifiedAt: T, sizeBytes: 0, deletedAt: T }));

    const finding: Finding = {
      kind: 'stale_tombstone',
      uid: UID,
      itemKind: 'layouts',
      id: 'a1',
      severity: 'info',
      detail: 'old',
    };
    const { confirmed } = await reverify(redis, inv, [finding], 1000);

    expect(confirmed).toHaveLength(1);
  });
});
