/**
 * Selection-model invariants (stage B4).
 *
 * The selection is plain UI state: picking, switching, and clearing must never
 * touch the undo history or the generation epoch, and a selection orphaned by
 * a real params mutation must read as null through the resolver rather than
 * pointing the Selection page at a renumbered compartment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { resolveSelection } from '@/features/bin-designer/utils/selection';

describe('DesignerStore - selection model', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('select auto-switches to the Selection page and remembers the return slot', () => {
    const store = useDesignerStore.getState();
    store.setActiveCategory('interior');
    useDesignerStore.getState().select({ kind: 'compartment', id: 0 });

    const { ui } = useDesignerStore.getState();
    expect(ui.activeCategory).toBe('selection');
    expect(ui.returnCategory).toBe('interior');
    expect(ui.selection).toEqual({ kind: 'compartment', id: 0 });
  });

  it('re-selecting while on the Selection page keeps the original return slot', () => {
    const store = useDesignerStore.getState();
    store.setActiveCategory('interior');
    useDesignerStore.getState().select({ kind: 'compartment', id: 0 });
    useDesignerStore.getState().select({ kind: 'divider', key: '0-1' });

    expect(useDesignerStore.getState().ui.returnCategory).toBe('interior');
  });

  it('clearSelection restores the return category exactly once', () => {
    useDesignerStore.getState().setActiveCategory('interior');
    useDesignerStore.getState().select({ kind: 'compartment', id: 0 });
    useDesignerStore.getState().clearSelection();

    const { ui } = useDesignerStore.getState();
    expect(ui.activeCategory).toBe('interior');
    expect(ui.selection).toBeNull();
    expect(ui.returnCategory).toBeNull();
  });

  it('a manual rail move away deselects and drops the return slot', () => {
    useDesignerStore.getState().select({ kind: 'compartment', id: 0 });
    useDesignerStore.getState().setActiveCategory('style');

    const { ui } = useDesignerStore.getState();
    expect(ui.selection).toBeNull();
    expect(ui.returnCategory).toBeNull();
    expect(ui.activeCategory).toBe('style');
  });

  it('selection changes never touch undo history or the generation epoch', () => {
    const before = useDesignerStore.getState();
    const pastLen = before.history.past.length;
    const epoch = before.generation.epoch;

    useDesignerStore.getState().select({ kind: 'compartment', id: 0 });
    useDesignerStore.getState().select({ kind: 'labelTab', compartmentId: 0 });
    useDesignerStore.getState().clearSelection();

    const after = useDesignerStore.getState();
    expect(after.history.past.length).toBe(pastLen);
    expect(after.generation.epoch).toBe(epoch);
  });

  it('a regrid orphans the held selection at the resolver, not at the store', () => {
    useDesignerStore.getState().setCompartmentGrid(3, 2);
    useDesignerStore.getState().select({ kind: 'compartment', id: 5 });

    useDesignerStore.getState().setCompartmentGrid(2, 1);

    const { ui, params } = useDesignerStore.getState();
    // The raw field still holds the stale pick; validity is derived at read.
    expect(ui.selection).toEqual({ kind: 'compartment', id: 5 });
    expect(resolveSelection(ui.selection, params.compartments)).toBeNull();
    expect(resolveSelection({ kind: 'compartment', id: 1 }, params.compartments)).toEqual({
      kind: 'compartment',
      id: 1,
    });
  });
});
