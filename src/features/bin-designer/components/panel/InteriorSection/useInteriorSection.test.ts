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

describe('useInteriorSection — the selected card cannot outrun the style', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('shows the Cutout card only while the design is on the solid style', () => {
    const { result } = renderHook(() => useInteriorSection());

    act(() => {
      result.current.handlers.selectCard('solid');
    });
    expect(useDesignerStore.getState().params.style).toBe('solid');
    expect(result.current.state.card).toBe('solid');
  });

  it('falls back off Cutout when undo walks the style back under it', () => {
    // The reported route: the card is stored UI state and undo restores params
    // without it, so the panel kept offering the cutout editor for a hollow
    // bin whose cutouts the generator never builds.
    const { result } = renderHook(() => useInteriorSection());

    act(() => {
      result.current.handlers.selectCard('solid');
    });
    act(() => {
      useDesignerStore.getState().undo();
    });

    expect(useDesignerStore.getState().params.style).toBe('standard');
    // The preference is still recorded — only the resolved selection moves.
    expect(useDesignerStore.getState().ui.interiorCard).toBe('solid');
    expect(result.current.state.card).toBe('standard');
  });

  it('falls back off Cutout when the design is reset to defaults', () => {
    const { result } = renderHook(() => useInteriorSection());

    act(() => {
      result.current.handlers.selectCard('solid');
    });
    act(() => {
      useDesignerStore.getState().resetToDefaults();
    });

    expect(useDesignerStore.getState().params.style).toBe('standard');
    expect(result.current.state.card).toBe('standard');
  });

  it('falls back off Cutout when the constraint engine refuses the style', () => {
    // A spacer has no interior to shape, so `style.solid` is unavailable and
    // resolveConstraints returns the params untouched. selectCard has already
    // recorded the preference by then.
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, spacer: true } },
    });
    const { result } = renderHook(() => useInteriorSection());

    act(() => {
      result.current.handlers.selectCard('solid');
    });

    expect(useDesignerStore.getState().params.style).toBe('standard');
    expect(result.current.state.card).toBe('standard');
  });

  it('keeps Bento selected across an override reset — the tie the preference exists for', () => {
    // Bento and Grid Dividers share `style: 'standard'`, so the preference is
    // the ONLY thing that can tell them apart and must stay sticky.
    const { result } = renderHook(() => useInteriorSection());

    act(() => {
      result.current.handlers.selectCard('bento');
    });
    expect(result.current.state.card).toBe('bento');

    act(() => {
      useDesignerStore.getState().setCompartmentGrid(3, 2);
    });
    expect(result.current.state.card).toBe('bento');
  });
});
