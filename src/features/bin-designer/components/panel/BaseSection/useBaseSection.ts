import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { resolveConstraints, getFeatureStatus } from '@/shared/constraints';
import { resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import {
  DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
  detachableFeetFitFloor,
  hasDetachableFeet as hasDetachableFeetFor,
} from '@/features/bin-designer/types/base';
import type {
  BinParams,
  FloorPatternType,
  FootLattice,
  LightweightMode,
  LidAttachment,
  LidRailSide,
  TrayBottomConfig,
  WallPatternType,
} from '@/features/bin-designer/types';
import { isPartialMask } from '@/shared/utils/cellMask';
import { isFractional } from '@/core/constants';
import {
  DEFAULT_FLOOR_PATTERN_CONFIG,
  DEFAULT_PATTERN_SCALE,
  DEFAULT_TRAY_BOTTOM,
  FLOOR_PATTERN_TYPES,
  isMagnetStyle,
  isScrewStyle,
} from '@/features/bin-designer/types';
import { assessFloorPatternFit } from '@/features/bin-designer/utils/floorPatternFit';
import { minHeightUnits } from '@/features/bin-designer/constants';
import {
  DEFAULT_FOOT_LATTICE,
  DEFAULT_LIGHTWEIGHT_MODE,
  isEffectiveTile,
  isSocketlessBase,
} from '@/features/bin-designer/types/base';
import { bodyTypeParams, deriveBodyType } from './bodyType';
import type { BodyType } from './bodyType';

/** Drop the `tile` key entirely — absent is the off state, never `false`. */
function omitTile(base: BinParams['base']): BinParams['base'] {
  const { tile: _tile, ...rest } = base;
  return rest;
}

/** Strip a `lightweightMode` that just restates the default. */
function omitDefaultLightweightMode(base: BinParams['base']): BinParams['base'] {
  const { lightweightMode: _mode, ...rest } = base;
  return rest;
}

/**
 * Strip the detachable-feet fields entirely.
 *
 * Omitting them from the constraint engine's patch is not enough: `mergeParams`
 * deep-merges `base`, so a key it never mentions simply survives. The fields
 * have to be absent rather than defaulted, because `params` is hashed wholesale
 * for the community fingerprint and a bin that ends up back where it started
 * must carry no trace of the visit.
 */
function omitDetachableFeet(base: BinParams['base']): BinParams['base'] {
  const { feet: _feet, feetPinDiameter: _pin, ...rest } = base;
  return rest;
}

/** Narrow a picker selection to the subset the floor supports. */
function isFloorPatternType(pattern: WallPatternType): pattern is FloorPatternType {
  return (FLOOR_PATTERN_TYPES as readonly WallPatternType[]).includes(pattern);
}

export function useBaseSection() {
  const t = useTranslation();
  const { params, updateBase, updateFloorPattern, setParams } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      updateBase: s.updateBase,
      updateFloorPattern: s.updateFloorPattern,
      setParams: s.setParams,
    }))
  );

  const base = params.base;
  const hasMagnet = isMagnetStyle(base.style);
  const hasScrew = isScrewStyle(base.style);
  const trayBottom = base.trayBottom ?? DEFAULT_TRAY_BOTTOM;
  const hasHalfSockets = base.halfSockets;
  // The foot lattice is inert in two cases, and the picker shows what the part
  // will actually be built with rather than the stored choice. The stored value
  // is left alone so it comes back when the blocker does.
  //  - half sockets on: uniform 0.5u feet already seat at either offset.
  //  - custom shape: the mask is authored against the standard grid, and the
  //    `half` lattice moves every interior boundary off it.
  //  - fractional axis: it already carries a half cell, and `fractionalEdge`
  //    decides which end that sits on, which covers both placements on its own.
  const bothAxesLockReason = hasHalfSockets
    ? 'binDesigner.footLattice.halfSocketsHint'
    : isPartialMask(params.cellMask)
      ? 'binDesigner.footLattice.customShapeHint'
      : null;
  const axisLocked = (units: number): boolean => bothAxesLockReason !== null || isFractional(units);
  const footLatticeLockedX = axisLocked(params.width);
  const footLatticeLockedY = axisLocked(params.depth);
  const footLatticeLockReason =
    bothAxesLockReason ??
    (footLatticeLockedX || footLatticeLockedY ? 'binDesigner.footLattice.fractionalHint' : null);
  // With both axes locked the control cannot act on anything, so it is dropped
  // rather than shown greyed, and `footLatticeInertReason` takes its slot to say
  // why. Nothing is concealed by dropping it: a locked axis reports the DEFAULT
  // lattice below, so there is never a stored customisation behind this that is
  // in force.
  const footLatticeInert = footLatticeLockedX && footLatticeLockedY;
  const footLatticeX = footLatticeLockedX
    ? DEFAULT_FOOT_LATTICE
    : (base.footLatticeX ?? DEFAULT_FOOT_LATTICE);
  const footLatticeY = footLatticeLockedY
    ? DEFAULT_FOOT_LATTICE
    : (base.footLatticeY ?? DEFAULT_FOOT_LATTICE);

  // ── Detachable feet ──────────────────────────────────────────────────────
  // The foot-shaping controls are SUPERSEDED, not contradicted: they describe
  // where integral feet fall, which this mode answers its own way. Locked with
  // a reason rather than through the constraint engine, whose mode switches
  // deliberately CLEAR what they disable — turning the toggle on would discard
  // a lightweight setting that turning it off again would not bring back.
  // The shared predicate, not `base.feet === 'detachable'`: it also refuses a
  // socketless base and a spacer, which is what the geometry does. The local
  // copy left a flat-base bin reading "4 feet" over a bin that builds none.
  const hasDetachableFeet = hasDetachableFeetFor(base);
  const detachablePlan = hasDetachableFeet ? resolveDetachableFeet(params) : null;
  // No pocket-aligned whole cell to stand a foot on. Reachable for a 1-wide bin
  // under the `half` lattice, and the panel has to say so: the alternative is a
  // bin that silently exports with no feet at all.
  const detachableUnplaceable = detachablePlan !== null && detachablePlan.placements.length === 0;
  const feetSupersedeReason = hasDetachableFeet ? 'binDesigner.detachableFeet.supersedes' : null;

  /**
   * What the feature is saving, as a ratio rather than a mass: the estimate is
   * SOLID volume, i.e. 100% infill, and the feet are the one chunky region of a
   * bin. An absolute figure would overstate the saving against what a slicer
   * reports; dividing cancels the error out.
   */
  const detachableSavingPercent = useMemo(() => {
    if (!hasDetachableFeet) return 0;
    const integral = estimatePrint({ ...params, base: omitDetachableFeet(base) }).volumeMm3;
    if (integral <= 0) return 0;
    return Math.round(((integral - estimatePrint(params).volumeMm3) / integral) * 100);
  }, [params, base, hasDetachableFeet]);

  // Feature statuses and disabled reasons from constraint engine
  const detachableFeetStatus = getFeatureStatus(params, 'base.detachableFeet');
  const magnetStatus = getFeatureStatus(params, 'base.magnet');
  const screwStatus = getFeatureStatus(params, 'base.screw');
  const halfSocketsStatus = getFeatureStatus(params, 'base.halfSockets');
  const lightweightStatus = getFeatureStatus(params, 'base.lightweight');

  const bodyType = deriveBodyType(base);

  // ── Which subsections this body has ──────────────────────────────────────
  // Asked of the constraint engine rather than answered by a body-type table:
  // the engine is what decides these pairings, so a rule added later moves the
  // UI with it and the two cannot drift. `available || enabled`, because a
  // feature the engine has just cleared must still show the row that turns it
  // back on, and a stale `enabled` without `available` would otherwise vanish
  // mid-edit.
  const applies = (status: { available: boolean; enabled: boolean }): boolean =>
    status.available || status.enabled;

  // A socketless base has no feet at all, which is geometry rather than a rule:
  // there is nothing for a lattice or a half socket to describe.
  const hasFeet = !isSocketlessBase(base.style);

  const floorPatternStatusForApplies = getFeatureStatus(params, 'floorPattern');

  const showMounting = applies(magnetStatus) || applies(screwStatus);
  const showFeet =
    hasFeet && (applies(detachableFeetStatus) || applies(halfSocketsStatus) || !footLatticeInert);
  const showFloor = applies(lightweightStatus) || applies(floorPatternStatusForApplies);

  /**
   * Why a family is not on offer, kept next to the heading rather than removing
   * the heading with it.
   *
   * The engine's own reason, never a restatement: the first feature in the
   * family that has one speaks for all of them, because on every body that
   * hides a family the same archetype is what disabled each of its features.
   * Restating it here would be a second source of truth for pairings `rules.ts`
   * already owns.
   */
  const familyReason = (...statuses: readonly { reason?: string }[]): string | undefined => {
    const found = statuses.find((status) => status.reason !== undefined);
    return found?.reason ? t(found.reason) : undefined;
  };

  const mountingUnavailable = showMounting ? undefined : familyReason(magnetStatus, screwStatus);
  const feetUnavailable = showFeet
    ? undefined
    : familyReason(halfSocketsStatus, detachableFeetStatus);
  const floorUnavailable = showFloor
    ? undefined
    : familyReason(lightweightStatus, floorPatternStatusForApplies);

  // Every base toggle commits through here. Only an effective spacer may stand
  // 1u tall, and several toggles can END one: leaving spacer mode, or
  // enabling the flat base, which auto-disables the spacer via CONSTRAINT_RULES.
  // Any of those would otherwise strand the bin under the ordinary floor, below
  // what the height stepper will even let the user climb back out of.
  //
  // The floor is read off the RESOLVED params, never the requested change: the
  // engine's post-check returns the params untouched when an enable turns out
  // to be blocked, and it computes that verdict against the patched params
  // rather than the `available` status each callback guarded on.
  const commit = useCallback(
    (resolved: BinParams) => {
      if (isEffectiveTile(resolved.base)) {
        // A base-only bin's height is inert (the wall is 0 and `assembledHeight`
        // supplies the real height from the slab), so it is pinned rather than
        // merely floored: two base-only bins
        // that differ only in a number nothing reads must not fingerprint
        // differently and defeat the community duplicate guard. The collar is
        // inert for the same reason — generation forces it to 0 there — so
        // it is dropped rather than left to drift the fingerprint.
        // Explicitly `undefined`, not omitted: `setParams` merges via
        // `Object.assign`, so leaving the key out would keep the stale value.
        // JSON serialisation drops an undefined-valued key, so the stored design
        // and its fingerprint come out the same as one that never had a collar.
        setParams({ ...resolved, height: 1, extraWallHeightMm: undefined });
        return;
      }
      // Off must end up ABSENT, not `false`. `resolveConstraints` writes
      // `tile: false` whenever a rule auto-disables base-only mode (switching to a
      // flat or lid base, enabling the spacer), and EVERY base toggle commits
      // through here — so stripping only inside `toggleTile` would still leave
      // the key behind on those paths and fingerprint an ordinary bin
      // differently from an identical one that never tried the mode.
      const withoutTile =
        'tile' in resolved.base ? { ...resolved, base: omitTile(resolved.base) } : resolved;
      // The relief mode gets the same treatment, for the same reason: 'interior'
      // is what an absent field already means, so writing it would fingerprint a
      // bin differently from an identical one whose owner never opened the
      // control. Stripped here rather than in `setLightweightMode` so no future
      // path can reintroduce it.
      const next =
        withoutTile.base.lightweightMode === 'interior'
          ? { ...withoutTile, base: omitDefaultLightweightMode(withoutTile.base) }
          : withoutTile;
      const minHeight = minHeightUnits(next.base, next.heightUnitMm);
      setParams(next.height < minHeight ? { ...next, height: minHeight } : next);
    },
    [setParams]
  );

  const magnetDisabledReason = magnetStatus.reason ? t(magnetStatus.reason) : undefined;
  const screwDisabledReason = screwStatus.reason ? t(screwStatus.reason) : undefined;
  // The supersede reason wins over the engine's: with detachable feet on, "not
  // used with these feet" is the true and useful answer, and the engine has no
  // rule to give here because the pairing is inert rather than forbidden.
  const halfSocketsDisabledReason = feetSupersedeReason
    ? t(feetSupersedeReason)
    : halfSocketsStatus.reason
      ? t(halfSocketsStatus.reason)
      : undefined;
  const lightweightDisabledReason = feetSupersedeReason
    ? t(feetSupersedeReason)
    : lightweightStatus.reason
      ? t(lightweightStatus.reason)
      : undefined;

  /**
   * Whether the underside relief would lift the block the toggle is reporting.
   *
   * Asked of the engine against a hypothetical `underside` selection rather
   * than matched against a list of fixable reasons. The mode-split pairs
   * (`scoop`, `cutouts`) already read `undersideReliefSelected` while the
   * feature is OFF, and a list would have to be revisited every time one is
   * added. Inserts stay mutual across both modes, so they correctly answer
   * false here and no fix is offered for them.
   */
  const undersideReliefUnblocks =
    !lightweightStatus.available &&
    !feetSupersedeReason &&
    getFeatureStatus(
      { ...params, base: { ...params.base, lightweightMode: 'underside' } },
      'base.lightweight'
    ).available;

  const toggleMagnet = useCallback(() => {
    // Only block enabling — allow disabling so users can recover from invalid states
    if (!hasMagnet && !magnetStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.magnet',
      enabled: !hasMagnet,
    });
    commit(resolved);
  }, [params, hasMagnet, magnetStatus.available, commit]);

  const toggleScrew = useCallback(() => {
    if (!hasScrew && !screwStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.screw',
      enabled: !hasScrew,
    });
    commit(resolved);
  }, [params, hasScrew, screwStatus.available, commit]);

  const toggleStackingLip = useCallback(() => {
    updateBase({ stackingLip: !base.stackingLip });
  }, [base.stackingLip, updateBase]);

  const toggleLightweight = useCallback(() => {
    if (!base.lightweight && !lightweightStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.lightweight',
      enabled: !base.lightweight,
    });
    commit(resolved);
  }, [params, base.lightweight, lightweightStatus.available, commit]);

  /**
   * Switch which side the lite floor opens from.
   *
   * Routed through the constraint engine rather than `updateBase` because the
   * mode decides three rule pairs: coming back to Interior with a finger scoop,
   * drainage holes or cutouts on has to clear them, exactly as enabling the
   * feature would. The change is applied first and then re-resolved as a no-op
   * toggle of `base.lightweight` — re-asserting its current value — so the
   * engine's protection for "the feature the user just enabled" keeps
   * lightweight itself on while the incompatible set is cleared around it.
   */
  const setLightweightMode = useCallback(
    (mode: LightweightMode) => {
      const withMode: BinParams = { ...params, base: { ...params.base, lightweightMode: mode } };
      const { params: resolved } = resolveConstraints(withMode, {
        feature: 'base.lightweight',
        enabled: withMode.base.lightweight,
      });
      commit(resolved);
    },
    [params, commit]
  );

  /**
   * Turn the lightweight floor on THROUGH the underside relief.
   *
   * Offered where the interior relief is blocked but the underside one is not,
   * which is the case `setLightweightMode` cannot serve: it re-asserts the
   * feature's current value, so on a bin where the toggle is the thing being
   * blocked it would switch the mode and leave the feature off.
   */
  const enableUndersideRelief = useCallback(() => {
    const withMode: BinParams = {
      ...params,
      base: { ...params.base, lightweightMode: 'underside' },
    };
    const { params: resolved } = resolveConstraints(withMode, {
      feature: 'base.lightweight',
      enabled: true,
    });
    commit(resolved);
  }, [params, commit]);

  /**
   * Switch the base's archetype.
   *
   * `commit` still runs: `bodyTypeParams` produces the resolved params, but the
   * height floor and the `tile: false` strip are this hook's job on every path.
   */
  const setBodyType = useCallback(
    (next: BodyType) => {
      commit(bodyTypeParams(params, next));
    },
    [params, commit]
  );

  const toggleHalfSockets = useCallback(() => {
    if (!hasHalfSockets && !halfSocketsStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.halfSockets',
      enabled: !hasHalfSockets,
    });
    commit(resolved);
  }, [params, hasHalfSockets, halfSocketsStatus.available, commit]);

  const setFootLatticeX = useCallback(
    (lattice: FootLattice) => {
      updateBase({ footLatticeX: lattice });
    },
    [updateBase]
  );

  const setFootLatticeY = useCallback(
    (lattice: FootLattice) => {
      updateBase({ footLatticeY: lattice });
    },
    [updateBase]
  );

  const updateTrayBottom = useCallback(
    (patch: Partial<TrayBottomConfig>) => {
      updateBase({ trayBottom: { ...trayBottom, ...patch } });
    },
    [updateBase, trayBottom]
  );

  const setTrayAttachment = useCallback(
    (attachment: LidAttachment) => updateTrayBottom({ attachment }),
    [updateTrayBottom]
  );

  const setTrayExtraHeight = useCallback(
    (extraHeightMm: number) => updateTrayBottom({ extraHeightMm }),
    [updateTrayBottom]
  );

  const toggleTrayRail = useCallback(
    (side: LidRailSide) =>
      updateTrayBottom({
        clickRails: { ...trayBottom.clickRails, [side]: !trayBottom.clickRails[side] },
      }),
    [updateTrayBottom, trayBottom]
  );

  // ── Floor pattern ────────────────────────────────────────────────
  // Drainage / ventilation holes through the floor slab and the feet below it.
  const floorPattern = params.floorPattern ?? DEFAULT_FLOOR_PATTERN_CONFIG;
  const floorPatternStatus = getFeatureStatus(params, 'floorPattern');
  const floorPatternDisabledReason = floorPatternStatus.reason
    ? t(floorPatternStatus.reason)
    : undefined;

  const toggleFloorPattern = useCallback(() => {
    if (!floorPattern.enabled && !floorPatternStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'floorPattern',
      enabled: !floorPattern.enabled,
    });
    commit(resolved);
  }, [params, floorPattern.enabled, floorPatternStatus.available, commit]);

  const setFloorPatternType = useCallback(
    (pattern: WallPatternType | null) => {
      // The picker's "none" entry is the off switch, so it has to route through
      // the constraint engine like the toggle rather than just clearing the type.
      if (pattern === null) {
        const { params: resolved } = resolveConstraints(params, {
          feature: 'floorPattern',
          enabled: false,
        });
        commit(resolved);
        return;
      }
      if (!isFloorPatternType(pattern)) return;
      updateFloorPattern({ pattern, enabled: true });
    },
    [params, commit, updateFloorPattern]
  );

  const setFloorPatternScale = useCallback(
    (percent: number) => updateFloorPattern({ scale: percent / 100 }),
    [updateFloorPattern]
  );

  const floorPatternFit = useMemo(() => assessFloorPatternFit(params), [params]);

  const setMagnetDiameter = useCallback(
    (diameter: number) => {
      updateBase({ magnetDiameter: diameter });
    },
    [updateBase]
  );

  const setMagnetHeight = useCallback(
    (depth: number) => {
      updateBase({ magnetDepth: depth });
    },
    [updateBase]
  );

  const setScrewDiameter = useCallback(
    (diameter: number) => {
      updateBase({ screwDiameter: diameter });
    },
    [updateBase]
  );

  const toggleDetachableFeet = useCallback(() => {
    if (!hasDetachableFeet && !detachableFeetStatus.available) return;
    const enabled = !hasDetachableFeet;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.detachableFeet',
      enabled,
    });
    commit(enabled ? resolved : { ...resolved, base: omitDetachableFeet(resolved.base) });
  }, [params, hasDetachableFeet, detachableFeetStatus.available, commit]);

  const setPinDiameter = useCallback(
    (diameter: number) => {
      updateBase({ feetPinDiameter: diameter });
    },
    [updateBase]
  );

  return {
    state: {
      base,
      hasDetachableFeet,
      pinDiameter: base.feetPinDiameter ?? DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
      detachableFootCount: detachablePlan?.placements.length ?? 0,
      detachableUnplaceable,
      detachableSavingPercent,
      hasMagnet,
      hasScrew,
      bodyType,
      trayBottom,
      hasHalfSockets,
      footLatticeX,
      footLatticeY,
      footLatticeLockedX,
      footLatticeLockedY,
      hasLightweight: base.lightweight,
      lightweightMode: base.lightweightMode ?? DEFAULT_LIGHTWEIGHT_MODE,
      undersideReliefUnblocks,
      // Which families of controls this body actually has. A hidden one is
      // never hiding a live setting: the engine clears what it disables.
      showMounting,
      showFeet,
      showFloor,
      // A family this body cannot have keeps its heading and says why, so a
      // control never simply vanishes between one body type and the next.
      mountingUnavailable,
      feetUnavailable,
      floorUnavailable,
      showFootLattice: hasFeet && !footLatticeInert,
      // Why the lattice is not on offer, rendered in the slot it would have
      // occupied. Half sockets is the only cause with a control in this section
      // (and it sits directly above, so the note still lands at its cause); a
      // custom shape and a fractional axis are decided over in Shape, where
      // there is nothing local to hang it off, so this note is the whole
      // explanation the user gets and must not be limited to the half-socket
      // case.
      footLatticeInertReason:
        hasFeet && footLatticeInert
          ? t(footLatticeLockReason ?? 'binDesigner.footLattice.hint')
          : undefined,
      floorPatternEnabled: floorPattern.enabled,
      floorPatternType: floorPattern.pattern,
      floorPatternScalePercent: Math.round((floorPattern.scale ?? DEFAULT_PATTERN_SCALE) * 100),
      floorPatternDoesNotFit: floorPattern.enabled && floorPatternFit === 'none',
    },
    handlers: {
      toggleDetachableFeet,
      setPinDiameter,
      // The floor gate is a parameter precondition, not a feature conflict, so
      // it is not a constraint rule (the engine forbids a rule that disables
      // its own source). Without it the toggle looks available and the worker
      // quietly declines to build any feet.
      detachableFeetDisabledReason: !detachableFeetFitFloor(params.wallThickness)
        ? t('binDesigner.detachableFeetNeedsThickerWall')
        : detachableFeetStatus.reason
          ? t(detachableFeetStatus.reason)
          : undefined,
      toggleMagnet,
      toggleScrew,
      toggleStackingLip,
      toggleLightweight,
      setLightweightMode,
      toggleHalfSockets,
      setFootLatticeX,
      setFootLatticeY,
      // Deliberately NOT locked by the feet: the lattice is the only thing that
      // seats a half-offset bin, detachable or not, so labelling it inert would
      // hide the one control that fixes a bin perching on the pocket ridges.
      // Half sockets and lightweight really are ignored and stay locked.
      footLatticeLockReason: t(footLatticeLockReason ?? 'binDesigner.footLattice.hint'),
      setBodyType,
      enableUndersideRelief,
      setTrayAttachment,
      setTrayExtraHeight,
      toggleTrayRail,
      setMagnetDiameter,
      setMagnetHeight,
      setScrewDiameter,
      toggleFloorPattern,
      setFloorPatternType,
      setFloorPatternScale,
      floorPatternDisabledReason,
      magnetDisabledReason,
      screwDisabledReason,
      halfSocketsDisabledReason,
      lightweightDisabledReason,
    },
  };
}
