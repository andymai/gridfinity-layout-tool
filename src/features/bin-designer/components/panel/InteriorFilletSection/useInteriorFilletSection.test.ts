import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteriorFilletSection } from './useInteriorFilletSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useInteriorFilletSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('turns on at the shell corner radius', () => {
    const { result } = renderHook(() => useInteriorFilletSection());
    expect(result.current.state.enabled).toBe(false);

    act(() => {
      result.current.handlers.toggle();
    });

    expect(useDesignerStore.getState().params.interiorFilletMm).toBe(2.5);
  });

  it('turning off leaves no key behind for the fingerprint', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, interiorFilletMm: 4 } });
    const { result } = renderHook(() => useInteriorFilletSection());

    act(() => {
      result.current.handlers.toggle();
    });

    const { params } = useDesignerStore.getState();
    expect(params.interiorFilletMm).toBeUndefined();
    expect(JSON.stringify(params)).not.toContain('interiorFilletMm');
  });

  it('clamps the radius to the control range', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, interiorFilletMm: 2 } });
    const { result } = renderHook(() => useInteriorFilletSection());

    act(() => {
      result.current.handlers.setRadius(40);
    });
    expect(useDesignerStore.getState().params.interiorFilletMm).toBe(15);

    act(() => {
      result.current.handlers.setRadius(0.1);
    });
    expect(useDesignerStore.getState().params.interiorFilletMm).toBe(0.5);
  });

  it('is unavailable on a slotted bin', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, style: 'slotted' } });
    const { result } = renderHook(() => useInteriorFilletSection());

    expect(result.current.meta.disabledReason).toBeDefined();
    act(() => {
      result.current.handlers.toggle();
    });
    expect(useDesignerStore.getState().params.interiorFilletMm).toBeUndefined();
  });

  it('flags a radius larger than the narrowest compartment can hold', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 1,
        depth: 1,
        interiorFilletMm: 12,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      },
    });
    const { result } = renderHook(() => useInteriorFilletSection());
    expect(result.current.state.clamped).toBe(true);
  });

  it('does not flag a radius every compartment can hold', () => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, interiorFilletMm: 3 } });
    const { result } = renderHook(() => useInteriorFilletSection());
    expect(result.current.state.clamped).toBe(false);
  });
});
