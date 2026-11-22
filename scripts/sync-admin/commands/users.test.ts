import { describe, it, expect } from 'vitest';
import { computeStats } from './users';
import type { BlobRow, IndexRow, Inventory, Kind } from '../lib/types';

const blob = (uid: string, kind: Kind, size: number, day: number): BlobRow => ({
  uid,
  kind,
  id: `${kind}-${size}`,
  size,
  url: '',
  uploadedAt: new Date(Date.UTC(2026, 10, day)),
});

const tomb = (uid: string): IndexRow => ({
  uid,
  kind: 'cutoutItems',
  id: 'gone',
  entry: { modifiedAt: 1, sizeBytes: 0, deletedAt: 2 },
  tombstone: true,
});

function inventory(blobs: BlobRow[], indexRows: IndexRow[]): Inventory {
  return {
    blobs,
    blobMap: new Map(),
    indexRows,
    indexMap: new Map(),
    blobUsers: new Set(blobs.map((b) => b.uid)),
    redisUsers: new Set(indexRows.map((r) => r.uid)),
    blobsListed: true,
  };
}

describe('computeStats', () => {
  it('counts each kind on its own, and sorts users by total bytes', () => {
    const stats = computeStats(
      inventory(
        [
          blob('a', 'designs', 100, 3),
          blob('a', 'cutoutItems', 300, 1),
          blob('a', 'cutoutItems', 200, 2),
          blob('b', 'designVersions', 1000, 5),
        ],
        [tomb('a'), tomb('c')]
      )
    );

    expect(stats.map((s) => s.uid)).toEqual(['b', 'a', 'c']);
    const a = stats[1];
    expect(a.byKind.cutoutItems).toEqual({ count: 2, bytes: 500 });
    expect(a.byKind.designs).toEqual({ count: 1, bytes: 100 });
    expect(a.byKind.designVersions).toEqual({ count: 0, bytes: 0 });
    expect(a.totalBytes).toBe(600);
    expect(a.tombstones).toBe(1);
    expect(a.oldestItem).toBe(Date.UTC(2026, 10, 1));
    expect(stats[0].byKind.designs.count).toBe(0);
  });
});
