import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallCutoutsSection } from './useWallCutoutsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useWallCutoutsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns disabled state by default', () => {
    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.state.walls.enabled).toBe(false);
  });

  it('toggleEnabled enables wall cutouts', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleEnabled();
    });

    expect(useDesignerStore.getState().params.walls.enabled).toBe(true);
  });

  it('toggleEnabled disables wall cutouts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleEnabled();
    });

    expect(useDesignerStore.getState().params.walls.enabled).toBe(false);
  });

  it('setGlobalWidth updates width', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setGlobalWidth(80);
    });

    expect(useDesignerStore.getState().params.walls.width).toBe(80);
  });

  it('setGlobalWidth clamps to 0-100', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setGlobalWidth(150);
    });
    expect(useDesignerStore.getState().params.walls.width).toBe(100);

    act(() => {
      result.current.handlers.setGlobalWidth(-10);
    });
    expect(useDesignerStore.getState().params.walls.width).toBe(0);
  });

  it('setGlobalDepth updates depth', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setGlobalDepth(60);
    });

    expect(useDesignerStore.getState().params.walls.depth).toBe(60);
  });

  it('toggleSide enables a side with global defaults', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true, width: 80, depth: 40 },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleSide('front');
    });

    const frontConfig = useDesignerStore.getState().params.walls.front;
    expect(frontConfig.enabled).toBe(true);
    expect(frontConfig.width).toBe(80);
    expect(frontConfig.depth).toBe(40);
  });

  it('toggleSide disables a side and clears overrides', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { enabled: true, width: 60, depth: 30 },
        },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleSide('front');
    });

    const frontConfig = useDesignerStore.getState().params.walls.front;
    expect(frontConfig.enabled).toBe(false);
    expect(frontConfig.width).toBe(0);
    expect(frontConfig.depth).toBe(0);
  });

  it('setSideWidth updates side width', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideWidth('back', 45);
    });

    expect(useDesignerStore.getState().params.walls.back.width).toBe(45);
  });

  it('setSideDepth updates side depth', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideDepth('left', 90);
    });

    expect(useDesignerStore.getState().params.walls.left.depth).toBe(90);
  });

  it('activeSideCount reflects enabled sides', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { enabled: true, width: 70, depth: 50 },
          back: { enabled: true, width: 70, depth: 50 },
          left: { enabled: false, width: 0, depth: 0 },
          right: { enabled: false, width: 0, depth: 0 },
          interior: { enabled: false, width: 0, depth: 0 },
        },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.state.activeSideCount).toBe(2);
  });

  it('disabledReason set when style is solid', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'solid' },
    });

    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.meta.disabledReason).toBeDefined();
  });

  it('no disabledReason when style is standard', () => {
    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.meta.disabledReason).toBeUndefined();
  });

  it('summary is undefined when wall cutouts disabled', () => {
    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.meta.summary).toBeUndefined();
  });

  it('summary shows dimensions when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.meta.summary).toContain('70%');
    expect(result.current.meta.summary).toContain('50%');
  });

  it('toggleSide for interior works correctly', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true, width: 70, depth: 50 },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleSide('interior');
    });

    const interior = useDesignerStore.getState().params.walls.interior;
    expect(interior.enabled).toBe(true);
    expect(interior.width).toBe(70);
    expect(interior.depth).toBe(50);
  });
});
