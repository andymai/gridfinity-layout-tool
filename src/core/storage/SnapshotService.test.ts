import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSnapshot,
  loadSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  deleteSnapshotsForLayout,
  updateSnapshotLabel,
  MAX_UNLABELED_SNAPSHOTS,
} from './SnapshotService';
import * as indexedDB from './backends/indexedDB';
import { createTestLayout } from '@/test/testUtils';
import type { CompressedSnapshot } from '@/core/types';
import { compressLayout, decompressLayout } from '@/shared/utils';

vi.mock('./backends/indexedDB');

const mockIndexedDB = vi.mocked(indexedDB);

function makeCompressedSnapshot(overrides: Partial<CompressedSnapshot> = {}): CompressedSnapshot {
  const layout = createTestLayout();
  return {
    id: 'layout-1-1000',
    layoutId: 'layout-1',
    timestamp: 1000,
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 0,
      layerCount: 1,
    },
    compressedLayout: compressLayout(layout),
    ...overrides,
  };
}

describe('SnapshotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexedDB.getSnapshotsByLayoutId.mockResolvedValue([]);
    mockIndexedDB.saveSnapshot.mockResolvedValue(undefined);
    mockIndexedDB.deleteSnapshot.mockResolvedValue(undefined);
    mockIndexedDB.deleteSnapshotsByLayoutId.mockResolvedValue(undefined);
    mockIndexedDB.getSnapshot.mockResolvedValue(undefined);
    mockIndexedDB.updateSnapshot.mockResolvedValue(undefined);
  });

  describe('createSnapshot', () => {
    it('creates a snapshot with correct id format', async () => {
      const layout = createTestLayout();
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const snapshot = await createSnapshot('layout-1', layout);

      expect(snapshot.id).toBe(`layout-1-${now}`);
      expect(snapshot.layoutId).toBe('layout-1');
      expect(snapshot.timestamp).toBe(now);
      expect(snapshot.label).toBeUndefined();
      expect(snapshot.preview.binCount).toBe(0);
      expect(snapshot.preview.layerCount).toBe(1);
    });

    it('creates a snapshot with a label', async () => {
      const layout = createTestLayout();

      const snapshot = await createSnapshot('layout-1', layout, 'Before refactor');

      expect(snapshot.label).toBe('Before refactor');
    });

    it('saves compressed data to IndexedDB', async () => {
      const layout = createTestLayout();

      await createSnapshot('layout-1', layout);

      expect(mockIndexedDB.saveSnapshot).toHaveBeenCalledTimes(1);
      const saved = mockIndexedDB.saveSnapshot.mock.calls[0][0];
      expect(saved.compressedLayout).toBeDefined();
      expect(typeof saved.compressedLayout).toBe('string');
      // Verify it can be decompressed back
      const decompressed = decompressLayout(saved.compressedLayout);
      expect(decompressed).not.toBeNull();
      expect(decompressed?.name).toBe(layout.name);
    });

    it('evicts oldest unlabeled snapshots when at max', async () => {
      const existingSnapshots = Array.from({ length: MAX_UNLABELED_SNAPSHOTS }, (_, i) =>
        makeCompressedSnapshot({
          id: `layout-1-${i + 1}`,
          timestamp: i + 1,
        })
      );
      // Sorted newest-first (as getSnapshotsByLayoutId returns)
      mockIndexedDB.getSnapshotsByLayoutId.mockResolvedValue([...existingSnapshots].reverse());

      const layout = createTestLayout();
      await createSnapshot('layout-1', layout);

      // Should delete the oldest unlabeled snapshot
      expect(mockIndexedDB.deleteSnapshot).toHaveBeenCalledWith('layout-1-1');
      // Should save the new one
      expect(mockIndexedDB.saveSnapshot).toHaveBeenCalledTimes(1);
    });

    it('does not evict labeled snapshots', async () => {
      // Create MAX+1 snapshots: oldest is labeled, rest are unlabeled
      // This means MAX unlabeled exist, so adding one more should evict the oldest unlabeled
      const existingSnapshots = Array.from({ length: MAX_UNLABELED_SNAPSHOTS + 1 }, (_, i) =>
        makeCompressedSnapshot({
          id: `layout-1-${i + 1}`,
          timestamp: i + 1,
          label: i === 0 ? 'Important' : undefined, // Oldest has a label
        })
      );
      mockIndexedDB.getSnapshotsByLayoutId.mockResolvedValue([...existingSnapshots].reverse());

      const layout = createTestLayout();
      await createSnapshot('layout-1', layout);

      // Should delete the oldest UNLABELED (id 2), not the labeled one (id 1)
      expect(mockIndexedDB.deleteSnapshot).toHaveBeenCalledWith('layout-1-2');
      expect(mockIndexedDB.deleteSnapshot).not.toHaveBeenCalledWith('layout-1-1');
    });

    it('does not evict when labeled snapshots push count over max', async () => {
      // All labeled — none should be evicted even if over max
      const existingSnapshots = Array.from({ length: MAX_UNLABELED_SNAPSHOTS + 3 }, (_, i) =>
        makeCompressedSnapshot({
          id: `layout-1-${i + 1}`,
          timestamp: i + 1,
          label: `Label ${i}`,
        })
      );
      mockIndexedDB.getSnapshotsByLayoutId.mockResolvedValue([...existingSnapshots].reverse());

      const layout = createTestLayout();
      await createSnapshot('layout-1', layout);

      expect(mockIndexedDB.deleteSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('loadSnapshots', () => {
    it('returns snapshots without compressed data', async () => {
      mockIndexedDB.getSnapshotsByLayoutId.mockResolvedValue([
        makeCompressedSnapshot({ id: 'layout-1-2000', timestamp: 2000 }),
        makeCompressedSnapshot({ id: 'layout-1-1000', timestamp: 1000 }),
      ]);

      const snapshots = await loadSnapshots('layout-1');

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].id).toBe('layout-1-2000');
      expect(snapshots[1].id).toBe('layout-1-1000');
      // Should not include compressedLayout
      expect((snapshots[0] as unknown as CompressedSnapshot).compressedLayout).toBeUndefined();
    });

    it('returns empty array for layout with no snapshots', async () => {
      mockIndexedDB.getSnapshotsByLayoutId.mockResolvedValue([]);

      const snapshots = await loadSnapshots('layout-1');

      expect(snapshots).toEqual([]);
    });
  });

  describe('restoreSnapshot', () => {
    it('decompresses and returns the layout', async () => {
      const layout = createTestLayout({ name: 'Snapshot Layout' });
      mockIndexedDB.getSnapshot.mockResolvedValue(
        makeCompressedSnapshot({
          id: 'layout-1-1000',
          compressedLayout: compressLayout(layout),
        })
      );

      const restored = await restoreSnapshot('layout-1-1000');

      expect(restored).not.toBeNull();
      expect(restored?.name).toBe('Snapshot Layout');
    });

    it('returns null for non-existent snapshot', async () => {
      mockIndexedDB.getSnapshot.mockResolvedValue(undefined);

      const restored = await restoreSnapshot('non-existent');

      expect(restored).toBeNull();
    });
  });

  describe('deleteSnapshot', () => {
    it('delegates to IndexedDB backend', async () => {
      await deleteSnapshot('layout-1-1000');

      expect(mockIndexedDB.deleteSnapshot).toHaveBeenCalledWith('layout-1-1000');
    });
  });

  describe('deleteSnapshotsForLayout', () => {
    it('delegates to IndexedDB backend', async () => {
      await deleteSnapshotsForLayout('layout-1');

      expect(mockIndexedDB.deleteSnapshotsByLayoutId).toHaveBeenCalledWith('layout-1');
    });
  });

  describe('updateSnapshotLabel', () => {
    it('updates the label on an existing snapshot', async () => {
      const existing = makeCompressedSnapshot({ id: 'layout-1-1000' });
      mockIndexedDB.getSnapshot.mockResolvedValue(existing);

      await updateSnapshotLabel('layout-1-1000', 'My Label');

      expect(mockIndexedDB.updateSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'layout-1-1000',
          label: 'My Label',
        })
      );
    });

    it('returns Err(storageNotFound) for non-existent snapshot', async () => {
      mockIndexedDB.getSnapshot.mockResolvedValue(undefined);

      const result = await updateSnapshotLabel('non-existent', 'Label');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_NOT_FOUND');
        expect(result.error.key).toBe('non-existent');
      }
    });
  });
});
