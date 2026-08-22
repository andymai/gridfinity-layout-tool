import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { AssemblyStructure } from '@/shared/types/assembly';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';

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

  it('assembly actions no-op for a bin design', () => {
    useDesignerStore.getState().newDesign('bin');
    expect(store().addAssemblyPart('post', null)).toBeNull();
    expect(store().history.past).toHaveLength(0);
  });
});
