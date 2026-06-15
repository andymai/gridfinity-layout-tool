import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBaseSection } from './useBaseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useBaseSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('derives hasMagnet and hasScrew from base style', () => {
    const { result } = renderHook(() => useBaseSection());

    // Default: standard style
    expect(result.current.state.hasMagnet).toBe(false);
    expect(result.current.state.hasScrew).toBe(false);
  });

  it('toggleMagnet sets style to magnet', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleMagnet();
    });

    expect(useDesignerStore.getState().params.base.style).toBe('magnet');
  });

  it('toggleScrew sets style to screw', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleScrew();
    });

    expect(useDesignerStore.getState().params.base.style).toBe('screw');
  });

  it('toggling both sets magnet_and_screw', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleMagnet();
    });
    act(() => {
      result.current.handlers.toggleScrew();
    });

    expect(useDesignerStore.getState().params.base.style).toBe('magnet_and_screw');
  });

  it('toggleStackingLip flips the boolean', () => {
    const { result } = renderHook(() => useBaseSection());

    // Default: stackingLip = true
    expect(useDesignerStore.getState().params.base.stackingLip).toBe(true);

    act(() => {
      result.current.handlers.toggleStackingLip();
    });

    expect(useDesignerStore.getState().params.base.stackingLip).toBe(false);
  });

  it('setMagnetDiameter updates magnetDiameter directly', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setMagnetDiameter(6.5);
    });

    expect(useDesignerStore.getState().params.base.magnetDiameter).toBe(6.5);
  });

  it('toggleLightweight flips the boolean and exposes it as state', () => {
    const { result } = renderHook(() => useBaseSection());

    expect(result.current.state.hasLightweight).toBe(false);

    act(() => {
      result.current.handlers.toggleLightweight();
    });

    expect(useDesignerStore.getState().params.base.lightweight).toBe(true);
    expect(result.current.state.hasLightweight).toBe(true);
  });

  it('lightweight coexists with magnet style (allow-all, no constraint clearing)', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleLightweight();
    });
    act(() => {
      result.current.handlers.toggleMagnet();
    });

    const base = useDesignerStore.getState().params.base;
    expect(base.lightweight).toBe(true);
    expect(base.style).toBe('magnet');
  });

  it('lightweight is greyed out with a reason when a scoop is present', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, scoop: { enabled: true, radius: 'auto' } },
    });
    const { result } = renderHook(() => useBaseSection());
    expect(result.current.handlers.lightweightDisabledReason).toBeTruthy();

    act(() => {
      result.current.handlers.toggleLightweight();
    });
    // Blocked: scoop must be cleared first.
    expect(useDesignerStore.getState().params.base.lightweight).toBe(false);
  });

  it('lightweight stays selectable with leftover cutouts after leaving solid mode', () => {
    // Cutouts persist as inert data once the bin returns to a cavity style; they
    // must not block re-selecting lightweight (regression: deadlock — couldn't
    // enable lightweight to clear them because they blocked it).
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'standard', cutouts: [{ id: 'c1' } as never] },
    });
    const { result } = renderHook(() => useBaseSection());
    expect(result.current.handlers.lightweightDisabledReason).toBeUndefined();

    act(() => {
      result.current.handlers.toggleLightweight();
    });

    const p = useDesignerStore.getState().params;
    expect(p.base.lightweight).toBe(true);
    // Enabling lightweight clears the dormant cutouts via the reverse rule.
    expect(p.cutouts).toEqual([]);
  });

  it('cutouts still block lightweight in solid mode', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, style: 'solid', cutouts: [{ id: 'c1' } as never] },
    });
    const { result } = renderHook(() => useBaseSection());
    expect(result.current.handlers.lightweightDisabledReason).toBeTruthy();
  });

  it('enabling flat clears lightweight (mutually exclusive — flat has no socket)', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true } },
    });
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleFlat();
    });

    const base = useDesignerStore.getState().params.base;
    expect(base.style).toBe('flat');
    expect(base.lightweight).toBe(false);
  });

  it('lightweight is greyed out with a reason on a flat base', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
    });
    const { result } = renderHook(() => useBaseSection());
    expect(result.current.handlers.lightweightDisabledReason).toBeTruthy();

    act(() => {
      result.current.handlers.toggleLightweight();
    });
    // Blocked: can't enable lightweight on a flat base.
    expect(useDesignerStore.getState().params.base.lightweight).toBe(false);
  });

  it('setScrewDiameter updates screwDiameter directly', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setScrewDiameter(4.0);
    });

    expect(useDesignerStore.getState().params.base.screwDiameter).toBe(4.0);
  });

  describe('flat floor', () => {
    it('derives isFlat from base style', () => {
      const { result } = renderHook(() => useBaseSection());

      // Default: standard style, not flat
      expect(result.current.state.isFlat).toBe(false);
    });

    it('toggleFlat sets style to flat', () => {
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleFlat();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('flat');
      expect(result.current.state.isFlat).toBe(true);
    });

    it('toggleFlat off reverts to standard', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleFlat();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('standard');
      expect(result.current.state.isFlat).toBe(false);
    });

    it('flat disables magnet and screw', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      expect(result.current.state.hasMagnet).toBe(false);
      expect(result.current.state.hasScrew).toBe(false);
      // In the constraint system, blocked features own their own disabled reasons
      expect(result.current.handlers.magnetDisabledReason).toBeDefined();
      expect(result.current.handlers.screwDisabledReason).toBeDefined();
    });

    it('toggleMagnet is a no-op when flat', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleMagnet();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('flat');
    });

    it('toggleScrew is a no-op when flat', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.toggleScrew();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('flat');
    });

    it('flatDisabledReason is undefined when not flat', () => {
      const { result } = renderHook(() => useBaseSection());

      expect(result.current.handlers.flatDisabledReason).toBeUndefined();
    });
  });
});
