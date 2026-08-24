import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { AssemblyStructure } from '@/shared/types/assembly';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import { _resetWorkshopClipboard } from '@/features/bin-designer/store/slices/paramSlice/assemblyActions';

function assembly(): AssemblyStructure {
  const structure = useDesignerStore.getState().structure;
  if (structure?.kind !== 'assembly') throw new Error('expected an assembly structure');
  return structure;
}

describe('DesignerStore - workshop assembly actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
  });

  const store = () => useDesignerStore.getState();

  it('newDesign(assembly) yields an empty build with no selection', () => {
    expect(store().itemKind).toBe('assembly');
    expect(assembly().parts).toEqual([]);
    expect(store().ui.selectedAssemblyPartId).toBeNull();
  });

  it('adds a part, selects it, and records one history entry', () => {
    const id = store().addAssemblyPart('post', null, { x: 21, y: 21 });
    expect(id).not.toBeNull();
    expect(assembly().parts).toHaveLength(1);
    expect(store().ui.selectedAssemblyPartId).toBe(id);
    expect(store().history.past).toHaveLength(1);
  });

  it('stacks a child on a parent and reparents it to the floor', () => {
    const blockId = store().addAssemblyPart('block', null);
    const postId = store().addAssemblyPart('post', blockId);
    if (!blockId || !postId) throw new Error('unreachable');
    expect(findAssemblyPart(assembly().parts, blockId)?.children[0]?.id).toBe(postId);
    expect(store().reparentAssemblyPart(postId, null, { x: 50 })).toBe(true);
    expect(assembly().parts.map((n) => n.id)).toEqual([blockId, postId]);
    expect(findAssemblyPart(assembly().parts, postId)?.transform.x).toBe(50);
  });

  it('keeps a zero-delta move a true no-op', () => {
    const id = store().addAssemblyPart('fin', null, { x: 10 });
    if (!id) throw new Error('unreachable');
    const historyLen = store().history.past.length;
    store().moveAssemblyPart(id, { x: 10 });
    expect(store().history.past).toHaveLength(historyLen);
  });

  it('clamps a moved transform into schema range', () => {
    const id = store().addAssemblyPart('post', null);
    if (!id) throw new Error('unreachable');
    store().moveAssemblyPart(id, { x: 99999, rotZDeg: 400 });
    const t = findAssemblyPart(assembly().parts, id)?.transform;
    expect(t?.x).toBe(1000);
    expect(t?.rotZDeg).toBe(360);
  });

  it('refuses a param edit the schema rejects', () => {
    const id = store().addAssemblyPart('fin', null);
    if (!id) throw new Error('unreachable');
    const historyLen = store().history.past.length;
    store().updateAssemblyPartParams(id, { leanDeg: 80 });
    expect(store().history.past).toHaveLength(historyLen);
    const node = findAssemblyPart(assembly().parts, id);
    expect(node?.type === 'fin' && node.params.leanDeg).toBe(20);
    store().updateAssemblyPartParams(id, { leanDeg: 30 });
    const edited = findAssemblyPart(assembly().parts, id);
    expect(edited?.type === 'fin' && edited.params.leanDeg).toBe(30);
  });

  it('removing a parent clears a selection inside its subtree', () => {
    const blockId = store().addAssemblyPart('block', null);
    const postId = store().addAssemblyPart('post', blockId);
    if (!blockId || !postId) throw new Error('unreachable');
    expect(store().ui.selectedAssemblyPartId).toBe(postId);
    store().removeAssemblyPart(blockId);
    expect(assembly().parts).toEqual([]);
    expect(store().ui.selectedAssemblyPartId).toBeNull();
  });

  it('undo and redo walk the part tree, not bin params', () => {
    const id = store().addAssemblyPart('post', null);
    if (!id) throw new Error('unreachable');
    store().moveAssemblyPart(id, { x: 42 });
    expect(findAssemblyPart(assembly().parts, id)?.transform.x).toBe(42);
    store().undo();
    expect(findAssemblyPart(assembly().parts, id)?.transform.x).toBe(0);
    store().undo();
    expect(assembly().parts).toEqual([]);
    expect(store().ui.selectedAssemblyPartId).toBeNull();
    store().redo();
    store().redo();
    expect(findAssemblyPart(assembly().parts, id)?.transform.x).toBe(42);
  });

  it('groups a drag transaction into one undo step', () => {
    const id = store().addAssemblyPart('post', null);
    if (!id) throw new Error('unreachable');
    const historyLen = store().history.past.length;
    store().startTransaction();
    store().moveAssemblyPart(id, { x: 7 });
    store().moveAssemblyPart(id, { x: 14 });
    store().moveAssemblyPart(id, { x: 21 });
    store().commitTransaction();
    expect(store().history.past).toHaveLength(historyLen + 1);
    store().undo();
    expect(findAssemblyPart(assembly().parts, id)?.transform.x).toBe(0);
  });

  it('keeps an unchanged base edit a true no-op', () => {
    store().updateAssemblyBase({ floorThickness: 2 });
    expect(store().history.past).toHaveLength(0);
    store().updateAssemblyBase({ floorThickness: 99 });
    store().updateAssemblyBase({ floorThickness: 12 });
    expect(assembly().base.floorThickness).toBe(10);
    expect(store().history.past).toHaveLength(1);
  });

  it('base edits clamp and undo', () => {
    store().updateAssemblyBase({ floorThickness: 99 });
    expect(assembly().base.floorThickness).toBe(10);
    store().undo();
    expect(assembly().base.floorThickness).toBe(2);
  });

  it('sets, edits, and clears a linear array', () => {
    const id = store().addAssemblyPart('post', null);
    if (!id) throw new Error('unreachable');
    store().setAssemblyPartArray(id, { count: 4, dx: 20, dy: 0 });
    expect(findAssemblyPart(assembly().parts, id)?.array).toEqual({ count: 4, dx: 20, dy: 0 });
    store().setAssemblyPartArray(id, null);
    expect(findAssemblyPart(assembly().parts, id)?.array).toBeUndefined();
    store().setAssemblyPartArray(id, { count: 1, dx: 20, dy: 0 });
    expect(findAssemblyPart(assembly().parts, id)?.array).toBeUndefined();
  });

  it('toggles mirror and the assembly axis with undo coverage', () => {
    const id = store().addAssemblyPart('fin', null);
    if (!id) throw new Error('unreachable');
    store().setAssemblyPartMirror(id, true);
    expect(findAssemblyPart(assembly().parts, id)?.mirror).toBe(true);
    store().setAssemblyMirrorAxis('y');
    expect(assembly().mirrorAxis).toBe('y');
    store().undo();
    expect(assembly().mirrorAxis).toBe('x');
  });

  it('aligns and distributes siblings in one undo step each', () => {
    const a = store().addAssemblyPart('post', null, { x: 10, y: 5 });
    const b = store().addAssemblyPart('post', null, { x: 40, y: 9 });
    const c = store().addAssemblyPart('post', null, { x: 100, y: 20 });
    if (!a || !b || !c) throw new Error('unreachable');
    store().alignAssemblySiblings(a, 'y');
    expect(assembly().parts.map((n) => n.transform.y)).toEqual([5, 5, 5]);
    store().distributeAssemblySiblings(a, 'x');
    expect(assembly().parts.map((n) => n.transform.x)).toEqual([10, 55, 100]);
    store().undo();
    expect(assembly().parts.map((n) => n.transform.x)).toEqual([10, 40, 100]);
  });

  it('loads a template tree and refuses an invalid one', () => {
    const good = [
      {
        id: 'tpl',
        type: 'post' as const,
        params: { diameter: 8, height: 40, taperDeg: 0, tipChamfer: 1 },
        transform: { x: 20, y: 20, seatZ: 0, rotZDeg: 0 },
        children: [],
      },
    ];
    expect(store().loadAssemblyTemplate(good)).toBe(true);
    expect(assembly().parts).toHaveLength(1);
    const bad = [{ ...good[0], params: { ...good[0].params, diameter: 9999 } }];
    expect(store().loadAssemblyTemplate(bad)).toBe(false);
    expect(assembly().parts).toHaveLength(1);
  });

  it('assembly actions no-op for a bin design', () => {
    useDesignerStore.getState().newDesign('bin');
    expect(store().addAssemblyPart('post', null)).toBeNull();
    expect(store().history.past).toHaveLength(0);
  });
});

describe('DesignerStore - workshop group operations', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
    _resetWorkshopClipboard();
  });

  const store = () => useDesignerStore.getState();
  const three = (): [string, string, string] => {
    const a = store().addAssemblyPart('post', null, { x: 10, y: 10 });
    const b = store().addAssemblyPart('post', null, { x: 30, y: 10 });
    const c = store().addAssemblyPart('post', null, { x: 100, y: 40 });
    if (!a || !b || !c) throw new Error('unreachable');
    return [a, b, c];
  };

  it('keeps the anchor a member of the multi-selection', () => {
    const [a, b] = three();
    store().setSelectedAssemblyPartIds([a, b], a);
    expect(store().ui.selectedAssemblyPartId).toBe(a);
    store().toggleAssemblyPartSelected(a);
    expect(store().ui.selectedAssemblyPartIds).toEqual([b]);
    expect(store().ui.selectedAssemblyPartId).toBe(b);
    store().toggleAssemblyPartSelected(a);
    expect(store().ui.selectedAssemblyPartId).toBe(a);
    store().setSelectedAssemblyPartId(null);
    expect(store().ui.selectedAssemblyPartIds).toEqual([]);
  });

  it('single-part selection keeps both fields in sync', () => {
    const [a] = three();
    store().setSelectedAssemblyPartId(a);
    expect(store().ui.selectedAssemblyPartIds).toEqual([a]);
  });

  it('undo prunes vanished ids from the multi-selection', () => {
    const [a, b] = three();
    const c = store().addAssemblyPart('post', null, { x: 60, y: 60 });
    if (!c) throw new Error('unreachable');
    store().setSelectedAssemblyPartIds([a, b, c], c);
    store().undo();
    expect(store().ui.selectedAssemblyPartIds).toEqual([a, b]);
    expect(store().ui.selectedAssemblyPartId).toBe(b);
  });

  it('nudges the selection by a world delta in one history entry', () => {
    const [a, b, c] = three();
    const historyLen = store().history.past.length;
    store().nudgeAssemblyPartsWorld([a, b], 3.5, -7);
    expect(findAssemblyPart(assembly().parts, a)?.transform).toMatchObject({ x: 13.5, y: 3 });
    expect(findAssemblyPart(assembly().parts, b)?.transform).toMatchObject({ x: 33.5, y: 3 });
    expect(findAssemblyPart(assembly().parts, c)?.transform).toMatchObject({ x: 100, y: 40 });
    expect(store().history.past).toHaveLength(historyLen + 1);
  });

  it('converts world deltas into a rotated parent frame', () => {
    const blockId = store().addAssemblyPart('block', null, { x: 50, y: 50, rotZDeg: 90 });
    const postId = store().addAssemblyPart('post', blockId, { x: 10, y: 0 });
    if (!blockId || !postId) throw new Error('unreachable');
    store().nudgeAssemblyPartsWorld([postId], 5, 0);
    const t = findAssemblyPart(assembly().parts, postId)?.transform;
    expect(t?.x).toBeCloseTo(10);
    expect(t?.y).toBeCloseTo(-5);
  });

  it('a nudge covering a parent and its child moves the subtree once', () => {
    const blockId = store().addAssemblyPart('block', null, { x: 50, y: 50 });
    const postId = store().addAssemblyPart('post', blockId, { x: 10, y: 0 });
    if (!blockId || !postId) throw new Error('unreachable');
    store().nudgeAssemblyPartsWorld([blockId, postId], 5, 0);
    expect(findAssemblyPart(assembly().parts, blockId)?.transform.x).toBe(55);
    expect(findAssemblyPart(assembly().parts, postId)?.transform.x).toBe(10);
  });

  it('rotates a group 90 degrees about its world centroid', () => {
    const a = store().addAssemblyPart('post', null, { x: 10, y: 10 });
    const b = store().addAssemblyPart('post', null, { x: 30, y: 10 });
    if (!a || !b) throw new Error('unreachable');
    store().rotateAssemblyPartsWorld([a, b], 90);
    const ta = findAssemblyPart(assembly().parts, a)?.transform;
    const tb = findAssemblyPart(assembly().parts, b)?.transform;
    expect(ta?.x).toBeCloseTo(20);
    expect(ta?.y).toBeCloseTo(0);
    expect(tb?.x).toBeCloseTo(20);
    expect(tb?.y).toBeCloseTo(20);
    expect(ta?.rotZDeg).toBe(90);
    expect(tb?.rotZDeg).toBe(90);
  });

  it('aligns to the anchor and distributes between the outermost', () => {
    const [a, b, c] = three();
    store().setSelectedAssemblyPartIds([a, b, c], a);
    store().alignAssemblyPartsWorld([a, b, c], 'y');
    expect(assembly().parts.map((n) => n.transform.y)).toEqual([10, 10, 10]);
    store().distributeAssemblyPartsWorld([a, b, c], 'x');
    expect(assembly().parts.map((n) => n.transform.x)).toEqual([10, 55, 100]);
  });

  it('removes a multi-selection in one history entry', () => {
    const [a, b, c] = three();
    store().setSelectedAssemblyPartIds([a, b], a);
    const historyLen = store().history.past.length;
    store().removeAssemblyParts([a, b]);
    expect(assembly().parts.map((n) => n.id)).toEqual([c]);
    expect(store().history.past).toHaveLength(historyLen + 1);
    expect(store().ui.selectedAssemblyPartIds).toEqual([]);
  });

  it('duplicates a multi-selection, offsetting and selecting the clones', () => {
    const [a, b] = three();
    const historyLen = store().history.past.length;
    const clones = store().duplicateAssemblyParts([a, b]);
    expect(clones).toHaveLength(2);
    expect(clones.map((clone) => clone.sourceId)).toEqual([a, b]);
    expect(store().history.past).toHaveLength(historyLen + 1);
    expect(store().ui.selectedAssemblyPartIds).toEqual(clones.map((clone) => clone.id));
    const first = findAssemblyPart(assembly().parts, clones[0]?.id ?? '');
    expect(first?.transform.x).toBe(18);
  });

  it('copies and pastes an arrangement onto the base at a target point', () => {
    const [a, b] = three();
    expect(store().copyAssemblyParts([a, b])).toBe(2);
    expect(store().ui.workshopClipboardCount).toBe(2);
    const pasted = store().pasteAssemblyParts({ x: 200, y: 100 });
    expect(pasted).toHaveLength(2);
    expect(store().ui.selectedAssemblyPartIds).toEqual(pasted);
    const pa = findAssemblyPart(assembly().parts, pasted[0] ?? '');
    const pb = findAssemblyPart(assembly().parts, pasted[1] ?? '');
    expect(pa?.transform).toMatchObject({ x: 190, y: 100 });
    expect(pb?.transform).toMatchObject({ x: 210, y: 100 });
  });

  it('paste survives the source being deleted', () => {
    const [a] = three();
    store().copyAssemblyParts([a]);
    store().removeAssemblyPart(a);
    const pasted = store().pasteAssemblyParts();
    expect(pasted).toHaveLength(1);
    const node = findAssemblyPart(assembly().parts, pasted[0] ?? '');
    expect(node?.transform).toMatchObject({ x: 18, y: 18 });
  });

  it('group ops touching a stale id skip it without corrupting the batch', () => {
    const [a, b] = three();
    store().removeAssemblyPart(b);
    store().nudgeAssemblyPartsWorld([a, b], 1, 0);
    expect(findAssemblyPart(assembly().parts, a)?.transform.x).toBe(11);
  });
});
