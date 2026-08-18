import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBaseSection } from './useBaseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { isMagnetStyle, isScrewStyle } from '@/features/bin-designer/types';
import { hasDetachableFeet } from '@/features/bin-designer/types/base';
import { BODY_TYPES } from './bodyType';
import type { BinParams } from '@/features/bin-designer/types';

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

  it('the spacer card flips the boolean and clears the magnet it cannot hold', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } },
    });
    const { result } = renderHook(() => useBaseSection());

    expect(result.current.state.bodyType).toBe('standard');

    act(() => {
      result.current.handlers.setBodyType('spacer');
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

    act(() => {
      result.current.handlers.setBodyType('spacer');
    });
    expect(useDesignerStore.getState().params.base.spacer).toBe(true);
    expect(useDesignerStore.getState().params.scoop.enabled).toBe(false);
  });

  // Only a spacer may stand 1u tall, so leaving the mode has to lift the
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
      result.current.handlers.setBodyType('standard');
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
      result.current.handlers.setBodyType('flat');
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
      result.current.handlers.setBodyType('standard');
    });

    expect(useDesignerStore.getState().params.height).toBe(6);
  });

  it('reaches the spacer from a flat base, which used to be blocked', () => {
    // The archetypes were mutually exclusive toggles, so a flat base reported
    // "a spacer needs feet to open through" and refused. Selecting a body type
    // clears the outgoing one first, so the pair is a switch rather than a
    // conflict and the explanation has nothing left to explain.
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
    });
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setBodyType('spacer');
    });

    const base = useDesignerStore.getState().params.base;
    expect(base.spacer).toBe(true);
    expect(base.style).toBe('standard');
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
    // Blocked: scoop must be cleared first — in the INTERIOR mode. See the
    // underside case below, where selecting the mode is what unblocks it.
    expect(useDesignerStore.getState().params.base.lightweight).toBe(false);
  });

  // The relief mode is the one control in this panel that has to work while its
  // feature is OFF: it decides whether the toggle can be turned on at all.
  it('selecting the underside mode unblocks lightweight for a scooped bin', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, scoop: { enabled: true, radius: 'auto' } },
    });
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setLightweightMode('underside');
    });
    expect(result.current.handlers.lightweightDisabledReason).toBeUndefined();

    act(() => {
      result.current.handlers.toggleLightweight();
    });
    const params = useDesignerStore.getState().params;
    expect(params.base.lightweight).toBe(true);
    // ...and the scoop it was blocked over survives, which is the point.
    expect(params.scoop.enabled).toBe(true);
  });

  // Switching BACK has to clear what the interior mode cannot carry, exactly as
  // enabling the feature would — which is why the handler re-resolves through
  // the constraint engine instead of writing the field directly.
  it('switching back to the interior mode clears the scoop', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true, lightweightMode: 'underside' },
      },
    });
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setLightweightMode('interior');
    });
    const params = useDesignerStore.getState().params;
    expect(params.scoop.enabled).toBe(false);
    // The feature itself stays on — the engine protects the feature being
    // re-asserted, so the mode switch is not a back-door way to turn it off.
    expect(params.base.lightweight).toBe(true);
  });

  // 'interior' is what an absent field already means, so writing it would
  // fingerprint a bin differently from an identical one whose owner never
  // opened the control (the `base.tile` precedent).
  it('leaves no lightweightMode residue when the default is selected', () => {
    const { result } = renderHook(() => useBaseSection());

    act(() => {
      result.current.handlers.setLightweightMode('underside');
    });
    expect(useDesignerStore.getState().params.base.lightweightMode).toBe('underside');

    act(() => {
      result.current.handlers.setLightweightMode('interior');
    });
    expect(useDesignerStore.getState().params.base.lightweightMode).toBeUndefined();
    // State still reports the effective mode, so the control stays selected.
    expect(result.current.state.lightweightMode).toBe('interior');
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
      result.current.handlers.setBodyType('flat');
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
    it('derives the body type from base style', () => {
      const { result } = renderHook(() => useBaseSection());

      expect(result.current.state.bodyType).toBe('standard');
    });

    it('selecting the flat body sets style to flat', () => {
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setBodyType('flat');
      });

      expect(useDesignerStore.getState().params.base.style).toBe('flat');
      expect(result.current.state.bodyType).toBe('flat');
    });

    it('going back to standard reverts the style', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        },
      });

      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setBodyType('standard');
      });

      expect(useDesignerStore.getState().params.base.style).toBe('standard');
      expect(result.current.state.bodyType).toBe('standard');
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

    it('drops the Mounting subsection on a body with nowhere to put hardware', () => {
      const { result: standard } = renderHook(() => useBaseSection());
      expect(standard.current.state.showMounting).toBe(true);

      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
      });
      const { result: flat } = renderHook(() => useBaseSection());

      // A flat base has no socket for a magnet or screw pocket, so the rows
      // are absent rather than present-and-greyed.
      expect(flat.current.state.showMounting).toBe(false);
      expect(flat.current.state.showFeet).toBe(false);
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
      act(() => result.current.handlers.setBodyType('tray'));
      const { base } = useDesignerStore.getState().params;
      expect(base.style).toBe('lid');
      // Absent by default so an ordinary bin's params hash is untouched, so
      // selecting the style is what has to bring it into being.
      expect(base.trayBottom).toBeDefined();
      expect(base.trayBottom?.attachment).toBe('clickRails');
    });

    it('toggling back off returns to the standard base and leaves no residue', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.setBodyType('tray'));
      act(() => result.current.handlers.setBodyType('standard'));
      const { base } = useDesignerStore.getState().params;
      expect(base.style).toBe('standard');
      // `params` is hashed wholesale, so a leftover `trayBottom` would make
      // this bin fingerprint differently from one that never tried base-only mode.
      expect('trayBottom' in base).toBe(false);
    });

    it('clears attachment hardware — there are no feet to drill', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } },
      });
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.setBodyType('tray'));
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
      expect(result.current.state.bodyType).not.toBe('tray');
    });

    it('edits the mating config without disturbing the rest of the base', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.setBodyType('tray'));
      act(() => result.current.handlers.setTrayExtraHeight(12));
      act(() => result.current.handlers.setTrayAttachment('magnetic'));
      const { base } = useDesignerStore.getState().params;
      expect(base.trayBottom?.extraHeightMm).toBe(12);
      expect(base.trayBottom?.attachment).toBe('magnetic');
      expect(base.stackingLip).toBe(DEFAULT_BIN_PARAMS.base.stackingLip);
    });

    it('toggles a single click rail side, leaving the others alone', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.setBodyType('tray'));
      act(() => result.current.handlers.toggleTrayRail('front'));
      const rails = useDesignerStore.getState().params.base.trayBottom?.clickRails;
      expect(rails?.front).toBe(false);
      expect(rails?.back).toBe(true);
      expect(rails?.left).toBe(true);
      expect(rails?.right).toBe(true);
    });
  });
});

// Regression ( review): `resolveConstraints` writes `tile: false`
// whenever a rule auto-disables base-only mode, and EVERY base toggle commits through
// `commit` — so stripping only inside `toggleTile` left the key behind on the
// flat/lid/spacer paths and fingerprinted an ordinary bin differently from an
// identical one that never tried the mode.
describe('useBaseSection — base-only bin residue', () => {
  // Own reset: this block sits outside the suite above, so it would otherwise
  // inherit whatever base the previous test left behind and the toggle would
  // no-op on its availability guard.
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('leaves no tile key behind when the flat base auto-disables base-only mode', () => {
    const { result } = renderHook(() => useBaseSection());
    act(() => result.current.handlers.setBodyType('tile'));
    expect(useDesignerStore.getState().params.base.tile).toBe(true);

    act(() => result.current.handlers.setBodyType('flat'));
    const base = useDesignerStore.getState().params.base;
    expect(base.style).toBe('flat');
    expect('tile' in base).toBe(false);
  });

  // On a tile both floor features are engine-disabled, but the underside
  // relief lifts the block — so the family must stay on screen or the one
  // control that can unblock it is unmounted (the pre-restructure layout
  // rendered the mode picker unconditionally for exactly this reason).
  it('keeps the Floor family on screen when only the underside relief can unblock it', () => {
    const { result } = renderHook(() => useBaseSection());
    act(() => result.current.handlers.setBodyType('tile'));
    expect(result.current.state.undersideReliefUnblocks).toBe(true);
    expect(result.current.state.showFloor).toBe(true);
  });

  it('drops the inert collar when entering base-only mode', () => {
    useDesignerStore.getState().setParams({
      ...useDesignerStore.getState().params,
      extraWallHeightMm: 6,
    });
    const { result } = renderHook(() => useBaseSection());
    act(() => result.current.handlers.setBodyType('tile'));
    const params = useDesignerStore.getState().params;
    expect(params.base.tile).toBe(true);
    // Generation forces the collar to 0 there, so carrying the value would
    // only drift the fingerprint.
    expect(params.extraWallHeightMm).toBeUndefined();
    expect(params.height).toBe(1);
  });

  describe('detachable feet', () => {
    it('toggling on selects the mode', () => {
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleDetachableFeet());
      expect(useDesignerStore.getState().params.base.feet).toBe('detachable');
    });

    it('toggling off DELETES the keys rather than defaulting them', () => {
      // `params` is hashed wholesale for the community fingerprint, so a bin
      // that ends up back where it started must carry no trace of the visit.
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleDetachableFeet());
      act(() => result.current.handlers.setPinDiameter(2.9));
      act(() => result.current.handlers.toggleDetachableFeet());
      const base = useDesignerStore.getState().params.base;
      expect('feet' in base).toBe(false);
      expect('feetPinDiameter' in base).toBe(false);
    });

    it('locks the settings it supersedes, without clearing them', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true } },
      });
      const { result } = renderHook(() => useBaseSection());
      act(() => result.current.handlers.toggleDetachableFeet());

      expect(result.current.handlers.lightweightDisabledReason).toBeDefined();
      expect(result.current.handlers.halfSocketsDisabledReason).toBeDefined();
      // Still stored, so turning the mode off brings it back.
      expect(useDesignerStore.getState().params.base.lightweight).toBe(true);
    });

    it('reports a saving once the mode is on', () => {
      const { result } = renderHook(() => useBaseSection());
      expect(result.current.state.detachableSavingPercent).toBe(0);
      act(() => result.current.handlers.toggleDetachableFeet());
      expect(result.current.state.detachableSavingPercent).toBeGreaterThan(20);
      expect(result.current.state.detachableFootCount).toBeGreaterThan(0);
    });

    it('says so when no whole cell can take a foot', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          width: 1,
          depth: 4,
          base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable', footLatticeX: 'half' },
        },
      });
      const { result } = renderHook(() => useBaseSection());
      expect(result.current.state.detachableUnplaceable).toBe(true);
      expect(result.current.state.detachableFootCount).toBe(0);
    });

    it('is refused on a spacer', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, spacer: true } },
      });
      const { result } = renderHook(() => useBaseSection());
      expect(result.current.handlers.detachableFeetDisabledReason).toBeDefined();
      act(() => result.current.handlers.toggleDetachableFeet());
      expect(useDesignerStore.getState().params.base.feet).toBeUndefined();
    });
  });

  // The one invariant the subsection hiding must not break. A family that is
  // hidden while something inside it is still ON leaves a live setting the user
  // can neither see nor switch off, which is strictly worse than the greyed row
  // the hiding replaced.
  describe('hiding never conceals a live setting', () => {
    /** Every base feature on at once, so each switch has something to strand. */
    const everythingOn: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet_and_screw',
        halfSockets: true,
        lightweight: true,
      },
      floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
    };

    it.each(BODY_TYPES)('holds when switching to %s', (type) => {
      useDesignerStore.setState({ params: everythingOn });
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setBodyType(type);
      });

      const { params } = useDesignerStore.getState();
      const { state } = result.current;

      if (isMagnetStyle(params.base.style) || isScrewStyle(params.base.style)) {
        expect(state.showMounting).toBe(true);
      }
      if (params.base.halfSockets || hasDetachableFeet(params.base)) {
        expect(state.showFeet).toBe(true);
      }
      if (params.base.lightweight || params.floorPattern?.enabled) {
        expect(state.showFloor).toBe(true);
      }
    });

    // Dropping a family's controls without saying why is the confusing version
    // of hiding: the setting was cleared either way, so the sentence is all the
    // user has. A silently missing family is the failure this guards.
    it.each(BODY_TYPES)('names every family it drops on %s', (type) => {
      useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setBodyType(type);
      });

      const { state } = result.current;
      if (!state.showMounting) expect(state.mountingUnavailable).toBeTruthy();
      if (!state.showFeet) expect(state.feetUnavailable).toBeTruthy();
      if (!state.showFloor) expect(state.floorUnavailable).toBeTruthy();
    });

    it('never hides a foot lattice that is actually in force', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, footLatticeX: 'half', footLatticeY: 'half' },
        },
      });
      const { result } = renderHook(() => useBaseSection());

      // The effective lattice is what gets built. Whenever it differs from the
      // default the control has to be on screen, because a wrong lattice leaves
      // the bin perched on the ridges between baseplate pockets.
      const effectiveIsCustom =
        result.current.state.footLatticeX !== 'grid' ||
        result.current.state.footLatticeY !== 'grid';
      expect(effectiveIsCustom).toBe(true);
      expect(result.current.state.showFootLattice).toBe(true);
    });

    it('reports the default lattice whenever it hides the control', () => {
      // Half sockets make the lattice inert, so it is hidden. That is only safe
      // because the stored `half` is overridden: nothing customised is in force.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, footLatticeX: 'half' },
        },
      });
      const { result } = renderHook(() => useBaseSection());

      expect(result.current.state.showFootLattice).toBe(false);
      expect(result.current.state.footLatticeX).toBe('grid');
      expect(result.current.state.footLatticeY).toBe('grid');
    });
  });

  // `base` is hashed wholesale for the community fingerprint, so a key left
  // behind by a visit to another body type would make a bin fingerprint
  // differently from an identical one that never went there. The three keys the
  // picker materialises (`trayBottom`, `tile`, `lightweightMode`) are the ones
  // that can leak, and each is stripped on a different path.
  describe('body type round trip', () => {
    it.each(BODY_TYPES.filter((t) => t !== 'standard'))(
      'leaves the base config byte-identical after standard to %s and back',
      (type) => {
        useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
        const before = JSON.stringify(useDesignerStore.getState().params.base);
        const { result } = renderHook(() => useBaseSection());

        act(() => {
          result.current.handlers.setBodyType(type);
        });
        act(() => {
          result.current.handlers.setBodyType('standard');
        });

        expect(JSON.stringify(useDesignerStore.getState().params.base)).toBe(before);
      }
    );

    // What the round trip does NOT restore, recorded so the next change to this
    // area can tell an intended loss from a new one. Both predate the picker and
    // come from the constraint engine and the base-only commit path, which the
    // four toggles routed through identically. The picker makes them easier to
    // reach, not different.
    it('does not restore what the engine cleared on the way in', () => {
      useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setBodyType('spacer');
      });
      act(() => {
        result.current.handlers.setBodyType('standard');
      });

      // A spacer has no interior, so the engine clears the divider slots; coming
      // back does not put them there again.
      expect(useDesignerStore.getState().params.slotConfig.x.enabled).toBe(false);
    });

    // Switching body type CLEARS whatever the new body cannot hold, and the
    // subsection holding it is then hidden, so undo is the only way back. It is
    // what makes the hiding recoverable rather than destructive.
    it('is undoable, restoring both the archetype and what it cleared', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } },
      });
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setBodyType('flat');
      });
      expect(useDesignerStore.getState().params.base.style).toBe('flat');

      act(() => {
        useDesignerStore.getState().undo();
      });

      expect(useDesignerStore.getState().params.base.style).toBe('magnet');
    });

    it('leaves a base-only bin at the height floor rather than its original height', () => {
      useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, height: 6 } });
      const { result } = renderHook(() => useBaseSection());

      act(() => {
        result.current.handlers.setBodyType('tile');
      });
      act(() => {
        result.current.handlers.setBodyType('standard');
      });

      // A base-only bin pins height to 1 because the wall is inert there, and
      // leaving lifts to the minimum rather than to the 6u it came from.
      expect(useDesignerStore.getState().params.height).toBe(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
    });
  });
});
