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

  it('summary shows Auto when scoops enabled with auto radius', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      },
    });

    const { result } = renderHook(() => useScoopSection());

    expect(result.current.meta.summary).toContain('Auto');
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
});
