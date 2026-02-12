import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';

describe('cutoutSlice - consolidated actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  const createTestCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
    id: 'test-cutout-1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: 'Test',
    groupId: null,
    ...overrides,
  });

  describe('setCutoutProperty', () => {
    it('locks specified cutouts, others unchanged', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', locked: false }));
      addCutout(createTestCutout({ id: 'cutout-2', locked: false }));
      addCutout(createTestCutout({ id: 'cutout-3', locked: false }));

      setCutoutProperty(['cutout-1', 'cutout-3'], { locked: true });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].locked).toBe(true);
      expect(params.cutouts[1].locked).toBe(false);
      expect(params.cutouts[2].locked).toBe(true);
    });

    it('hides specified cutouts', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));

      setCutoutProperty(['cutout-2'], { hidden: true });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].hidden).toBeUndefined();
      expect(params.cutouts[1].hidden).toBe(true);
    });

    it('no-op on empty ids', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout());
      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      setCutoutProperty([], { locked: true });

      const afterHistoryLength = useDesignerStore.getState().history.past.length;
      expect(afterHistoryLength).toBe(beforeHistoryLength);
    });

    it('pushes history', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      setCutoutProperty(['cutout-1'], { locked: true });

      const afterHistoryLength = useDesignerStore.getState().history.past.length;
      expect(afterHistoryLength).toBe(beforeHistoryLength + 1);
    });
  });

  describe('reorderCutouts', () => {
    it('forward: increments zIndex by 1', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 0 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 1 }));

      reorderCutouts(['cutout-1'], 'forward');

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].zIndex).toBe(1);
      expect(params.cutouts[1].zIndex).toBe(1);
    });

    it('backward: decrements zIndex, clamped to 0', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 2 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 0 }));

      reorderCutouts(['cutout-1'], 'backward');
      reorderCutouts(['cutout-2'], 'backward');

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].zIndex).toBe(1);
      expect(params.cutouts[1].zIndex).toBe(0);
    });

    it('front: sets zIndex to maxZ + 1', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 0 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 5 }));
      addCutout(createTestCutout({ id: 'cutout-3', zIndex: 3 }));

      reorderCutouts(['cutout-1'], 'front');

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].zIndex).toBe(6);
      expect(params.cutouts[1].zIndex).toBe(5);
      expect(params.cutouts[2].zIndex).toBe(3);
    });

    it('back: sets zIndex to 0', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 5 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 3 }));

      reorderCutouts(['cutout-1'], 'back');

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].zIndex).toBe(0);
      expect(params.cutouts[1].zIndex).toBe(3);
    });

    it('no-op on empty ids', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout());
      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      reorderCutouts([], 'forward');

      const afterHistoryLength = useDesignerStore.getState().history.past.length;
      expect(afterHistoryLength).toBe(beforeHistoryLength);
    });

    it('multiple cutouts reorder simultaneously', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 1 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 2 }));
      addCutout(createTestCutout({ id: 'cutout-3', zIndex: 0 }));

      reorderCutouts(['cutout-1', 'cutout-3'], 'front');

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].zIndex).toBe(3);
      expect(params.cutouts[1].zIndex).toBe(2);
      expect(params.cutouts[2].zIndex).toBe(3);
    });
  });

  describe('showAllCutouts', () => {
    it('unhides all hidden cutouts', () => {
      const { addCutout, showAllCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', hidden: true }));
      addCutout(createTestCutout({ id: 'cutout-2', hidden: false }));
      addCutout(createTestCutout({ id: 'cutout-3', hidden: true }));

      showAllCutouts();

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].hidden).toBe(false);
      expect(params.cutouts[1].hidden).toBe(false);
      expect(params.cutouts[2].hidden).toBe(false);
    });

    it('no-op when none are hidden (does not push history)', () => {
      const { addCutout, showAllCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', hidden: false }));
      addCutout(createTestCutout({ id: 'cutout-2' }));
      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      showAllCutouts();

      const afterHistoryLength = useDesignerStore.getState().history.past.length;
      expect(afterHistoryLength).toBe(beforeHistoryLength);
    });

    it('only affects hidden cutouts', () => {
      const { addCutout, showAllCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', hidden: true, locked: true }));
      addCutout(createTestCutout({ id: 'cutout-2', locked: true }));

      showAllCutouts();

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].hidden).toBe(false);
      expect(params.cutouts[0].locked).toBe(true);
      expect(params.cutouts[1].locked).toBe(true);
    });
  });

  describe('updateCutout - path translation', () => {
    it('moving a path cutout auto-translates path points by delta', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      const pathPoints: PathPoint[] = [
        { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
        { x: 20, y: 10, handleIn: null, handleOut: null, symmetric: false },
        { x: 15, y: 20, handleIn: null, handleOut: null, symmetric: false },
      ];
      addCutout(
        createTestCutout({
          id: 'cutout-1',
          shape: 'path',
          x: 10,
          y: 10,
          path: pathPoints,
        })
      );

      updateCutout('cutout-1', { x: 20, y: 15 });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].x).toBe(20);
      expect(params.cutouts[0].y).toBe(15);
      expect(params.cutouts[0].path).toEqual([
        { x: 20, y: 15, handleIn: null, handleOut: null, symmetric: false },
        { x: 30, y: 15, handleIn: null, handleOut: null, symmetric: false },
        { x: 25, y: 25, handleIn: null, handleOut: null, symmetric: false },
      ]);
    });

    it('path points stay unchanged when path is explicitly provided', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      const pathPoints: PathPoint[] = [
        { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
        { x: 20, y: 10, handleIn: null, handleOut: null, symmetric: false },
      ];
      const newPath: PathPoint[] = [
        { x: 100, y: 100, handleIn: null, handleOut: null, symmetric: false },
        { x: 200, y: 100, handleIn: null, handleOut: null, symmetric: false },
      ];
      addCutout(
        createTestCutout({
          id: 'cutout-1',
          shape: 'path',
          x: 10,
          y: 10,
          path: pathPoints,
        })
      );

      updateCutout('cutout-1', { x: 50, path: newPath });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].x).toBe(50);
      expect(params.cutouts[0].path).toEqual(newPath);
    });

    it('non-path cutouts update normally', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', shape: 'rectangle', x: 10, y: 10 }));

      updateCutout('cutout-1', { x: 30, y: 40 });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].x).toBe(30);
      expect(params.cutouts[0].y).toBe(40);
      expect(params.cutouts[0].path).toBeUndefined();
    });
  });

  describe('updateCutoutsBatch', () => {
    it('updates multiple cutouts in one call', () => {
      const { addCutout, updateCutoutsBatch } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', x: 10, label: 'A' }));
      addCutout(createTestCutout({ id: 'cutout-2', x: 20, label: 'B' }));
      addCutout(createTestCutout({ id: 'cutout-3', x: 30, label: 'C' }));

      const updates = new Map<string, Partial<Cutout>>([
        ['cutout-1', { label: 'Updated A' }],
        ['cutout-3', { x: 50, label: 'Updated C' }],
      ]);
      updateCutoutsBatch(updates);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].label).toBe('Updated A');
      expect(params.cutouts[0].x).toBe(10);
      expect(params.cutouts[1].label).toBe('B');
      expect(params.cutouts[2].label).toBe('Updated C');
      expect(params.cutouts[2].x).toBe(50);
    });

    it('path translation works in batch', () => {
      const { addCutout, updateCutoutsBatch } = useDesignerStore.getState();
      const pathPoints: PathPoint[] = [
        { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
        { x: 20, y: 10, handleIn: null, handleOut: null, symmetric: false },
      ];
      addCutout(
        createTestCutout({
          id: 'cutout-1',
          shape: 'path',
          x: 10,
          y: 10,
          path: pathPoints,
        })
      );

      const updates = new Map<string, Partial<Cutout>>([['cutout-1', { x: 25, y: 30 }]]);
      updateCutoutsBatch(updates);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].x).toBe(25);
      expect(params.cutouts[0].y).toBe(30);
      expect(params.cutouts[0].path).toEqual([
        { x: 25, y: 30, handleIn: null, handleOut: null, symmetric: false },
        { x: 35, y: 30, handleIn: null, handleOut: null, symmetric: false },
      ]);
    });

    it('no-op on empty map', () => {
      const { addCutout, updateCutoutsBatch } = useDesignerStore.getState();
      addCutout(createTestCutout());
      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      updateCutoutsBatch(new Map());

      const afterHistoryLength = useDesignerStore.getState().history.past.length;
      expect(afterHistoryLength).toBe(beforeHistoryLength);
    });
  });

  describe('removeCutoutsBatch', () => {
    it('removes multiple cutouts', () => {
      const { addCutout, removeCutoutsBatch } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));
      addCutout(createTestCutout({ id: 'cutout-3' }));
      addCutout(createTestCutout({ id: 'cutout-4' }));

      removeCutoutsBatch(['cutout-2', 'cutout-4']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(2);
      expect(params.cutouts[0].id).toBe('cutout-1');
      expect(params.cutouts[1].id).toBe('cutout-3');
    });

    it('dissolves singleton groups after batch removal', () => {
      const { addCutout, groupCutouts, removeCutoutsBatch } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));
      addCutout(createTestCutout({ id: 'cutout-3' }));

      groupCutouts(['cutout-1', 'cutout-2', 'cutout-3']);
      const groupId = useDesignerStore.getState().params.cutouts[0].groupId;
      expect(groupId).not.toBeNull();

      removeCutoutsBatch(['cutout-2', 'cutout-3']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(1);
      expect(params.cutouts[0].id).toBe('cutout-1');
      expect(params.cutouts[0].groupId).toBeNull();
    });

    it('no-op on empty ids', () => {
      const { addCutout, removeCutoutsBatch } = useDesignerStore.getState();
      addCutout(createTestCutout());
      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      removeCutoutsBatch([]);

      const afterHistoryLength = useDesignerStore.getState().history.past.length;
      expect(afterHistoryLength).toBe(beforeHistoryLength);
    });
  });
});
