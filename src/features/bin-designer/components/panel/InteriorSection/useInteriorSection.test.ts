import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteriorSection } from './useInteriorSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useInteriorSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns standard style by default', () => {
    const { result } = renderHook(() => useInteriorSection());

    expect(result.current.state.style).toBe('standard');
    expect(result.current.state.isSlotted).toBe(false);
  });

  it('setStyle changes bin style', () => {
    const { result } = renderHook(() => useInteriorSection());

    act(() => {
      result.current.handlers.setStyle('slotted');
    });

    expect(useDesignerStore.getState().params.style).toBe('slotted');
  });

  it('setStyle is a no-op when style is unchanged', () => {
    // Set up a non-default compartment grid
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
      },
    });

    const { result } = renderHook(() => useInteriorSection());

    // Calling setStyle with the current style should not overwrite compartments
    act(() => {
      result.current.handlers.setStyle('standard');
    });

    const { compartments } = useDesignerStore.getState().params;
    expect(compartments.cols).toBe(3);
    expect(compartments.rows).toBe(2);
  });

  it('does not overwrite compartment changes when setStyle called with same style', () => {
    const { result } = renderHook(() => useInteriorSection());
    const store = useDesignerStore.getState();

    // Simulate: user adjusts compartments via setCompartmentGrid
    act(() => {
      store.setCompartmentGrid(3, 2);
    });

    expect(useDesignerStore.getState().params.compartments.cols).toBe(3);

    // Then setStyle fires for the same style (as if click bubbled up from stepper)
    act(() => {
      result.current.handlers.setStyle('standard');
    });

    // Compartment change must be preserved
    expect(useDesignerStore.getState().params.compartments.cols).toBe(3);
    expect(useDesignerStore.getState().params.compartments.rows).toBe(2);
  });
});
