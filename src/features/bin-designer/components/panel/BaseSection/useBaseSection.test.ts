import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBaseSection } from './useBaseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';

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

  it('toggleSpacer flips the boolean and clears the magnet it cannot hold', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } },
    });
    const { result } = renderHook(() => useBaseSection());

    expect(result.current.state.isSpacer).toBe(false);

    act(() => {
      result.current.handlers.toggleSpacer();
    });

    const base = useDesignerStore.getState().params.base;
    expect(base.spacer).toBe(true);
    // A floorless riser has nowhere for the magnet pad to stand.
    expect(base.style).toBe('standard');
    // ...but it keeps the lip, or nothing would seat on top of it.
    expect(base.stackingLip).toBe(true);
  });

  it('spacer stays selectable with a scoop present and clears it', () => {
    // A spacer is a mode switch, so it must be reachable from a designed bin.
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, scoop: { enabled: true, radius: 'auto' } },
    });
    const { result } = renderHook(() => useBaseSection());
    expect(result.current.handlers.spacerDisabledReason).toBeUndefined();

    act(() => {
      result.current.handlers.toggleSpacer();
    });
    expect(useDesignerStore.getState().params.base.spacer).toBe(true);
    expect(useDesignerStore.getState().params.scoop.enabled).toBe(false);
  });

  // #2915: only a spacer may stand 1u tall, so leaving the mode has to lift the
  // height back to the normal floor instead of stranding the bin under it.
  it('leaving spacer mode lifts a 1u height back to the bin minimum', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        height: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, spacer: true },
      },
    });
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleSpacer();
    });

    const params = useDesignerStore.getState().params;
    expect(params.base.spacer).toBe(false);
    expect(params.height).toBe(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
  });

  // The spacer can also END without touching its own toggle: a flat base
  // auto-disables it through CONSTRAINT_RULES, which would otherwise leave a 1u
  // bin below the floor its own stepper enforces.
  it('enabling the flat base on a 1u spacer lifts the height too', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        height: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, spacer: true },
      },
    });
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleFlat();
    });

    const params = useDesignerStore.getState().params;
    expect(params.base.style).toBe('flat');
    expect(params.base.spacer).toBe(false);
    expect(params.height).toBe(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
  });

  it('leaving spacer mode leaves a height already above the floor alone', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        height: 6,
        base: { ...DEFAULT_BIN_PARAMS.base, spacer: true },
      },
    });
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.toggleSpacer();
    });

    expect(useDesignerStore.getState().params.height).toBe(6);
  });

  it('spacer is greyed out with a reason on a flat base', () => {
    // The one genuine block: no feet for the spacer to open through.
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
    });
    const { result } = renderHook(() => useBaseSection());
    expect(result.current.handlers.spacerDisabledReason).toBeTruthy();

    act(() => {
      result.current.handlers.toggleSpacer();
    });
    expect(useDesignerStore.getState().params.base.spacer).toBe(false);
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

  describe('floor pattern', () => {
    it('starts disabled and turns on with a default hole shape', () => {
      const { result } = renderHook(() => useBaseSection());
      expect(result.current.state.floorPatternEnabled).toBe(false);

      act(() => {
        result.current.handlers.toggleFloorPattern();
      });

      expect(useDesignerStore.getState().params.floorPattern).toEqual({
        enabled: true,
        pattern: 'round',
        scale: 0.5,
      });
    });

    it('selecting a shape from the picker turns the feature on', () => {
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setFloorPatternType('honeycomb');
      });

      expect(useDesignerStore.getState().params.floorPattern).toMatchObject({
        enabled: true,
        pattern: 'honeycomb',
      });
    });

    it("selecting the picker's none entry turns the feature off", () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
        },
      });
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setFloorPatternType(null);
      });

      expect(useDesignerStore.getState().params.floorPattern?.enabled).toBe(false);
    });

    it('ignores a pattern the floor cannot tile', () => {
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setFloorPatternType('mitsukude');
      });

      expect(useDesignerStore.getState().params.floorPattern?.enabled).toBe(false);
    });

    it('turning drainage on clears the lightweight base', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true },
        },
      });
      const { result } = renderHook(() => useBaseSection());

      // The constraint engine refuses while lightweight owns the floor.
      expect(result.current.handlers.floorPatternDisabledReason).toBeDefined();
      act(() => {
        result.current.handlers.toggleFloorPattern();
      });
      expect(useDesignerStore.getState().params.floorPattern?.enabled).toBe(false);
    });

    it('scale is stored normalized but surfaced as a percentage', () => {
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setFloorPatternScale(80);
      });

      expect(useDesignerStore.getState().params.floorPattern?.scale).toBeCloseTo(0.8, 6);
    });
  });

  describe('lid-compatible bottom (#3036)', () => {
    it('toggleLidBottom switches the style and materialises the mating config', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleLidBottom());
      const { base } = useDesignerStore.getState().params;
      expect(base.style).toBe('lid');
      // Absent by default so an ordinary bin's params hash is untouched, so
      // selecting the style is what has to bring it into being.
      expect(base.trayBottom).toBeDefined();
      expect(base.trayBottom?.attachment).toBe('clickRails');
    });

    it('toggling back off returns to the standard base and leaves no residue', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleLidBottom());
      act(() => result.current.handlers.toggleLidBottom());
      const { base } = useDesignerStore.getState().params;
      expect(base.style).toBe('standard');
      // `params` is hashed wholesale, so a leftover `trayBottom` would make
      // this bin fingerprint differently from one that never tried the tray.
      expect('trayBottom' in base).toBe(false);
    });

    it('clears attachment hardware — there are no feet to drill', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } },
      });
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleLidBottom());
      expect(useDesignerStore.getState().params.base.style).toBe('lid');
    });

    it('is greyed out with a reason on a lightweight base', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true },
        },
      });
      const { result } = renderHook(() => useBaseSection());
      expect(result.current.handlers.lidBottomDisabledReason).toBeDefined();
    });

    it('edits the mating config without disturbing the rest of the base', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleLidBottom());
      act(() => result.current.handlers.setTrayExtraHeight(12));
      act(() => result.current.handlers.setTrayAttachment('magnetic'));
      const { base } = useDesignerStore.getState().params;
      expect(base.trayBottom?.extraHeightMm).toBe(12);
      expect(base.trayBottom?.attachment).toBe('magnetic');
      expect(base.stackingLip).toBe(DEFAULT_BIN_PARAMS.base.stackingLip);
    });

    it('toggles a single click rail side, leaving the others alone', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleLidBottom());
      act(() => result.current.handlers.toggleTrayRail('front'));
      const rails = useDesignerStore.getState().params.base.trayBottom?.clickRails;
      expect(rails?.front).toBe(false);
      expect(rails?.back).toBe(true);
      expect(rails?.left).toBe(true);
      expect(rails?.right).toBe(true);
    });
  });
});
