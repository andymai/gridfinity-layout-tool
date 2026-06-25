/**
 * Tests for the right-inspector selection setters on the designer store:
 * the three selection arms (compartment / color zone / divider) are mutually
 * exclusive — last-interaction-wins — and never push history.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useDesignerStore, _resetPendingMeshCache } from '../designer';

describe('uiSlice — inspector selection', () => {
  beforeEach(() => {
    _resetPendingMeshCache();
    useDesignerStore.setState({
      ui: {
        ...useDesignerStore.getState().ui,
        selectedCompartmentId: null,
        selectedColorZone: null,
        selectedDividerKey: null,
      },
      history: { past: [], future: [] },
    });
  });

  it('selecting a compartment clears divider + zone selection', () => {
    useDesignerStore.getState().setSelectedDividerKey('0-1');
    useDesignerStore.getState().setSelectedCompartmentId(3);

    const { ui } = useDesignerStore.getState();
    expect(ui.selectedCompartmentId).toBe(3);
    expect(ui.selectedDividerKey).toBeNull();
    expect(ui.selectedColorZone).toBeNull();
  });

  it('selecting a color zone clears divider + compartment selection', () => {
    useDesignerStore.getState().setSelectedCompartmentId(2);
    useDesignerStore.getState().setSelectedColorZone('body');

    const { ui } = useDesignerStore.getState();
    expect(ui.selectedColorZone).toBe('body');
    expect(ui.selectedCompartmentId).toBeNull();
    expect(ui.selectedDividerKey).toBeNull();
  });

  it('selecting a divider clears compartment + zone selection', () => {
    useDesignerStore.getState().setSelectedColorZone('base');
    useDesignerStore.getState().setSelectedDividerKey('1-2');

    const { ui } = useDesignerStore.getState();
    expect(ui.selectedDividerKey).toBe('1-2');
    expect(ui.selectedCompartmentId).toBeNull();
    expect(ui.selectedColorZone).toBeNull();
  });

  it('clearing one arm to null leaves the others untouched', () => {
    useDesignerStore.getState().setSelectedCompartmentId(5);
    useDesignerStore.getState().setSelectedDividerKey(null);

    const { ui } = useDesignerStore.getState();
    expect(ui.selectedCompartmentId).toBe(5);
    expect(ui.selectedDividerKey).toBeNull();
  });

  it('selection setters do not push history', () => {
    useDesignerStore.getState().setSelectedCompartmentId(1);
    useDesignerStore.getState().setSelectedColorZone('scoop');
    useDesignerStore.getState().setSelectedDividerKey('0-1');

    expect(useDesignerStore.getState().history.past).toHaveLength(0);
  });
});
