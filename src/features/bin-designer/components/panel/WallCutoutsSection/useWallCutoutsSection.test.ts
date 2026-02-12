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

  it('toggleSide enables a side with default 70/50', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { enabled: false, width: 0, depth: 0 },
          right: { enabled: false, width: 0, depth: 0 },
        },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleSide('front');
    });

    const frontConfig = useDesignerStore.getState().params.walls.front;
    expect(frontConfig.enabled).toBe(true);
    expect(frontConfig.width).toBe(70);
    expect(frontConfig.depth).toBe(50);
  });

  it('toggleSide copies linked values when other sides are active', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { enabled: true, width: 80, depth: 40 },
          right: { enabled: false, width: 0, depth: 0 },
        },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());
    // linked=true by default, so new side should copy from left
    act(() => {
      result.current.handlers.toggleSide('front');
    });

    const frontConfig = useDesignerStore.getState().params.walls.front;
    expect(frontConfig.enabled).toBe(true);
    expect(frontConfig.width).toBe(80);
    expect(frontConfig.depth).toBe(40);
  });

  it('toggleSide disables a side and clears values', () => {
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

  it('setSideWidth updates all active sides when linked', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());
    // Default: left+right active, linked=true
    act(() => {
      result.current.handlers.setSideWidth('left', 45);
    });

    const { walls } = useDesignerStore.getState().params;
    expect(walls.left.width).toBe(45);
    expect(walls.right.width).toBe(45); // synced
  });

  it('setSideWidth updates only target side when unlinked', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleLinked(); // unlink
    });
    act(() => {
      result.current.handlers.setSideWidth('left', 45);
    });

    const { walls } = useDesignerStore.getState().params;
    expect(walls.left.width).toBe(45);
    expect(walls.right.width).toBe(70); // unchanged
  });

  it('setSideDepth updates all active sides when linked', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideDepth('left', 90);
    });

    const { walls } = useDesignerStore.getState().params;
    expect(walls.left.depth).toBe(90);
    expect(walls.right.depth).toBe(90); // synced
  });

  it('activeSides reflects enabled sides', () => {
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
    expect(result.current.state.activeSides).toEqual(['front', 'back']);
  });

  it('starts in linked mode by default', () => {
    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.state.linked).toBe(true);
  });

  it('toggleLinked switches between linked and independent', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleLinked();
    });
    expect(result.current.state.linked).toBe(false);

    act(() => {
      result.current.handlers.toggleLinked();
    });
    expect(result.current.state.linked).toBe(true);
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

  it('summary lists active side names with values', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());
    expect(result.current.state.activeSides).toEqual(['left', 'right']);
    expect(result.current.meta.summary).toContain('70');
    expect(result.current.meta.summary).toContain('50');
  });

  it('toggleSide for interior works correctly', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.toggleSide('interior');
    });

    const interior = useDesignerStore.getState().params.walls.interior;
    expect(interior.enabled).toBe(true);
    // Linked mode: copies from first active side (left: 70/50)
    expect(interior.width).toBe(70);
    expect(interior.depth).toBe(50);
  });

  it('setShape updates wall cutout shape', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setShape('funnel');
    });

    expect(useDesignerStore.getState().params.walls.shape).toBe('funnel');
  });

  it('setShape updates to scoop shape', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setShape('scoop');
    });

    expect(useDesignerStore.getState().params.walls.shape).toBe('scoop');
  });

  it('setShape updates to u-shape', () => {
    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setShape('u-shape');
    });

    expect(useDesignerStore.getState().params.walls.shape).toBe('u-shape');
  });
});
