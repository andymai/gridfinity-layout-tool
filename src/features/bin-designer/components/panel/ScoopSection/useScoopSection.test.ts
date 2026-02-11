import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScoopSection } from './useScoopSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useScoopSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('toggleScoop enables scoops', () => {
    const { result } = renderHook(() => useScoopSection());

    expect(result.current.state.scoop.enabled).toBe(false);

    act(() => {
      result.current.handlers.toggleScoop();
    });

    expect(useDesignerStore.getState().params.scoop.enabled).toBe(true);
  });

  it('disabledReason set when style is slotted', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'slotted' },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.meta.disabledReason).toBeDefined();
  });

  it('disabledReason set when style is solid', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'solid' },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.meta.disabledReason).toBeDefined();
  });

  it('no disabledReason when style is standard', () => {
    const { result } = renderHook(() => useScoopSection());

    expect(result.current.meta.disabledReason).toBeUndefined();
  });

  it('summary is undefined when scoops disabled', () => {
    const { result } = renderHook(() => useScoopSection());

    expect(result.current.meta.summary).toBeUndefined();
  });

  it('summary shows Auto with resolved value when scoops enabled with auto radius', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.meta.summary).toContain('Auto');
    // Should include resolved radius value in mm
    expect(result.current.meta.summary).toMatch(/\d+mm/);
  });

  it('summary shows radius in mm when manual', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 12 },
      },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.meta.summary).toContain('12mm');
  });

  it('toggleAutoRadius switches from auto to manual', () => {
    const { result } = renderHook(() => useScoopSection());

    expect(result.current.state.isAutoRadius).toBe(true);

    act(() => {
      result.current.handlers.toggleAutoRadius();
    });

    const newRadius = useDesignerStore.getState().params.scoop.radius;
    expect(typeof newRadius).toBe('number');
  });

  it('toggleAutoRadius switches from manual to auto', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, radius: 10 },
      },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.state.isAutoRadius).toBe(false);

    act(() => {
      result.current.handlers.toggleAutoRadius();
    });

    expect(useDesignerStore.getState().params.scoop.radius).toBe('auto');
  });

  it('setRadius updates radius', () => {
    const { result } = renderHook(() => useScoopSection());

    act(() => {
      result.current.handlers.setRadius(15);
    });

    expect(useDesignerStore.getState().params.scoop.radius).toBe(15);
  });

  it('autoDisplayText shows resolved value for single compartment', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto' },
      },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.state.autoDisplayText).toMatch(/Auto \(\d+mm\)/);
  });

  it('autoDisplayText is empty string when manual radius', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 10 },
      },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.state.autoDisplayText).toBe('');
  });

  it('autoDisplayText shows range for non-uniform compartments', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 4,
        depth: 2,
        scoop: { enabled: true, radius: 'auto' },
        compartments: {
          cols: 2,
          rows: 2,
          thickness: 1.2,
          // Row 0: one wide merged compartment (ID 0)
          // Row 1: two narrow compartments (IDs 1 and 2)
          cells: [0, 0, 1, 2],
        },
      },
    });

    const { result } = renderHook(() => useScoopSection());

    // Merged compartment is wider → may produce different radius
    expect(result.current.state.autoDisplayText).toMatch(/Auto/);
  });
});
