import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { resolveConstraints, getFeatureStatus } from '@/shared/constraints';
import type {
  BinParams,
  FloorPatternType,
  LidAttachment,
  LidRailSide,
  TrayBottomConfig,
  WallPatternType,
} from '@/features/bin-designer/types';
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
import { isEffectiveTile } from '@/features/bin-designer/types/base';

/** Drop the `tile` key entirely — absent is the off state, never `false`. */
function omitTile(base: BinParams['base']): BinParams['base'] {
  const { tile: _tile, ...rest } = base;
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
  const isFlat = base.style === 'flat';
  const isLidBottom = base.style === 'lid';
  const trayBottom = base.trayBottom ?? DEFAULT_TRAY_BOTTOM;
  const hasHalfSockets = base.halfSockets;

  // Feature statuses and disabled reasons from constraint engine
  const magnetStatus = getFeatureStatus(params, 'base.magnet');
  const screwStatus = getFeatureStatus(params, 'base.screw');
  const flatStatus = getFeatureStatus(params, 'base.flat');
  const halfSocketsStatus = getFeatureStatus(params, 'base.halfSockets');
  const lightweightStatus = getFeatureStatus(params, 'base.lightweight');
  const spacerStatus = getFeatureStatus(params, 'base.spacer');
  const tileStatus = getFeatureStatus(params, 'base.tile');
  const lidBottomStatus = getFeatureStatus(params, 'base.lid');

  // Every base toggle commits through here. Only an effective spacer may stand
  // 1u tall (#2915), and several toggles can END one: leaving spacer mode, or
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
        // A tray's height is inert (the wall is 0 and `assembledHeight` supplies
        // the real 9.3mm), so it is pinned rather than merely floored: two trays
        // that differ only in a number nothing reads must not fingerprint
        // differently and defeat the community duplicate guard. The collar is
        // inert for the same reason — generation forces it to 0 on a tray — so
        // it is dropped rather than left to drift the fingerprint.
        // Explicitly `undefined`, not omitted: `setParams` merges via
        // `Object.assign`, so leaving the key out would keep the stale value.
        // JSON serialisation drops an undefined-valued key, so the stored design
        // and its fingerprint come out the same as one that never had a collar.
        setParams({ ...resolved, height: 1, extraWallHeightMm: undefined });
        return;
      }
      // Off must end up ABSENT, not `false`. `resolveConstraints` writes
      // `tile: false` whenever a rule auto-disables the tray (switching to a
      // flat or lid base, enabling the spacer), and EVERY base toggle commits
      // through here — so stripping only inside `toggleTile` would still leave
      // the key behind on those paths and fingerprint an ordinary bin
      // differently from an identical one that never tried the mode.
      const next =
        'tile' in resolved.base ? { ...resolved, base: omitTile(resolved.base) } : resolved;
      const minHeight = minHeightUnits(next.base);
      setParams(next.height < minHeight ? { ...next, height: minHeight } : next);
    },
    [setParams]
  );

  const magnetDisabledReason = magnetStatus.reason ? t(magnetStatus.reason) : undefined;
  const screwDisabledReason = screwStatus.reason ? t(screwStatus.reason) : undefined;
  const flatDisabledReason = flatStatus.reason ? t(flatStatus.reason) : undefined;
  const halfSocketsDisabledReason = halfSocketsStatus.reason
    ? t(halfSocketsStatus.reason)
    : undefined;
  const lidBottomDisabledReason = lidBottomStatus.reason ? t(lidBottomStatus.reason) : undefined;
  const lightweightDisabledReason = lightweightStatus.reason
    ? t(lightweightStatus.reason)
    : undefined;
  const spacerDisabledReason = spacerStatus.reason ? t(spacerStatus.reason) : undefined;
  const tileDisabledReason = tileStatus.reason ? t(tileStatus.reason) : undefined;

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

  const toggleSpacer = useCallback(() => {
    if (!base.spacer && !spacerStatus.available) return;
    commit(resolveConstraints(params, { feature: 'base.spacer', enabled: !base.spacer }).params);
  }, [params, base.spacer, spacerStatus.available, commit]);

  const toggleTile = useCallback(() => {
    const isTile = base.tile === true;
    if (!isTile && !tileStatus.available) return;
    // `commit` strips a `tile: false` residue on every path, this one included.
    commit(resolveConstraints(params, { feature: 'base.tile', enabled: !isTile }).params);
  }, [params, base.tile, tileStatus.available, commit]);

  const toggleHalfSockets = useCallback(() => {
    if (!hasHalfSockets && !halfSocketsStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.halfSockets',
      enabled: !hasHalfSockets,
    });
    commit(resolved);
  }, [params, hasHalfSockets, halfSocketsStatus.available, commit]);

  const toggleLidBottom = useCallback(() => {
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.lid',
      enabled: !isLidBottom,
    });
    // The mating config is materialised on the way in and STRIPPED on the way
    // out. It is absent by default so an ordinary bin's params hash is
    // unchanged (see `DEFAULT_BIN_PARAMS`) — leaving a residue behind would
    // make a bin that once tried the tray bottom fingerprint differently from
    // an identical one that never did, defeating the point of the omission.
    const { trayBottom: _dropped, ...baseWithoutTray } = resolved.base;
    commit({
      ...resolved,
      base:
        resolved.base.style === 'lid'
          ? { ...resolved.base, trayBottom: resolved.base.trayBottom ?? DEFAULT_TRAY_BOTTOM }
          : baseWithoutTray,
    });
  }, [params, isLidBottom, commit]);

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

  const toggleFlat = useCallback(() => {
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.flat',
      enabled: !isFlat,
    });
    commit(resolved);
  }, [params, isFlat, commit]);

  // ── Floor pattern (#2816) ────────────────────────────────────────────────
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

  return {
    state: {
      base,
      hasMagnet,
      hasScrew,
      isFlat,
      isLidBottom,
      trayBottom,
      hasHalfSockets,
      hasLightweight: base.lightweight,
      isSpacer: base.spacer,
      isTile: base.tile === true,
      floorPatternEnabled: floorPattern.enabled,
      floorPatternType: floorPattern.pattern,
      floorPatternScalePercent: Math.round((floorPattern.scale ?? DEFAULT_PATTERN_SCALE) * 100),
      floorPatternDoesNotFit: floorPattern.enabled && floorPatternFit === 'none',
    },
    handlers: {
      toggleMagnet,
      toggleScrew,
      toggleStackingLip,
      toggleLightweight,
      toggleHalfSockets,
      toggleFlat,
      toggleLidBottom,
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
      flatDisabledReason,
      lidBottomDisabledReason,
      halfSocketsDisabledReason,
      lightweightDisabledReason,
      toggleSpacer,
      spacerDisabledReason,
      toggleTile,
      tileDisabledReason,
    },
  };
}
