import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { MAX_MESH_ASSETS_PER_DESIGN } from '@/shared/generation/meshAsset';

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
    /**
     * Ids from bottom of the stack to top. The contract is the ORDER; the
     * concrete zIndex values are an implementation detail of the restack.
     *
     * Mirrors `stackBottomToTop`'s explicit array-order tiebreak rather than
     * leaning on `Array.sort` stability, so an all-default stack (every zIndex
     * absent, i.e. equal) asserts the documented contract instead of an
     * incidental property of the sort.
     */
    const stackOrder = (): string[] => {
      const cutouts = useDesignerStore.getState().params.cutouts;
      const indexById = new Map(cutouts.map((c, i) => [c.id, i]));
      return [...cutouts]
        .sort(
          (a, b) =>
            (a.zIndex ?? 0) - (b.zIndex ?? 0) ||
            (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0)
        )
        .map((c) => c.id);
    };

    it('forward: swaps with the shape above', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 0 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 1 }));

      reorderCutouts(['cutout-1'], 'forward');

      expect(stackOrder()).toEqual(['cutout-2', 'cutout-1']);
    });

    it('gives each new cutout its own layer so nothing ties', () => {
      // Equal layer AND equal area would leave the renderer with identical
      // scene Z and renderOrder, and the two channels break that tie by
      // different rules (raycast traversal vs object id).
      const { addCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));

      const zs = useDesignerStore.getState().params.cutouts.map((c) => c.zIndex);
      expect(new Set(zs).size).toBe(3);
      expect(zs).toEqual([0, 1, 2]);
    });

    it('stacks duplicates above their sources instead of tying with them', () => {
      // `...c` used to carry the source zIndex, so a duplicate shared a layer
      // AND an area with its original — the one tie neither stacking channel
      // can break consistently.
      const { addCutout, duplicateCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));

      duplicateCutouts(['a', 'b']);

      const zs = useDesignerStore.getState().params.cutouts.map((c) => c.zIndex);
      expect(new Set(zs).size).toBe(zs.length);
      expect(zs).toEqual([0, 1, 2, 3]);
    });

    it('honours an explicit zIndex on the incoming cutout', () => {
      const { addCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', zIndex: 9 }));

      expect(useDesignerStore.getState().params.cutouts.map((c) => c.zIndex)).toEqual([0, 9]);
    });

    it('back and forward work from an all-default stack (#3053)', () => {
      // Every cutout defaults to zIndex 0. The old absolute-value maths made
      // `back` write 0 over 0 and `backward` clamp to max(-1, 0), so neither
      // moved anything until some other shape had been sent forward first.
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      expect(stackOrder()).toEqual(['a', 'b', 'c']);

      reorderCutouts(['c'], 'back');
      expect(stackOrder()).toEqual(['c', 'a', 'b']);

      reorderCutouts(['a'], 'front');
      expect(stackOrder()).toEqual(['c', 'b', 'a']);

      reorderCutouts(['a'], 'backward');
      expect(stackOrder()).toEqual(['c', 'a', 'b']);
    });

    it('restacks onto contiguous zIndex values', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 0 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 40 }));
      addCutout(createTestCutout({ id: 'cutout-3', zIndex: 7 }));

      reorderCutouts(['cutout-1'], 'front');

      const zs = [...useDesignerStore.getState().params.cutouts]
        .map((c) => c.zIndex)
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(zs).toEqual([0, 1, 2]);
    });

    it('backward: swaps with the shape below, and the bottom one stays put', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 2 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 0 }));

      reorderCutouts(['cutout-1'], 'backward');
      expect(stackOrder()).toEqual(['cutout-1', 'cutout-2']);

      reorderCutouts(['cutout-1'], 'backward');
      expect(stackOrder()).toEqual(['cutout-1', 'cutout-2']);
    });

    it('front: moves to the top of the stack', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 0 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 5 }));
      addCutout(createTestCutout({ id: 'cutout-3', zIndex: 3 }));

      reorderCutouts(['cutout-1'], 'front');

      expect(stackOrder()).toEqual(['cutout-3', 'cutout-2', 'cutout-1']);
    });

    it('back: moves to the bottom of the stack', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 5 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 3 }));

      reorderCutouts(['cutout-1'], 'back');

      expect(stackOrder()).toEqual(['cutout-1', 'cutout-2']);
    });

    it('no-op on empty ids', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout());
      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      reorderCutouts([], 'forward');

      const afterHistoryLength = useDesignerStore.getState().history.past.length;
      expect(afterHistoryLength).toBe(beforeHistoryLength);
    });

    it('multiple cutouts reorder simultaneously, keeping their relative order', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', zIndex: 1 }));
      addCutout(createTestCutout({ id: 'cutout-2', zIndex: 2 }));
      addCutout(createTestCutout({ id: 'cutout-3', zIndex: 0 }));

      reorderCutouts(['cutout-1', 'cutout-3'], 'front');

      expect(stackOrder()).toEqual(['cutout-2', 'cutout-3', 'cutout-1']);
    });
  });

  describe('reparentCutouts', () => {
    const groupOf = (id: string): string | null =>
      useDesignerStore.getState().params.cutouts.find((c) => c.id === id)?.groupId ?? null;

    it('lets the DESTINATION group win, not whichever is first in the array', () => {
      // groupCutouts picks the first grouped member in array order, so composing
      // it absorbed the destination into the source depending on ordering.
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'src-a', groupId: 'src' }));
      addCutout(createTestCutout({ id: 'src-b', groupId: 'src' }));
      addCutout(createTestCutout({ id: 'dst-a', groupId: 'dst' }));
      addCutout(createTestCutout({ id: 'dst-b', groupId: 'dst' }));

      reparentCutouts(['src-a'], 'dst-a');

      expect(groupOf('src-a')).toBe('dst');
      expect(groupOf('dst-a')).toBe('dst');
      expect(groupOf('dst-b')).toBe('dst');
    });

    it('forms a fresh group when the target is loose', () => {
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));

      reparentCutouts(['a'], 'b');

      expect(groupOf('a')).not.toBeNull();
      expect(groupOf('a')).toBe(groupOf('b'));
    });

    it('pulls a grouped shape onto a loose one without dragging its old group along', () => {
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'g-a', groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'g-b', groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'g-c', groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'loose' }));

      reparentCutouts(['g-a'], 'loose');

      expect(groupOf('g-a')).toBe(groupOf('loose'));
      expect(groupOf('g-a')).not.toBe('g1');
      expect(groupOf('g-b')).toBe('g1');
    });

    it('ungroups on a null target', () => {
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'b', groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'c', groupId: 'g1' }));

      reparentCutouts(['a'], null);

      expect(groupOf('a')).toBeNull();
      expect(groupOf('b')).toBe('g1');
    });

    it('dissolves a group left with one member', () => {
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'b', groupId: 'g1' }));

      reparentCutouts(['a'], null);

      expect(groupOf('a')).toBeNull();
      expect(groupOf('b')).toBeNull();
    });

    it('ignores a drop onto a shape being dragged', () => {
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      const historyBefore = useDesignerStore.getState().history.past.length;

      reparentCutouts(['a', 'b'], 'a');

      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('is a no-op when already in the destination group', () => {
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'b', groupId: 'g1' }));
      const historyBefore = useDesignerStore.getState().history.past.length;

      reparentCutouts(['a'], 'b');

      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('ignores an unknown target', () => {
      const { addCutout, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      const historyBefore = useDesignerStore.getState().history.past.length;

      reparentCutouts(['a'], 'nope');

      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });
  });

  describe('moveCutoutsAbove', () => {
    const stackOrder = (): string[] => {
      const cutouts = useDesignerStore.getState().params.cutouts;
      const indexById = new Map(cutouts.map((c, i) => [c.id, i]));
      return [...cutouts]
        .sort(
          (a, b) =>
            (a.zIndex ?? 0) - (b.zIndex ?? 0) ||
            (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0)
        )
        .map((c) => c.id);
    };

    const seed = (): void => {
      const { addCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
    };

    it('drops the shape directly above the target', () => {
      seed(); // bottom -> top: a, b, c
      useDesignerStore.getState().moveCutoutsAbove(['a'], 'b');
      expect(stackOrder()).toEqual(['b', 'a', 'c']);
    });

    it('drops to the bottom for a null target', () => {
      seed();
      useDesignerStore.getState().moveCutoutsAbove(['c'], null);
      expect(stackOrder()).toEqual(['c', 'a', 'b']);
    });

    it('keeps the moved shapes in their own order', () => {
      seed();
      useDesignerStore.getState().moveCutoutsAbove(['a', 'b'], 'c');
      expect(stackOrder()).toEqual(['c', 'a', 'b']);
    });

    it('is a no-op when dropping a selection onto itself', () => {
      seed();
      const before = stackOrder();
      const historyBefore = useDesignerStore.getState().history.past.length;

      useDesignerStore.getState().moveCutoutsAbove(['a', 'b'], 'a');

      expect(stackOrder()).toEqual(before);
      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('leaves the stack alone for an unknown target', () => {
      seed();
      const before = stackOrder();
      useDesignerStore.getState().moveCutoutsAbove(['a'], 'nope');
      expect(stackOrder()).toEqual(before);
    });

    it('is a no-op when the shape is already there', () => {
      seed();
      const historyBefore = useDesignerStore.getState().history.past.length;
      useDesignerStore.getState().moveCutoutsAbove(['b'], 'a');
      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('ignores empty ids', () => {
      seed();
      const historyBefore = useDesignerStore.getState().history.past.length;
      useDesignerStore.getState().moveCutoutsAbove([], 'a');
      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('creates no undo entry when a legacy default stack does not move', () => {
      // Every zIndex is still the default 0 here; renumbering would rewrite them
      // all and push history for a drag that changed nothing.
      seed();
      const historyBefore = useDesignerStore.getState().history.past.length;
      useDesignerStore.getState().moveCutoutsAbove(['b'], 'a');
      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('renumbers onto contiguous layers', () => {
      seed();
      useDesignerStore.getState().moveCutoutsAbove(['a'], 'c');
      const zs = useDesignerStore
        .getState()
        .params.cutouts.map((c) => c.zIndex)
        .sort((x, y) => (x ?? 0) - (y ?? 0));
      expect(zs).toEqual([0, 1, 2]);
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

    it('setCutoutProperty is a no-op when the value is already set', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1', hidden: true }));
      const epochBefore = useDesignerStore.getState().generation.epoch;
      const historyBefore = useDesignerStore.getState().history.past.length;

      setCutoutProperty(['c-1'], { hidden: true });

      // Re-hiding an already-hidden cutout must not cost a worker rebuild.
      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('setCutoutProperty is a no-op for unknown ids', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;
      const historyBefore = useDesignerStore.getState().history.past.length;

      setCutoutProperty(['nope'], { hidden: true });

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
      expect(useDesignerStore.getState().history.past.length).toBe(historyBefore);
    });

    it('setCutoutProperty (hide) DOES bump epoch — the worker drops hidden cutouts (#3053)', () => {
      const { addCutout, setCutoutProperty } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      setCutoutProperty(['c-1'], { hidden: true });

      // `cutoutBuilder.ts` skips hidden cutouts, so hiding changes the part.
      // Suppressing regeneration here left the preview showing a pocket the
      // export would not cut.
      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
    });

    it('reorderCutouts leaves epoch unchanged when nothing is grouped', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1' }));
      addCutout(createTestCutout({ id: 'c-2' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      reorderCutouts(['c-1'], 'forward');

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
    });

    it('reorderCutouts bumps epoch when a group exists — z-order drives boolean ops', () => {
      const { addCutout, reorderCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1', groupId: 'g-1' }));
      addCutout(createTestCutout({ id: 'c-2', groupId: 'g-1' }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      reorderCutouts(['c-1'], 'forward');

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
    });

    it('showAllCutouts DOES bump epoch — it restores dropped cuts (#3053)', () => {
      const { addCutout, showAllCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'c-1', hidden: true }));
      const epochBefore = useDesignerStore.getState().generation.epoch;

      showAllCutouts();

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
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

    it('does not spend an undo step re-grouping an unchanged group', () => {
      // Reachable from Ctrl+G on a partial selection: groupCutouts reuses the
      // existing groupId and re-groups every member, so nothing changes.
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      groupCutouts(['a', 'b', 'c']);

      const before = useDesignerStore.getState();
      const depthBefore = before.history.past.length;
      const cutoutsBefore = before.params.cutouts;

      groupCutouts(['a', 'b']);

      const after = useDesignerStore.getState();
      expect(after.history.past.length).toBe(depthBefore);
      expect(after.params.cutouts).toBe(cutoutsBefore);
    });

    it('still records history when a loose cutout joins an existing group', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      groupCutouts(['a', 'b']);

      const depthBefore = useDesignerStore.getState().history.past.length;
      groupCutouts(['a', 'c']);

      const after = useDesignerStore.getState();
      expect(after.history.past.length).toBe(depthBefore + 1);
      const byId = Object.fromEntries(after.params.cutouts.map((x) => [x.id, x.groupId]));
      expect(byId.c).toBe(byId.a);
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

  describe('mesh assets lifecycle', () => {
    const createMeshAsset = (): MeshAsset => ({
      name: 'wrench',
      data: 'AAAA',
      triangleCount: 12,
      sizeMm: { x: 20, y: 10, z: 5 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 0, y: 10 },
        ],
      ],
    });

    const createMeshCutout = (overrides: Partial<Cutout> = {}): Cutout =>
      createTestCutout({ id: 'mesh-1', shape: 'mesh', meshId: 'asset-1', ...overrides });

    it('addMeshCutout stores the cutout and its asset in one history entry', () => {
      const { addMeshCutout } = useDesignerStore.getState();
      const historyBefore = useDesignerStore.getState().history.past.length;

      addMeshCutout(createMeshCutout(), createMeshAsset());

      const { params, history } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(1);
      expect(params.meshAssets?.['asset-1']?.name).toBe('wrench');
      expect(history.past.length).toBe(historyBefore + 1);
    });

    it('addMeshCutout rejects non-mesh shapes and missing meshId', () => {
      const { addMeshCutout } = useDesignerStore.getState();
      addMeshCutout(createTestCutout({ id: 'x' }), createMeshAsset());
      addMeshCutout(createMeshCutout({ meshId: undefined }), createMeshAsset());

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(0);
      expect(params.meshAssets).toBeUndefined();
    });

    it('addMeshCutout enforces the per-design asset cap', () => {
      const { addMeshCutout } = useDesignerStore.getState();
      for (let i = 0; i < MAX_MESH_ASSETS_PER_DESIGN + 2; i++) {
        addMeshCutout(
          createMeshCutout({ id: `mesh-${i}`, meshId: `asset-${i}` }),
          createMeshAsset()
        );
      }
      const { params } = useDesignerStore.getState();
      expect(Object.keys(params.meshAssets ?? {})).toHaveLength(MAX_MESH_ASSETS_PER_DESIGN);
      expect(params.cutouts).toHaveLength(MAX_MESH_ASSETS_PER_DESIGN);
    });

    it('removeCutout GCs the asset when the last reference goes', () => {
      const { addMeshCutout, removeCutout } = useDesignerStore.getState();
      addMeshCutout(createMeshCutout(), createMeshAsset());

      removeCutout('mesh-1');

      expect(useDesignerStore.getState().params.meshAssets).toBeUndefined();
    });

    it('keeps a shared asset while other cutouts still reference it', () => {
      const { addMeshCutout, removeCutout } = useDesignerStore.getState();
      addMeshCutout(createMeshCutout({ id: 'mesh-a' }), createMeshAsset());
      addMeshCutout(createMeshCutout({ id: 'mesh-b' }), createMeshAsset());

      removeCutout('mesh-a');

      const { params } = useDesignerStore.getState();
      expect(params.meshAssets?.['asset-1']).toBeDefined();

      removeCutout('mesh-b');
      expect(useDesignerStore.getState().params.meshAssets).toBeUndefined();
    });

    it('removeCutoutsBatch and clearCutouts GC assets', () => {
      const { addMeshCutout, removeCutoutsBatch, clearCutouts, addCutout } =
        useDesignerStore.getState();
      addMeshCutout(createMeshCutout({ id: 'mesh-a' }), createMeshAsset());
      addMeshCutout(createMeshCutout({ id: 'mesh-b', meshId: 'asset-2' }), createMeshAsset());
      addCutout(createTestCutout({ id: 'rect-1' }));

      removeCutoutsBatch(['mesh-a']);
      expect(useDesignerStore.getState().params.meshAssets?.['asset-1']).toBeUndefined();
      expect(useDesignerStore.getState().params.meshAssets?.['asset-2']).toBeDefined();

      clearCutouts();
      expect(useDesignerStore.getState().params.meshAssets).toBeUndefined();
    });

    it('duplicated mesh cutouts share the original asset (no payload growth)', () => {
      const { addMeshCutout, duplicateCutouts, removeCutout } = useDesignerStore.getState();
      addMeshCutout(createMeshCutout(), createMeshAsset());

      duplicateCutouts(['mesh-1']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(2);
      expect(params.cutouts[1].meshId).toBe('asset-1');
      expect(Object.keys(params.meshAssets ?? {})).toHaveLength(1);

      removeCutout('mesh-1');
      expect(useDesignerStore.getState().params.meshAssets?.['asset-1']).toBeDefined();
    });

    it('undo restores both the cutout and its asset', () => {
      const { addMeshCutout, removeCutout } = useDesignerStore.getState();
      addMeshCutout(createMeshCutout(), createMeshAsset());
      removeCutout('mesh-1');
      expect(useDesignerStore.getState().params.meshAssets).toBeUndefined();

      useDesignerStore.getState().undo();

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(1);
      expect(params.meshAssets?.['asset-1']?.name).toBe('wrench');
    });
  });

  describe('mergeCutoutsIntoArray', () => {
    const repeatConfig = {
      mode: 'grid' as const,
      cols: 3,
      rows: 1,
      pitchX: 24,
      pitchY: 20,
      count: 3,
      radius: 30,
      startAngle: 0,
      rotateToCenter: false,
    };

    const seedThree = () => {
      const { addCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', x: 0 }));
      addCutout(createTestCutout({ id: 'b', x: 24 }));
      addCutout(createTestCutout({ id: 'c', x: 48 }));
    };

    it('writes the config onto the master and drops the absorbed cutouts', () => {
      seedThree();

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts).toHaveLength(1);
      expect(cutouts[0].id).toBe('a');
      expect(cutouts[0].array).toEqual(repeatConfig);
    });

    it('is one history entry, so a single undo restores every cutout', () => {
      seedThree();
      const before = useDesignerStore.getState().history.past.length;

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);
      expect(useDesignerStore.getState().history.past.length).toBe(before + 1);

      useDesignerStore.getState().undo();

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
      expect(cutouts.every((c) => c.array === undefined)).toBe(true);
    });

    // The ids come from a detection taken against an older snapshot, and this
    // action DELETES cutouts, so anything no longer eligible makes the whole
    // merge decline. A partial merge would leave strays sitting on top of the
    // instances the config now generates.
    it('declines when an absorbed cutout has since been deleted', () => {
      seedThree();
      useDesignerStore.getState().removeCutout('c');

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts.map((c) => c.id).sort()).toEqual(['a', 'b']);
      expect(cutouts.find((c) => c.id === 'a')?.array).toBeUndefined();
    });

    it('declines when an absorbed cutout has since been locked', () => {
      seedThree();
      useDesignerStore.getState().lockCutouts(['c']);

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
    });

    it('declines when an absorbed cutout has since been grouped', () => {
      seedThree();
      useDesignerStore.getState().updateCutout('c', { groupId: 'g1' });

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
    });

    it('declines when an absorbed cutout has since gained its own repeat', () => {
      seedThree();
      useDesignerStore.getState().updateCutout('c', { array: repeatConfig });

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
    });

    it('reports whether it merged, so callers do not announce a refusal', () => {
      seedThree();
      expect(useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c'])).toBe(
        true
      );

      seedThree();
      useDesignerStore.getState().lockCutouts(['c']);
      expect(useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c'])).toBe(
        false
      );
    });

    it('declines when the master already carries a repeat, rather than replacing it', () => {
      seedThree();
      const existing = { ...repeatConfig, cols: 2 };
      useDesignerStore.getState().updateCutout('a', { array: existing });

      const ok = useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      expect(ok).toBe(false);
      expect(useDesignerStore.getState().params.cutouts.find((c) => c.id === 'a')?.array).toEqual(
        existing
      );
    });

    it('declines when the master has since been locked', () => {
      seedThree();
      useDesignerStore.getState().lockCutouts(['a']);

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
    });

    it('does nothing when the master has gone', () => {
      seedThree();
      const before = useDesignerStore.getState().history.past.length;

      useDesignerStore.getState().mergeCutoutsIntoArray('missing', repeatConfig, ['b', 'c']);

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
      expect(useDesignerStore.getState().history.past.length).toBe(before);
    });

    it('does nothing when nothing would be absorbed', () => {
      seedThree();
      const before = useDesignerStore.getState().history.past.length;

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['a']);

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
      expect(useDesignerStore.getState().history.past.length).toBe(before);
    });

    it('refuses a master that cannot carry a repeat', () => {
      const { addCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', x: 0, groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'b', x: 24, groupId: 'g1' }));
      addCutout(createTestCutout({ id: 'c', x: 48, groupId: 'g1' }));

      useDesignerStore.getState().mergeCutoutsIntoArray('a', repeatConfig, ['b', 'c']);

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(3);
    });
  });
});
