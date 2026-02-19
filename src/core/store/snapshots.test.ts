import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSnapshotStore } from './snapshots';
import * as SnapshotService from '@/core/storage/SnapshotService';
import { createTestLayout } from '@/test/testUtils';
import type { Snapshot } from '@/core/types';

vi.mock('@/core/storage/SnapshotService');

const mockService = vi.mocked(SnapshotService);

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
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
    ...overrides,
  };
}

describe('useSnapshotStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSnapshotStore.setState({ snapshots: [], isLoading: false });
  });

  describe('loadForLayout', () => {
    it('loads snapshots and sets state', async () => {
      const snapshots = [
        makeSnapshot({ id: 'layout-1-2000', timestamp: 2000 }),
        makeSnapshot({ id: 'layout-1-1000', timestamp: 1000 }),
      ];
      mockService.loadSnapshots.mockResolvedValue(snapshots);

      await useSnapshotStore.getState().loadForLayout('layout-1');

      expect(mockService.loadSnapshots).toHaveBeenCalledWith('layout-1');
      expect(useSnapshotStore.getState().snapshots).toEqual(snapshots);
      expect(useSnapshotStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading during load', async () => {
      let resolvePromise!: (value: Snapshot[]) => void;
      mockService.loadSnapshots.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const loadPromise = useSnapshotStore.getState().loadForLayout('layout-1');

      expect(useSnapshotStore.getState().isLoading).toBe(true);

      resolvePromise([]);
      await loadPromise;

      expect(useSnapshotStore.getState().isLoading).toBe(false);
    });
  });

  describe('addSnapshot', () => {
    it('creates snapshot and reloads list from service', async () => {
      const existing = makeSnapshot({ id: 'layout-1-1000', timestamp: 1000 });
      useSnapshotStore.setState({ snapshots: [existing] });

      const newSnapshot = makeSnapshot({ id: 'layout-1-2000', timestamp: 2000 });
      mockService.createSnapshot.mockResolvedValue(newSnapshot);
      // After create, the store reloads from service to mirror any evictions
      mockService.loadSnapshots.mockResolvedValue([newSnapshot, existing]);

      const layout = createTestLayout();
      await useSnapshotStore.getState().addSnapshot('layout-1', layout);

      const { snapshots } = useSnapshotStore.getState();
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].id).toBe('layout-1-2000'); // newest first
      expect(snapshots[1].id).toBe('layout-1-1000');
    });

    it('passes label to createSnapshot', async () => {
      mockService.createSnapshot.mockResolvedValue(makeSnapshot({ label: 'Before change' }));
      mockService.loadSnapshots.mockResolvedValue([makeSnapshot({ label: 'Before change' })]);

      const layout = createTestLayout();
      await useSnapshotStore.getState().addSnapshot('layout-1', layout, 'Before change');

      expect(mockService.createSnapshot).toHaveBeenCalledWith('layout-1', layout, 'Before change');
    });
  });

  describe('removeSnapshot', () => {
    it('deletes snapshot and removes from list', async () => {
      mockService.deleteSnapshot.mockResolvedValue(undefined);
      useSnapshotStore.setState({
        snapshots: [
          makeSnapshot({ id: 'layout-1-2000', timestamp: 2000 }),
          makeSnapshot({ id: 'layout-1-1000', timestamp: 1000 }),
        ],
      });

      await useSnapshotStore.getState().removeSnapshot('layout-1-1000');

      expect(mockService.deleteSnapshot).toHaveBeenCalledWith('layout-1-1000');
      expect(useSnapshotStore.getState().snapshots).toHaveLength(1);
      expect(useSnapshotStore.getState().snapshots[0].id).toBe('layout-1-2000');
    });
  });

  describe('updateLabel', () => {
    it('updates label in service and local state', async () => {
      mockService.updateSnapshotLabel.mockResolvedValue(undefined);
      useSnapshotStore.setState({
        snapshots: [makeSnapshot({ id: 'layout-1-1000' })],
      });

      await useSnapshotStore.getState().updateLabel('layout-1-1000', 'My Label');

      expect(mockService.updateSnapshotLabel).toHaveBeenCalledWith('layout-1-1000', 'My Label');
      expect(useSnapshotStore.getState().snapshots[0].label).toBe('My Label');
    });
  });
});
