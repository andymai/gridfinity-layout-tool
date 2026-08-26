import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout, CutoutArrayConfig, PathPoint } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { MAX_MESH_ASSETS_PER_DESIGN } from '@/shared/generation/meshAsset';
import { MAX_LID_CUTOUTS } from '@/features/bin-designer/types';

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

    it('wraps a group and a loose cutout in a container rather than folding', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      groupCutouts(['a', 'b']);
      const booleanId = useDesignerStore
        .getState()
        .params.cutouts.find((x) => x.id === 'a')?.groupId;

      const depthBefore = useDesignerStore.getState().history.past.length;
      groupCutouts(['a', 'c']);

      const after = useDesignerStore.getState();
      expect(after.history.past.length).toBe(depthBefore + 1);
      const byId = Object.fromEntries(after.params.cutouts.map((x) => [x.id, x]));
      // a and b keep the boolean group they had; c stays loose.
      expect(byId.a.groupId).toBe(booleanId);
      expect(byId.b.groupId).toBe(booleanId);
      expect(byId.c.groupId).toBeNull();
      // All three now share one container above them.
      const container = byId.a.parentGroups?.[0];
      expect(container).toBeDefined();
      expect(byId.b.parentGroups).toEqual([container]);
      expect(byId.c.parentGroups).toEqual([container]);
    });

    it('leaves the geometry epoch alone when it only wraps a container', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      groupCutouts(['a', 'b']);

      const epochBefore = useDesignerStore.getState().generation.epoch;
      groupCutouts(['a', 'c']);

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
    });

    it('refuses to form a group inside a boolean group', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));
      groupCutouts(['a', 'b', 'c'], 'subtract');
      const booleanId = useDesignerStore.getState().params.cutouts[0].groupId;
      expect(booleanId).not.toBeNull();

      const before = useDesignerStore.getState().params.cutouts;
      // Drilled into the boolean group, grouping two of its members would leave
      // its op fusing one shape instead of three.
      groupCutouts(['a', 'b'], undefined, [booleanId as string]);

      expect(useDesignerStore.getState().params.cutouts).toBe(before);
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

    it('folds a loose cutout into an existing group when a Pathfinder op asks', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b' }));
      addCutout(createTestCutout({ id: 'c' }));

      groupCutouts(['a', 'b'], 'intersect');
      // An explicit op is the Pathfinder path, which still merges into one
      // boolean group — only bare Group wraps instead.
      groupCutouts(['a', 'c'], 'intersect');

      const { cutouts } = useDesignerStore.getState().params;
      const byId = Object.fromEntries(cutouts.map((c) => [c.id, c]));
      expect(byId.c.groupId).toBe(byId.a.groupId);
      expect(byId.a.groupOp).toBe('intersect');
      expect(byId.b.groupOp).toBe('intersect');
      expect(byId.c.groupOp).toBe('intersect');
    });

    it('ignores groups of size 1 (no-op)', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));

      groupCutouts(['a'], 'union');

      expect(useDesignerStore.getState().params.cutouts[0].groupId).toBeNull();
    });
  });

  describe('setCutoutArray', () => {
    const row: CutoutArrayConfig = {
      mode: 'grid',
      cols: 3,
      rows: 1,
      pitchX: 30,
      pitchY: 30,
      count: 3,
      radius: 20,
      startAngle: 0,
      rotateToCenter: true,
    };

    it('writes one shared repeat onto every member of a group', () => {
      const { addCutout, groupCutouts, setCutoutArray } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));
      groupCutouts(['a', 'b'], 'exclude');

      setCutoutArray('a', row);

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0].array?.cols).toBe(3);
      expect(cutouts[1].array?.cols).toBe(3);
    });

    it('refuses rotate-to-center for a group, so the assembly cannot come apart', () => {
      const { addCutout, groupCutouts, setCutoutArray } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));
      groupCutouts(['a', 'b'], 'exclude');

      setCutoutArray('a', { ...row, mode: 'radial' });

      for (const c of useDesignerStore.getState().params.cutouts) {
        expect(c.array?.rotateToCenter).toBe(false);
      }
    });

    it('keeps rotate-to-center for a loose cutout', () => {
      const { addCutout, setCutoutArray } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));

      setCutoutArray('a', { ...row, mode: 'radial' });

      expect(useDesignerStore.getState().params.cutouts[0].array?.rotateToCenter).toBe(true);
    });

    it('clears the repeat from the whole group, leaving no array key behind', () => {
      const { addCutout, groupCutouts, setCutoutArray } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));
      groupCutouts(['a', 'b'], 'union');
      setCutoutArray('a', row);

      setCutoutArray('b', undefined);

      for (const c of useDesignerStore.getState().params.cutouts) {
        // Absent, not `undefined`: a design that never had a repeat has to
        // serialize exactly as it did before the field existed.
        expect('array' in c).toBe(false);
      }
    });

    it('propagates a label list written from ONE member to the whole group', () => {
      // The shape list rows an expanded group's members individually, so the
      // Label section is reachable for a single member. Writing its caption
      // list must not leave the group holding two different repeats.
      const { addCutout, groupCutouts, setCutoutArray } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));
      groupCutouts(['a', 'b'], 'exclude');
      setCutoutArray('a', row);

      const member = useDesignerStore.getState().params.cutouts[1];
      setCutoutArray(member.id, { ...row, labels: ['one', 'two', 'three'] });

      for (const c of useDesignerStore.getState().params.cutouts) {
        expect(c.array?.labels).toEqual(['one', 'two', 'three']);
      }
    });

    it('declines a group holding a path, which cannot be repeated', () => {
      const { addCutout, groupCutouts, setCutoutArray } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(
        createTestCutout({
          id: 'b',
          x: 40,
          shape: 'path',
          path: [
            { x: 40, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 50, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 45, y: 20, handleIn: null, handleOut: null, symmetric: false },
          ],
        })
      );
      groupCutouts(['a', 'b'], 'union');

      setCutoutArray('a', row);

      for (const c of useDesignerStore.getState().params.cutouts) {
        expect(c.array).toBeUndefined();
      }
    });
  });

  describe('grouping a set that already repeats', () => {
    const row: CutoutArrayConfig = {
      mode: 'grid',
      cols: 2,
      rows: 1,
      pitchX: 30,
      pitchY: 30,
      count: 2,
      radius: 20,
      startAngle: 0,
      rotateToCenter: false,
    };

    it('adopts one repeat for the group, so repeat-then-group matches group-then-repeat', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a', array: row }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));

      groupCutouts(['a', 'b'], 'exclude');

      const { cutouts } = useDesignerStore.getState().params;
      expect(cutouts[0].array?.cols).toBe(2);
      expect(cutouts[1].array?.cols).toBe(2);
    });

    it('drops rotate-to-center when a radial repeat is carried into a group', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(
        createTestCutout({ id: 'a', array: { ...row, mode: 'radial', rotateToCenter: true } })
      );
      addCutout(createTestCutout({ id: 'b', x: 40 }));

      groupCutouts(['a', 'b'], 'union');

      for (const c of useDesignerStore.getState().params.cutouts) {
        expect(c.array?.rotateToCenter).toBe(false);
      }
    });
  });

  describe('reparenting into a repeated group', () => {
    const row: CutoutArrayConfig = {
      mode: 'grid',
      cols: 3,
      rows: 1,
      pitchX: 30,
      pitchY: 30,
      count: 3,
      radius: 20,
      startAngle: 0,
      rotateToCenter: false,
    };

    it('gives the newcomer the group repeat, not just the group op', () => {
      // A member holding no repeat inside a repeating group makes the editor
      // and the worker count copies differently.
      const { addCutout, groupCutouts, setCutoutArray, reparentCutouts } =
        useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));
      addCutout(createTestCutout({ id: 'loose', x: 80 }));
      groupCutouts(['a', 'b'], 'exclude');
      setCutoutArray('a', row);

      reparentCutouts(['loose'], 'a');

      const moved = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'loose');
      expect(moved?.groupOp).toBe('exclude');
      expect(moved?.array?.cols).toBe(3);
    });

    it("drops a newcomer's own repeat when the destination group has none", () => {
      const { addCutout, groupCutouts, reparentCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));
      addCutout(createTestCutout({ id: 'loose', x: 80, array: row }));
      groupCutouts(['a', 'b'], 'union');

      reparentCutouts(['loose'], 'a');

      // One repeat per group, so the group's answer (none) wins.
      for (const c of useDesignerStore.getState().params.cutouts) {
        expect(c.array).toBeUndefined();
      }
    });

    it('leaves a repeat on a member pulled out to loose', () => {
      const { addCutout, groupCutouts, setCutoutArray, reparentCutouts } =
        useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'a' }));
      addCutout(createTestCutout({ id: 'b', x: 40 }));
      addCutout(createTestCutout({ id: 'c', x: 80 }));
      groupCutouts(['a', 'b', 'c'], 'union');
      setCutoutArray('a', row);

      reparentCutouts(['c'], null);

      const pulled = useDesignerStore.getState().params.cutouts.find((x) => x.id === 'c');
      expect(pulled?.groupId).toBeNull();
      // It becomes its own repeat, the way ungrouping one already leaves it.
      expect(pulled?.array?.cols).toBe(3);
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

  /**
   * Builds the tree the nesting tests read against and returns its ids:
   *
   *   container
   *   ├─ gA (subtract)  a1, a2
   *   ├─ gB (union)     b1, b2
   *   └─ hex            (loose child)
   *   loose             (top level)
   */
  const buildNested = (): { container: string; gA: string; gB: string } => {
    const { addCutout, groupCutouts } = useDesignerStore.getState();
    for (const id of ['a1', 'a2', 'b1', 'b2', 'hex', 'loose']) {
      addCutout(createTestCutout({ id }));
    }
    groupCutouts(['a1', 'a2'], 'subtract');
    groupCutouts(['b1', 'b2'], 'union');
    groupCutouts(['a1', 'b1', 'hex']);

    const byId = Object.fromEntries(
      useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
    );
    const container = byId.a1.parentGroups?.[0];
    if (container === undefined) throw new Error('container not formed');
    return { container, gA: byId.a1.groupId as string, gB: byId.b1.groupId as string };
  };

  const repeatConfig = (): CutoutArrayConfig => ({
    mode: 'grid',
    cols: 2,
    rows: 1,
    pitchX: 60,
    pitchY: 0,
    count: 1,
    radius: 0,
    startAngle: 0,
    rotateToCenter: false,
  });

  describe('nested groups', () => {
    it('wraps subgroups and a loose shape without touching their booleans', () => {
      const { container, gA, gB } = buildNested();
      const byId = Object.fromEntries(
        useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
      );

      expect(byId.a1.groupId).toBe(gA);
      expect(byId.a2.groupId).toBe(gA);
      expect(byId.a1.groupOp).toBe('subtract');
      expect(byId.b1.groupId).toBe(gB);
      expect(byId.hex.groupId).toBeNull();

      for (const id of ['a1', 'a2', 'b1', 'b2', 'hex']) {
        expect(byId[id].parentGroups).toEqual([container]);
      }
      // The cutout outside the selection is untouched, field and all.
      expect(byId.loose.parentGroups).toBeUndefined();
    });

    it('pulls in every member of a group the selection only partly touches', () => {
      buildNested();
      const byId = Object.fromEntries(
        useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
      );
      // a2 and b2 were never selected; they came along with their groups.
      expect(byId.a2.parentGroups).toEqual(byId.a1.parentGroups);
      expect(byId.b2.parentGroups).toEqual(byId.b1.parentGroups);
    });

    describe('peelGroup', () => {
      it('dissolves one level, leaving the subgroups intact', () => {
        const { container, gA, gB } = buildNested();
        useDesignerStore.getState().peelGroup(container);

        const byId = Object.fromEntries(
          useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
        );
        expect(byId.a1.groupId).toBe(gA);
        expect(byId.a1.groupOp).toBe('subtract');
        expect(byId.b1.groupId).toBe(gB);
        expect(byId.hex.groupId).toBeNull();
        for (const id of ['a1', 'a2', 'b1', 'b2', 'hex']) {
          expect(byId[id].parentGroups).toBeUndefined();
        }
      });

      it('dissolving a container does not bump the geometry epoch', () => {
        const { container } = buildNested();
        const epochBefore = useDesignerStore.getState().generation.epoch;

        useDesignerStore.getState().peelGroup(container);

        expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
      });

      it('dissolving a boolean group frees its members and drops the op', () => {
        const { container, gA } = buildNested();
        useDesignerStore.getState().peelGroup(gA);

        const byId = Object.fromEntries(
          useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
        );
        expect(byId.a1.groupId).toBeNull();
        expect(byId.a1.groupOp).toBeUndefined();
        // They stay inside the container they were nested in.
        expect(byId.a1.parentGroups).toEqual([container]);
      });

      it('ignores a group the design does not have', () => {
        buildNested();
        const before = useDesignerStore.getState().params.cutouts;
        useDesignerStore.getState().peelGroup('not-a-group');
        expect(useDesignerStore.getState().params.cutouts).toBe(before);
      });
    });

    describe('moveUnitsIntoGroup', () => {
      it('moves a whole subgroup into another container, keeping its boolean', () => {
        const { gA, gB } = buildNested();
        const { addCutout, groupCutouts, moveUnitsIntoGroup } = useDesignerStore.getState();
        addCutout(createTestCutout({ id: 'x' }));
        addCutout(createTestCutout({ id: 'y' }));
        groupCutouts(['x', 'y']);
        groupCutouts(['x', 'loose']);
        const other = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'x')
          ?.parentGroups?.[0];
        if (other === undefined) throw new Error('second container not formed');

        moveUnitsIntoGroup([`group:${gA}`], other);

        const byId = Object.fromEntries(
          useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
        );
        expect(byId.a1.groupId).toBe(gA);
        expect(byId.a1.groupOp).toBe('subtract');
        expect(byId.a1.parentGroups).toEqual([other]);
        expect(byId.a2.parentGroups).toEqual([other]);
        // gB stayed where it was.
        expect(byId.b1.groupId).toBe(gB);
      });

      it('refuses to move a group into a boolean group', () => {
        const { gA, gB } = buildNested();
        const before = useDesignerStore.getState().params.cutouts;

        useDesignerStore.getState().moveUnitsIntoGroup([`group:${gB}`], gA);

        expect(useDesignerStore.getState().params.cutouts).toBe(before);
      });

      it('refuses to move a group inside its own subtree', () => {
        const { container } = buildNested();
        const before = useDesignerStore.getState().params.cutouts;

        useDesignerStore.getState().moveUnitsIntoGroup([`group:${container}`], container);

        expect(useDesignerStore.getState().params.cutouts).toBe(before);
      });

      it('does not list the destination group twice when a shape joins it', () => {
        const { container, gA } = buildNested();
        useDesignerStore.getState().moveUnitsIntoGroup(['shape:hex'], gA);

        const hex = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'hex');
        expect(hex?.groupId).toBe(gA);
        // `gA` must appear once, as the groupId — never also as its own ancestor.
        expect(hex?.parentGroups).toEqual([container]);
      });

      it('drops a boolean member into a container as a loose shape', () => {
        const { container } = buildNested();
        // Reachable by dragging a member out while drilled into its group.
        useDesignerStore.getState().moveUnitsIntoGroup(['shape:a1'], container);

        const byId = Object.fromEntries(
          useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
        );
        expect(byId.a1.groupId).toBeNull();
        expect(byId.a1.parentGroups).toEqual([container]);
        // The container must not have been promoted into the boolean slot.
        expect(byId.a1.groupId).not.toBe(container);
        // And the op goes with the group it left.
        expect(byId.a1.groupOp).toBeUndefined();
        // gA is left with one member, which `dissolveSingletonGroups` frees —
        // a boolean group of one has no op to run.
        expect(byId.a2.groupId).toBeNull();
        expect(byId.a2.parentGroups).toEqual([container]);
      });

      it('strips the op from a shape moved out to the top level', () => {
        buildNested();
        useDesignerStore.getState().moveUnitsIntoGroup(['shape:a1'], null);

        const a1 = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'a1');
        expect(a1?.groupId).toBeNull();
        expect(a1?.groupOp).toBeUndefined();
        expect(a1?.parentGroups).toBeUndefined();
      });

      it('lets a loose shape join a boolean group, adopting its op', () => {
        const { gA } = buildNested();
        useDesignerStore.getState().moveUnitsIntoGroup(['shape:loose'], gA);

        const loose = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'loose');
        expect(loose?.groupId).toBe(gA);
        expect(loose?.groupOp).toBe('subtract');
      });

      it('moves a unit back out to the top level', () => {
        const { gA } = buildNested();
        useDesignerStore.getState().moveUnitsIntoGroup([`group:${gA}`], null);

        const byId = Object.fromEntries(
          useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
        );
        expect(byId.a1.parentGroups).toBeUndefined();
        expect(byId.a1.groupId).toBe(gA);
        // Its former siblings stay in the container.
        expect(byId.b1.parentGroups).toHaveLength(1);
      });
    });

    it('duplicates an assembly into its own independent tree', () => {
      const { container, gA } = buildNested();
      const before = new Set(useDesignerStore.getState().params.cutouts.map((c) => c.id));

      useDesignerStore.getState().duplicateCutouts(['a1', 'a2', 'b1', 'b2', 'hex']);

      const copies = useDesignerStore.getState().params.cutouts.filter((c) => !before.has(c.id));
      expect(copies).toHaveLength(5);

      // The copy must not claim the original's container as its parent, or it
      // lands inside the thing it was copied from.
      const copyContainers = new Set(copies.map((c) => c.parentGroups?.[0]));
      expect(copyContainers.size).toBe(1);
      expect([...copyContainers][0]).not.toBe(container);
      expect([...copyContainers][0]).toBeDefined();

      // Its own internal structure survives: one fresh boolean group over the
      // two members that were in gA, still carrying the op.
      const copiedA = copies.filter((c) => c.groupOp === 'subtract');
      expect(copiedA).toHaveLength(2);
      expect(copiedA[0].groupId).toBe(copiedA[1].groupId);
      expect(copiedA[0].groupId).not.toBe(gA);
    });

    describe('repeating a container', () => {
      it('writes the repeat to every descendant, subgroups included', () => {
        buildNested();
        const config = repeatConfig();

        // `[]` is the container's OWN level, where the container is one unit.
        // Passing the container id instead would mean "inside it", resolving to
        // whichever subgroup the anchor happens to belong to.
        useDesignerStore.getState().setCutoutArray('a1', config, []);

        const byId = Object.fromEntries(
          useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
        );
        // The whole assembly repeats as one piece.
        for (const id of ['a1', 'a2', 'b1', 'b2', 'hex']) {
          expect(byId[id].array).toBeDefined();
        }
        // The cutout outside the container is untouched.
        expect(byId.loose.array).toBeUndefined();
      });

      it('writes only to its own group when no container level is given', () => {
        const { gA } = buildNested();
        const config = repeatConfig();

        useDesignerStore.getState().setCutoutArray('a1', config);

        const byId = Object.fromEntries(
          useDesignerStore.getState().params.cutouts.map((c) => [c.id, c])
        );
        expect(byId.a1.groupId).toBe(gA);
        expect(byId.a1.array).toBeDefined();
        expect(byId.a2.array).toBeDefined();
        // Its siblings inside the container are not part of that unit.
        expect(byId.b1.array).toBeUndefined();
        expect(byId.hex.array).toBeUndefined();
      });
    });

    describe('setCutoutGroupName', () => {
      it('stores, updates and clears a name', () => {
        const { container } = buildNested();
        const { setCutoutGroupName } = useDesignerStore.getState();

        setCutoutGroupName(container, '  Socket tray  ');
        expect(useDesignerStore.getState().params.cutoutGroupNames?.[container]).toBe(
          'Socket tray'
        );

        setCutoutGroupName(container, '');
        expect(useDesignerStore.getState().params.cutoutGroupNames).toBeUndefined();
      });

      it('does not bump the geometry epoch', () => {
        const { container } = buildNested();
        const epochBefore = useDesignerStore.getState().generation.epoch;

        useDesignerStore.getState().setCutoutGroupName(container, 'Socket tray');

        expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
      });

      it('drops the name once the group is gone', () => {
        const { container } = buildNested();
        useDesignerStore.getState().setCutoutGroupName(container, 'Socket tray');

        useDesignerStore.getState().peelGroup(container);

        expect(useDesignerStore.getState().params.cutoutGroupNames).toBeUndefined();
      });

      it('keeps names for groups that survive', () => {
        const { container, gA } = buildNested();
        const { setCutoutGroupName } = useDesignerStore.getState();
        setCutoutGroupName(container, 'Socket tray');
        setCutoutGroupName(gA, 'Ratchet pocket');

        useDesignerStore.getState().peelGroup(container);

        const names = useDesignerStore.getState().params.cutoutGroupNames;
        expect(names?.[gA]).toBe('Ratchet pocket');
        expect(names?.[container]).toBeUndefined();
      });
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

describe('cutoutSlice - lid target', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  const rect = (id: string): Cutout => ({
    id,
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  });

  const asset: MeshAsset = {
    name: 'wrench',
    data: 'AAAA',
    triangleCount: 12,
    sizeMm: { x: 20, y: 10, z: 5 },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
      ],
    ],
  };

  function targetLid(): void {
    useDesignerStore.getState().setCutoutEditorOpen(true, 'lid');
  }

  it('writes to the lid array, leaving the bin untouched', () => {
    targetLid();
    useDesignerStore.getState().addCutout(rect('a'));
    const { params } = useDesignerStore.getState();
    expect(params.lid.cutouts?.map((c) => c.id)).toEqual(['a']);
    expect(params.cutouts).toHaveLength(0);
  });

  it('resets the target to the bin when the editor closes', () => {
    // Every cutout action reads this, so a target left on the lid would send the
    // sidebar's own controls to the wrong part.
    targetLid();
    useDesignerStore.getState().setCutoutEditorOpen(false);
    expect(useDesignerStore.getState().ui.cutoutTarget).toBe('bin');
  });

  it('keeps the bin mesh assets while the lid is the target', () => {
    // The GC counts references through `params.cutouts`, never the retargeted
    // array: a lid cutout can never be a mesh imprint, so counting through the
    // lid would find none and drop an asset the BIN still uses.
    const meshCutout = { ...rect('mesh-1'), shape: 'mesh' as const, meshId: 'kept' };
    useDesignerStore.getState().addMeshCutout(meshCutout, asset);
    expect(Object.keys(useDesignerStore.getState().params.meshAssets ?? {})).toEqual(['kept']);

    targetLid();
    useDesignerStore.getState().addCutout(rect('lid-a'));
    useDesignerStore.getState().removeCutout('lid-a');

    expect(Object.keys(useDesignerStore.getState().params.meshAssets ?? {})).toEqual(['kept']);
    expect(useDesignerStore.getState().params.cutouts.map((c) => c.id)).toEqual(['mesh-1']);
  });

  it('adds a mesh imprint to the bin even while the lid is the target', () => {
    targetLid();
    const meshCutout = { ...rect('mesh-1'), shape: 'mesh' as const, meshId: 'kept' };
    useDesignerStore.getState().addMeshCutout(meshCutout, asset);
    const { params } = useDesignerStore.getState();
    expect(params.cutouts.map((c) => c.id)).toEqual(['mesh-1']);
    expect(params.lid.cutouts ?? []).toHaveLength(0);
  });

  it('refuses to add past the lid cap', () => {
    // The server rejects an oversized payload and migration truncates one on
    // load, so a client that let the write through would lose shapes somewhere
    // the user never sees.
    targetLid();
    for (let i = 0; i < MAX_LID_CUTOUTS + 5; i++) {
      useDesignerStore.getState().addCutout(rect(`c${i}`));
    }
    expect(useDesignerStore.getState().params.lid.cutouts).toHaveLength(MAX_LID_CUTOUTS);
  });

  it('truncates a duplicate batch to the remaining room rather than dropping it', () => {
    targetLid();
    const ids: string[] = [];
    for (let i = 0; i < MAX_LID_CUTOUTS - 2; i++) {
      useDesignerStore.getState().addCutout(rect(`c${i}`));
      ids.push(`c${i}`);
    }
    // Six asked for, two seats left: two is the useful answer, not zero.
    useDesignerStore.getState().duplicateCutouts(ids.slice(0, 6));
    expect(useDesignerStore.getState().params.lid.cutouts).toHaveLength(MAX_LID_CUTOUTS);
  });

  it('reports whether the cutout landed', () => {
    // The boolean is what lets a batch caller count what it actually stored: a
    // loop over `addCutout` otherwise stops adding silently, and an import that
    // toasts its REQUESTED count claims shapes the design never took.
    targetLid();
    const results: boolean[] = [];
    for (let i = 0; i < MAX_LID_CUTOUTS + 2; i++) {
      results.push(useDesignerStore.getState().addCutout(rect(`c${i}`)));
    }
    expect(results.filter(Boolean)).toHaveLength(MAX_LID_CUTOUTS);
    expect(results.slice(-2)).toEqual([false, false]);
  });

  it('leaves the bin array uncapped', () => {
    for (let i = 0; i < MAX_LID_CUTOUTS + 5; i++) {
      useDesignerStore.getState().addCutout(rect(`c${i}`));
    }
    expect(useDesignerStore.getState().params.cutouts).toHaveLength(MAX_LID_CUTOUTS + 5);
  });
});

describe('cutoutSlice - lid target, repeat merge', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  const rect = (id: string, x: number): Cutout => ({
    id,
    shape: 'rectangle',
    x,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  });

  it('merges a repeat on the lid, not silently nothing', () => {
    // Reads used to go straight to `params.cutouts`, so with the lid targeted the
    // master was never found and the action returned false: no merge, no toast,
    // and the suggestion stayed on screen.
    useDesignerStore.getState().setCutoutEditorOpen(true, 'lid');
    useDesignerStore.getState().addCutout(rect('m', 0));
    useDesignerStore.getState().addCutout(rect('a', 20));

    const config: CutoutArrayConfig = {
      mode: 'grid',
      cols: 2,
      rows: 1,
      pitchX: 20,
      pitchY: 0,
      count: 2,
      radius: 0,
      startAngle: 0,
      rotateToCenter: false,
    };
    const merged = useDesignerStore.getState().mergeCutoutsIntoArray('m', config, ['a']);

    expect(merged).toBe(true);
    const lidCutouts = useDesignerStore.getState().params.lid.cutouts ?? [];
    expect(lidCutouts.map((c) => c.id)).toEqual(['m']);
    expect(lidCutouts[0].array).toEqual(config);
  });

  it('leaves lid.cutouts absent when a lid-targeted action bails early', () => {
    // `cutoutOwner` materializes the array, so a guard that runs before it would
    // otherwise strand `[]` on a design with no lid cutouts — enough to shift its
    // content fingerprint for an action that did nothing.
    useDesignerStore.getState().setCutoutEditorOpen(true, 'lid');
    const config: CutoutArrayConfig = {
      mode: 'grid',
      cols: 2,
      rows: 1,
      pitchX: 20,
      pitchY: 0,
      count: 2,
      radius: 0,
      startAngle: 0,
      rotateToCenter: false,
    };
    expect(useDesignerStore.getState().mergeCutoutsIntoArray('nope', config, [])).toBe(false);
    expect(useDesignerStore.getState().params.lid.cutouts).toBeUndefined();
  });
});

describe('cutoutSlice - lid array collapses to absent', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  const rect = (id: string): Cutout => ({
    id,
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  });

  function lidCutouts(): readonly Cutout[] | undefined {
    return useDesignerStore.getState().params.lid.cutouts;
  }

  beforeEach(() => {
    useDesignerStore.getState().setCutoutEditorOpen(true, 'lid');
  });

  // `[]` and absent serialize differently, and the difference re-hashes the
  // design — enough to break the moderation tombstone on an already-published
  // one. Each path that can empty the array is checked separately because the
  // invariant is only worth having if it holds on all of them.
  it('after removing the last cutout', () => {
    useDesignerStore.getState().addCutout(rect('a'));
    expect(lidCutouts()).toHaveLength(1);
    useDesignerStore.getState().removeCutout('a');
    expect(lidCutouts()).toBeUndefined();
  });

  it('after clearing', () => {
    useDesignerStore.getState().addCutout(rect('a'));
    useDesignerStore.getState().clearCutouts();
    expect(lidCutouts()).toBeUndefined();
  });

  it('after a batch removal empties it', () => {
    useDesignerStore.getState().addCutout(rect('a'));
    useDesignerStore.getState().addCutout(rect('b'));
    useDesignerStore.getState().removeCutoutsBatch(['a', 'b']);
    expect(lidCutouts()).toBeUndefined();
  });

  it('and when a producer merely reads the array without changing it', () => {
    // `cutoutOwner` materializes `[]` to let the actions read and write
    // unconditionally; a producer that then bails must not leave it behind.
    useDesignerStore.getState().showAllCutouts();
    expect(lidCutouts()).toBeUndefined();
  });

  it('but a non-empty array is left alone', () => {
    useDesignerStore.getState().addCutout(rect('a'));
    useDesignerStore.getState().addCutout(rect('b'));
    useDesignerStore.getState().removeCutout('a');
    expect(lidCutouts()?.map((c) => c.id)).toEqual(['b']);
  });
});

function createTestCutoutTop(overrides: Partial<Cutout> = {}): Cutout {
  return {
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
  };
}

describe('updateCutout - text element footprint', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('re-derives the box from a caption edit, holding the center', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(
      createTestCutoutTop({
        id: 'text-1',
        shape: 'text',
        label: 'AB',
        x: 40,
        y: 40,
        width: 12,
        depth: 12,
        engraveLabel: true,
        textStyle: { sizeMode: 'fixed', fixedSize: 10 },
      })
    );

    updateCutout('text-1', { label: 'ABCD' });

    const stored = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'text-1');
    // 4 chars × 0.6 × 10mm = 24 wide; the center must not move.
    expect(stored?.width).toBeCloseTo(24);
    expect((stored?.x ?? 0) + (stored?.width ?? 0) / 2).toBeCloseTo(40 + 6);
  });

  it('re-derives the box when the explicit size changes', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(
      createTestCutoutTop({
        id: 'text-2',
        shape: 'text',
        label: 'AB',
        x: 40,
        y: 40,
        width: 12,
        depth: 12,
        engraveLabel: true,
        textStyle: { sizeMode: 'fixed', fixedSize: 10 },
      })
    );

    updateCutout('text-2', { textStyle: { sizeMode: 'fixed', fixedSize: 20 } });

    const stored = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'text-2');
    expect(stored?.width).toBeCloseTo(24);
    expect(stored?.depth).toBeCloseTo(24);
  });

  it('leaves other shapes untouched by the sync', () => {
    const { addCutout, updateCutout } = useDesignerStore.getState();
    addCutout(createTestCutoutTop({ id: 'rect-1', shape: 'rectangle', width: 20, depth: 15 }));

    updateCutout('rect-1', { label: 'much longer caption' });

    const stored = useDesignerStore.getState().params.cutouts.find((c) => c.id === 'rect-1');
    expect(stored?.width).toBe(20);
    expect(stored?.depth).toBe(15);
  });
});
