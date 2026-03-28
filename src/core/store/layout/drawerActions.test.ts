import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { STAGING_ID, CONSTRAINTS } from '@/core/constants';
import { resetAllStores, createTestBin } from '@/test/testUtils';

describe('drawerActions', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('updateDrawer', () => {
    it('updates drawer width', () => {
      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ width: 5 });
      expect(useLayoutStore.getState().layout.drawer.width).toBe(5);
    });

    it('updates drawer depth', () => {
      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ depth: 6 });
      expect(useLayoutStore.getState().layout.drawer.depth).toBe(6);
    });

    it('clamps width to min', () => {
      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ width: 0 });
      expect(useLayoutStore.getState().layout.drawer.width).toBe(CONSTRAINTS.GRID_MIN);
    });

    it('clamps width to max', () => {
      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ width: 999 });
      expect(useLayoutStore.getState().layout.drawer.width).toBe(CONSTRAINTS.GRID_MAX);
    });

    it('clamps depth to min', () => {
      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ depth: -1 });
      expect(useLayoutStore.getState().layout.drawer.depth).toBe(CONSTRAINTS.GRID_MIN);
    });

    it('updates drawer height, clamped to at least total layer height', () => {
      const { updateDrawer } = useLayoutStore.getState();
      // Default layout has 1 layer with height 3
      updateDrawer({ height: 1 });
      const h = useLayoutStore.getState().layout.drawer.height;
      // Should be at least the total layer height (3)
      expect(h).toBeGreaterThanOrEqual(3);
    });

    it('moves out-of-bounds bins to staging when shrinking', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      const cid = layout.categories[0].id;

      // Place bin at (8, 0) — valid in 10-wide drawer
      addBin({
        layerId: lid,
        x: 8,
        y: 0,
        width: 2,
        depth: 1,
        height: 3,
        category: cid,
        label: '',
        notes: '',
      });
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(lid);

      // Shrink drawer to 5 wide — bin at x=8 is now out of bounds
      updateDrawer({ width: 5 });
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].layerId).toBe(STAGING_ID);
    });

    it('does not move bins already in staging', () => {
      // Manually set a bin in staging
      useLayoutStore.setState((state) => ({
        layout: {
          ...state.layout,
          bins: [createTestBin({ layerId: STAGING_ID, x: 99, y: 99 })],
        },
      }));

      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ width: 3 });
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins[0].layerId).toBe(STAGING_ID);
    });

    it('keeps in-bounds bins on their layer after shrink', () => {
      const { addBin, updateDrawer, layout } = useLayoutStore.getState();
      const lid = layout.layers[0].id;
      const cid = layout.categories[0].id;

      addBin({
        layerId: lid,
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: cid,
        label: '',
        notes: '',
      });
      updateDrawer({ width: 5 });
      expect(useLayoutStore.getState().layout.bins[0].layerId).toBe(lid);
    });

    it('updates fractionalEdgeX', () => {
      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ fractionalEdgeX: 'start' });
      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeX).toBe('start');
    });

    it('updates fractionalEdgeY', () => {
      const { updateDrawer } = useLayoutStore.getState();
      updateDrawer({ fractionalEdgeY: 'end' });
      expect(useLayoutStore.getState().layout.drawer.fractionalEdgeY).toBe('end');
    });
  });
});
