import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHandleSection } from './useHandleSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useHandleSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns disabled state by default', () => {
    const { result } = renderHook(() => useHandleSection());
    expect(result.current.state.handles.enabled).toBe(false);
  });

  it('toggleEnabled enables handles', () => {
    const { result } = renderHook(() => useHandleSection());

    act(() => {
      result.current.handlers.toggleEnabled();
    });

    expect(useDesignerStore.getState().params.handles.enabled).toBe(true);
  });

  it('toggleEnabled disables handles', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
      },
    });

    const { result } = renderHook(() => useHandleSection());

    act(() => {
      result.current.handlers.toggleEnabled();
    });

    expect(useDesignerStore.getState().params.handles.enabled).toBe(false);
  });

  it('toggleSide enables a side', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          back: { enabled: false },
        },
      },
    });

    const { result } = renderHook(() => useHandleSection());

    act(() => {
      result.current.handlers.toggleSide('back');
    });

    expect(useDesignerStore.getState().params.handles.back.enabled).toBe(true);
  });

  it('toggleSide disables a side', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          front: { enabled: true },
        },
      },
    });

    const { result } = renderHook(() => useHandleSection());

    act(() => {
      result.current.handlers.toggleSide('front');
    });

    expect(useDesignerStore.getState().params.handles.front.enabled).toBe(false);
  });

  it('back side disabled when label tabs active', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          back: { enabled: false },
        },
      },
    });

    const { result } = renderHook(() => useHandleSection());

    expect(result.current.state.isBackDisabled).toBe(true);

    // toggleSide should be a no-op for back
    act(() => {
      result.current.handlers.toggleSide('back');
    });

    expect(useDesignerStore.getState().params.handles.back.enabled).toBe(false);
  });

  it('setWidth updates handle width', () => {
    const { result } = renderHook(() => useHandleSection());

    act(() => {
      result.current.handlers.setWidth(50);
    });

    expect(useDesignerStore.getState().params.handles.width).toBe(50);
  });

  it('setDepth updates handle depth', () => {
    const { result } = renderHook(() => useHandleSection());

    act(() => {
      result.current.handlers.setDepth(8);
    });

    expect(useDesignerStore.getState().params.handles.depth).toBe(8);
  });

  it('setFilletRadius updates fillet radius', () => {
    const { result } = renderHook(() => useHandleSection());

    act(() => {
      result.current.handlers.setFilletRadius(3);
    });

    expect(useDesignerStore.getState().params.handles.filletRadius).toBe(3);
  });

  it('summary reflects only enabled sides', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          front: { enabled: true },
          back: { enabled: false },
          left: { enabled: true },
          right: { enabled: false },
        },
      },
    });

    const { result } = renderHook(() => useHandleSection());
    const summary = result.current.meta.summary ?? '';
    expect(summary).toContain('Front');
    expect(summary).toContain('Left');
    expect(summary).not.toContain('Back');
    expect(summary).not.toContain('Right');
  });

  it('computes handleWidthMm from bin width and wall thickness', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true, width: 50 },
      },
    });

    const { result } = renderHook(() => useHandleSection());
    expect(result.current.state.handleWidthMm).toBeGreaterThan(0);
  });

  it('summary is undefined when handles disabled', () => {
    const { result } = renderHook(() => useHandleSection());
    expect(result.current.meta.summary).toBeUndefined();
  });

  it('summary lists active sides with depth', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          depth: 10,
        },
      },
    });

    const { result } = renderHook(() => useHandleSection());
    expect(result.current.meta.summary).toContain('10');
  });
});
