import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallCutoutsSection } from './useWallCutoutsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { useSettingsStore, DEFAULT_SETTINGS } from '@/core/store/settings';

describe('useWallCutoutsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
    // `linked` is a persisted user setting; reset the settings singleton so
    // state doesn't leak between tests, and clear the localStorage it writes
    // through so it can't bleed into other test files.
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
    localStorage.clear();
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

  it('setSideAlignment updates all active sides when linked', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideAlignment('left', 'right');
    });

    const { walls } = useDesignerStore.getState().params;
    expect(walls.left.alignment).toBe('right');
    expect(walls.right.alignment).toBe('right'); // synced
  });

  it('setSideAlignment updates only target side when unlinked', () => {
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
      result.current.handlers.setSideAlignment('left', 'left');
    });

    const { walls } = useDesignerStore.getState().params;
    expect(walls.left.alignment).toBe('left');
    expect(walls.right.alignment).toBe('center'); // unchanged
  });

  it('setSideOffset updates all active sides when linked', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideOffset('left', 5);
    });

    const { walls } = useDesignerStore.getState().params;
    expect(walls.left.offset).toBe(5);
    expect(walls.right.offset).toBe(5); // synced
  });

  it('setSideOffset clamps to ±50mm', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideOffset('left', 100);
    });

    expect(useDesignerStore.getState().params.walls.left.offset).toBe(50);
  });

  it('setSideWidthMm updates all active sides when linked', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideWidthMm('left', 30);
    });

    const { walls } = useDesignerStore.getState().params;
    expect(walls.left.widthMm).toBe(30);
    expect(walls.right.widthMm).toBe(30); // synced
  });

  it('setSideWidthMm sets null to switch back to percentage mode', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, widthMm: 30 },
        },
      },
    });

    const { result } = renderHook(() => useWallCutoutsSection());

    act(() => {
      result.current.handlers.setSideWidthMm('left', null);
    });

    expect(useDesignerStore.getState().params.walls.left.widthMm).toBeNull();
  });

  describe('interior auto-coupling on enable', () => {
    it('enables interior with matching dims on a multi-compartment bin', () => {
      // Feature off, bin has dividers (9 rows), default left/right at 70/50.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          compartments: { cols: 1, rows: 9, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
        },
      });

      const { result } = renderHook(() => useWallCutoutsSection());

      act(() => {
        result.current.handlers.toggleEnabled();
      });

      const { walls } = useDesignerStore.getState().params;
      expect(walls.enabled).toBe(true);
      expect(walls.interior.enabled).toBe(true);
      // Copied from the first active outer side (left = 70/50).
      expect(walls.interior.width).toBe(70);
      expect(walls.interior.depth).toBe(50);
    });

    it('does not enable interior on a single-compartment bin', () => {
      useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });

      const { result } = renderHook(() => useWallCutoutsSection());

      act(() => {
        result.current.handlers.toggleEnabled();
      });

      const { walls } = useDesignerStore.getState().params;
      expect(walls.enabled).toBe(true);
      expect(walls.interior.enabled).toBe(false);
    });

    it('does not resurrect interior the user explicitly disabled across a feature off/on cycle', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          compartments: { cols: 1, rows: 9, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
        },
      });

      const { result } = renderHook(() => useWallCutoutsSection());

      // Enable cutouts → interior auto-on.
      act(() => result.current.handlers.toggleEnabled());
      expect(useDesignerStore.getState().params.walls.interior.enabled).toBe(true);

      // User explicitly turns interior off.
      act(() => result.current.handlers.toggleSide('interior'));
      expect(useDesignerStore.getState().params.walls.interior.enabled).toBe(false);

      // Toggle the whole feature off, then back on.
      act(() => result.current.handlers.toggleEnabled());
      act(() => result.current.handlers.toggleEnabled());

      // Interior must stay off — the auto-coupling must not override the
      // user's explicit choice.
      expect(useDesignerStore.getState().params.walls.interior.enabled).toBe(false);
    });

    it('does not re-enable interior the user already disabled when toggling the feature off', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          compartments: { cols: 1, rows: 9, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
          walls: {
            ...DEFAULT_BIN_PARAMS.walls,
            enabled: true,
            interior: DEFAULT_BIN_PARAMS.walls.interior,
          },
        },
      });

      const { result } = renderHook(() => useWallCutoutsSection());

      act(() => {
        result.current.handlers.toggleEnabled(); // disabling — must not touch interior
      });

      expect(useDesignerStore.getState().params.walls.enabled).toBe(false);
      expect(useDesignerStore.getState().params.walls.interior.enabled).toBe(false);
    });
  });

  describe('linked state persistence', () => {
    it('persists linked toggle to user settings', () => {
      const { result } = renderHook(() => useWallCutoutsSection());

      act(() => {
        result.current.handlers.toggleLinked();
      });

      expect(useSettingsStore.getState().settings.wallCutoutsLinked).toBe(false);
    });

    it('reads persisted linked state on a fresh mount', () => {
      useSettingsStore.setState({
        settings: { ...DEFAULT_SETTINGS, wallCutoutsLinked: false },
      });

      const { result } = renderHook(() => useWallCutoutsSection());
      expect(result.current.state.linked).toBe(false);
    });
  });

  describe('density hint', () => {
    it('flags the hint when cutouts are on and the bin is dense', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          compartments: { cols: 1, rows: 5, thickness: 1.2, cells: [0, 1, 2, 3, 4] },
          walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
        },
      });

      const { result } = renderHook(() => useWallCutoutsSection());
      expect(result.current.state.showDensityHint).toBe(true);
    });

    it('does not flag the hint below the density threshold', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          compartments: { cols: 1, rows: 4, thickness: 1.2, cells: [0, 1, 2, 3] },
          walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
        },
      });

      const { result } = renderHook(() => useWallCutoutsSection());
      expect(result.current.state.showDensityHint).toBe(false);
    });

    it('does not flag the hint when wall cutouts are disabled', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          compartments: { cols: 1, rows: 9, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
        },
      });

      const { result } = renderHook(() => useWallCutoutsSection());
      expect(result.current.state.showDensityHint).toBe(false);
    });
  });
});
