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

    it('resizing a path cutout scales its path points proportionally', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      addCutout(
        createTestCutout({
          id: 'p-1',
          shape: 'path',
          x: 10,
          y: 10,
          width: 20,
          depth: 20,
          path: [
            { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 30, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 20, y: 30, handleIn: null, handleOut: null, symmetric: false },
          ],
        })
      );

      updateCutout('p-1', { width: 40, depth: 40 });

      const c = useDesignerStore.getState().params.cutouts[0];
      expect(c.width).toBe(40);
      expect(c.depth).toBe(40);
      expect(c.path).toEqual([
        { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
        { x: 50, y: 10, handleIn: null, handleOut: null, symmetric: false },
        { x: 30, y: 50, handleIn: null, handleOut: null, symmetric: false },
      ]);
    });

    it('resize + move composes scale-around-old-origin then translate', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      addCutout(
        createTestCutout({
          id: 'p-1',
          shape: 'path',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          path: [
            { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
            { x: 10, y: 0, handleIn: null, handleOut: null, symmetric: false },
            { x: 5, y: 10, handleIn: null, handleOut: null, symmetric: false },
          ],
        })
      );

      updateCutout('p-1', { x: 100, y: 50, width: 20, depth: 30 });

      const c = useDesignerStore.getState().params.cutouts[0];
      expect(c.path).toEqual([
        { x: 100, y: 50, handleIn: null, handleOut: null, symmetric: false },
        { x: 120, y: 50, handleIn: null, handleOut: null, symmetric: false },
        { x: 110, y: 80, handleIn: null, handleOut: null, symmetric: false },
      ]);
    });

    it('scales handles by the same factors as the points', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      addCutout(
        createTestCutout({
          id: 'p-1',
          shape: 'path',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          path: [
            {
              x: 5,
              y: 5,
              handleIn: { dx: -2, dy: 1 },
              handleOut: { dx: 2, dy: -1 },
              symmetric: true,
            },
          ],
        })
      );

      updateCutout('p-1', { width: 30, depth: 20 });

      const pt = useDesignerStore.getState().params.cutouts[0].path?.[0];
      expect(pt?.handleIn).toEqual({ dx: -6, dy: 2 });
      expect(pt?.handleOut).toEqual({ dx: 6, dy: -2 });
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

    it('path resize works in batch', () => {
      const { addCutout, updateCutoutsBatch } = useDesignerStore.getState();
      addCutout(
        createTestCutout({
          id: 'p-1',
          shape: 'path',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          path: [
            { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
            { x: 10, y: 0, handleIn: null, handleOut: null, symmetric: false },
            { x: 5, y: 10, handleIn: { dx: 1, dy: -1 }, handleOut: null, symmetric: false },
          ],
        })
      );

      updateCutoutsBatch(new Map([['p-1', { x: 100, y: 50, width: 30, depth: 20 }]]));

      const c = useDesignerStore.getState().params.cutouts[0];
      expect(c.path).toEqual([
        { x: 100, y: 50, handleIn: null, handleOut: null, symmetric: false },
        { x: 130, y: 50, handleIn: null, handleOut: null, symmetric: false },
        { x: 115, y: 70, handleIn: { dx: 3, dy: -2 }, handleOut: null, symmetric: false },
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

  // The cutoutBuilder worker reads neither `locked`, `hidden`, nor `zIndex`
  // (verified by inspection: none appear in `src/features/generation/worker/`),
  // so flipping those fields must not bump the generation epoch. Otherwise
  // every lock/hide/reorder click kicks off a brepjs run that produces the
  // identical mesh.
  describe('cosmetic mutations do not bump generation.epoch', () => {
    it('setCutoutProperty (lock) leaves epoch unchanged', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      setCutoutProperty(['c-1'], { locked: true });

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
    });

    it('setCutoutProperty (hide) leaves epoch unchanged', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      setCutoutProperty(['c-1'], { hidden: true });

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
    });

    it('reorderCutouts leaves epoch unchanged', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1' }));
      addCutout(createTestCutout({ id: 'c-2' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      reorderCutouts(['c-1'], 'forward');

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
    });

    it('showAllCutouts leaves epoch unchanged', () => {
      const { addCutout, showAllCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1', hidden: true }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      showAllCutouts();

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
    });

    it('addCutout still bumps epoch (geometric)', () => {
      const { addCutout } = useDesignerStore.getState();
      const epochBefore = useDesignerStore.getState().generation.epoch;

      addCutout(createTestCutout({ id: 'c-1' }));

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
    });

    it('history entry is still captured so undo restores prior state', () => {
      const { addCutout, setCutoutProperty, undo } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1', locked: false }));
      setCutoutProperty(['c-1'], { locked: true });

      expect(useDesignerStore.getState().params.cutouts[0].locked).toBe(true);
      undo();
      expect(useDesignerStore.getState().params.cutouts[0].locked).toBe(false);
    });
  });

  describe('groupCutouts with op', () => {
    it('defaults newly-created groups to union', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));

      groupCutouts(['a', 'b']);

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0].groupId).not.toBeNull();
      expect(cutouts[0].groupOp).toBe('union');
      expect(cutouts[1].groupOp).toBe('union');
      expect(cutouts[0].groupId).toBe(cutouts[1].groupId);
    });

    it('stamps the passed op on all members', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));

      groupCutouts(['a', 'b'], 'subtract');

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0].groupOp).toBe('subtract');
      expect(cutouts[1].groupOp).toBe('subtract');
    });

    it('inherits an existing group s op when extending without an explicit op', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));

      groupCutouts(['a', 'b'], 'intersect');
      groupCutouts(['a', 'c']);

      const { cutouts } = useDesignerStore.getState().params;
      const opByMember = Object.fromEntries(cutouts.map((c) => [c.id, c.groupOp]));
      expect(opByMember.a).toBe('intersect');
      expect(opByMember.b).toBe('intersect');
      expect(opByMember.c).toBe('intersect');
    });

    it('ignores groups of size 1 (no-op)', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));

      groupCutouts(['a'], 'union');

      expect(useDesignerStore.getState().params.cutouts[0].groupId).toBeNull();
    });
  });

  describe('setGroupOp', () => {
    it('updates the op on every member of a group', () => {
      const { addCutout, groupCutouts, setGroupOp } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      groupCutouts(['a', 'b'], 'union');
      const groupId = useDesignerStore.getState().params.cutouts[0].groupId!;

      setGroupOp(groupId, 'subtract');

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0].groupOp).toBe('subtract');
      expect(cutouts[1].groupOp).toBe('subtract');
    });

    it('is a no-op when the group already has the requested op (no history entry)', () => {
      const { addCutout, groupCutouts, setGroupOp } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      groupCutouts(['a', 'b'], 'subtract');
      const groupId = useDesignerStore.getState().params.cutouts[0].groupId!;
      const historyBefore = useDesignerStore.getState().history.past.length;

      setGroupOp(groupId, 'subtract');

      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('does not touch cutouts in other groups', () => {
      const { addCutout, groupCutouts, setGroupOp } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      addCutout(createTestCutout({ id: 'd' }));
      groupCutouts(['a', 'b'], 'union');
      groupCutouts(['c', 'd'], 'intersect');
      const groupAB = useDesignerStore.getState().params.cutouts[0].groupId!;

      setGroupOp(groupAB, 'exclude');

      const opByMember = Object.fromEntries(
        useDesignerStore.getState().params.cutouts.map((c) => [c.id, c.groupOp])
      );
      expect(opByMember.a).toBe('exclude');
      expect(opByMember.b).toBe('exclude');
      expect(opByMember.c).toBe('intersect');
      expect(opByMember.d).toBe('intersect');
    });
  });

  describe('ungroupCutouts', () => {
    it('clears both groupId and groupOp', () => {
      const { addCutout, groupCutouts, ungroupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      groupCutouts(['a', 'b'], 'subtract');

      ungroupCutouts(['a', 'b']);

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0].groupId).toBeNull();
      expect(cutouts[0].groupOp).toBeUndefined();
      expect(cutouts[1].groupId).toBeNull();
      expect(cutouts[1].groupOp).toBeUndefined();
    });

    it('dissolves the lone remaining member when a partial ungroup leaves a singleton', () => {
      const { addCutout, groupCutouts, ungroupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      groupCutouts(['a', 'b', 'c'], 'intersect');

      ungroupCutouts(['a', 'b']);

      const { cutouts } = useDesignerStore.getState().params;
      const c = cutouts.find((x) => x.id === 'c');
      expect(c?.groupId).toBeNull();
      expect(c?.groupOp).toBeUndefined();
    });
  });

  describe('setCutoutColor', () => {
    it('applies color + default scope to the targeted cutout only', () => {
      const { addCutout, setCutoutColor } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));

      setCutoutColor(['a'], { color: '#ef4444' });

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0]).toMatchObject({ color: '#ef4444', colorScope: 'floorAndWalls' });
      expect(cutouts[1].color).toBeUndefined();
    });

    it('honors an explicit scope', () => {
      const { addCutout, setCutoutColor } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));

      setCutoutColor(['a'], { color: '#3b82f6', colorScope: 'floor' });

      expect(useDesignerStore.getState().params.cutouts[0].colorScope).toBe('floor');
    });

    it('auto-enables multi-color when a color is set', () => {
      const { addCutout, setCutoutColor } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      expect(useDesignerStore.getState().params.featureColors.enabled).toBe(false);

      setCutoutColor(['a'], { color: '#ef4444' });

      expect(useDesignerStore.getState().params.featureColors.enabled).toBe(true);
    });

    it('writes the whole group when any grouped member is targeted', () => {
      const { addCutout, groupCutouts, setCutoutColor } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      groupCutouts(['a', 'b'], 'union');

      setCutoutColor(['a'], { color: '#22c55e', colorScope: 'floor' });

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0]).toMatchObject({ color: '#22c55e', colorScope: 'floor' });
      expect(cutouts[1]).toMatchObject({ color: '#22c55e', colorScope: 'floor' });
    });

    it('clears color + scope on color: null', () => {
      const { addCutout, setCutoutColor } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', color: '#ef4444', colorScope: 'floor' }));

      setCutoutColor(['a'], { color: null });

      const c = useDesignerStore.getState().params.cutouts[0];
      expect(c.color).toBeUndefined();
      expect(c.colorScope).toBeUndefined();
    });

    it('does not regenerate geometry — recolor is cosmetic', () => {
      const { addCutout, setCutoutColor } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', color: '#ef4444' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      setCutoutColor(['a'], { color: '#3b82f6' });

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
    });

    it('captures history so undo restores the prior color', () => {
      const { addCutout, setCutoutColor, undo } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));

      setCutoutColor(['a'], { color: '#ef4444' });
      expect(useDesignerStore.getState().params.cutouts[0].color).toBe('#ef4444');

      undo();
      expect(useDesignerStore.getState().params.cutouts[0].color).toBeUndefined();
    });

    it('no-op on empty ids (no history entry)', () => {
      const { addCutout, setCutoutColor } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      const historyBefore = useDesignerStore.getState().history.past.length;

      setCutoutColor([], { color: '#ef4444' });

      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('grouping unifies mixed member colors to one backing', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', color: '#ef4444', colorScope: 'floor' }));
      addCutout(createTestCutout({ id: 'b' }));

      groupCutouts(['a', 'b'], 'union');

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0]).toMatchObject({ color: '#ef4444', colorScope: 'floor' });
      expect(cutouts[1]).toMatchObject({ color: '#ef4444', colorScope: 'floor' });
    });
  });
});
