import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { resolveConstraints, getFeatureStatus } from '@/shared/constraints';
import { isMagnetStyle, isScrewStyle } from '@/features/bin-designer/types';
import type { FloorPatternType, WallPatternType } from '@/features/bin-designer/types';
import {
  DEFAULT_FLOOR_PATTERN_CONFIG,
  DEFAULT_PATTERN_SCALE,
  FLOOR_PATTERN_TYPES,
} from '@/features/bin-designer/types';
import { assessFloorPatternFit } from '@/features/bin-designer/utils/floorPatternFit';
import { minHeightUnits } from '@/features/bin-designer/constants';

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
  const hasHalfSockets = base.halfSockets;

  // Feature statuses and disabled reasons from constraint engine
  const magnetStatus = getFeatureStatus(params, 'base.magnet');
  const screwStatus = getFeatureStatus(params, 'base.screw');
  const flatStatus = getFeatureStatus(params, 'base.flat');
  const halfSocketsStatus = getFeatureStatus(params, 'base.halfSockets');
  const lightweightStatus = getFeatureStatus(params, 'base.lightweight');
  const spacerStatus = getFeatureStatus(params, 'base.spacer');

  const magnetDisabledReason = magnetStatus.reason ? t(magnetStatus.reason) : undefined;
  const screwDisabledReason = screwStatus.reason ? t(screwStatus.reason) : undefined;
  const flatDisabledReason = flatStatus.reason ? t(flatStatus.reason) : undefined;
  const halfSocketsDisabledReason = halfSocketsStatus.reason
    ? t(halfSocketsStatus.reason)
    : undefined;
  const lightweightDisabledReason = lightweightStatus.reason
    ? t(lightweightStatus.reason)
    : undefined;
  const spacerDisabledReason = spacerStatus.reason ? t(spacerStatus.reason) : undefined;

  const toggleMagnet = useCallback(() => {
    // Only block enabling — allow disabling so users can recover from invalid states
    if (!hasMagnet && !magnetStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.magnet',
      enabled: !hasMagnet,
    });
    setParams(resolved);
  }, [params, hasMagnet, magnetStatus.available, setParams]);

  const toggleScrew = useCallback(() => {
    if (!hasScrew && !screwStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.screw',
      enabled: !hasScrew,
    });
    setParams(resolved);
  }, [params, hasScrew, screwStatus.available, setParams]);

  const toggleStackingLip = useCallback(() => {
    updateBase({ stackingLip: !base.stackingLip });
  }, [base.stackingLip, updateBase]);

  const toggleLightweight = useCallback(() => {
    if (!base.lightweight && !lightweightStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.lightweight',
      enabled: !base.lightweight,
    });
    setParams(resolved);
  }, [params, base.lightweight, lightweightStatus.available, setParams]);

  const toggleSpacer = useCallback(() => {
    if (!base.spacer && !spacerStatus.available) return;
    const enabled = !base.spacer;
    const { params: resolved } = resolveConstraints(params, { feature: 'base.spacer', enabled });
    // Only a spacer may stand 1u tall (#2915), so leaving spacer mode has to
    // lift the height back to the normal floor rather than strand the bin
    // under it — the numeric bound is outside what the constraint engine,
    // which only enables and disables features, can express.
    const minHeight = minHeightUnits(enabled);
    setParams(resolved.height < minHeight ? { ...resolved, height: minHeight } : resolved);
  }, [params, base.spacer, spacerStatus.available, setParams]);

  const toggleHalfSockets = useCallback(() => {
    if (!hasHalfSockets && !halfSocketsStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.halfSockets',
      enabled: !hasHalfSockets,
    });
    setParams(resolved);
  }, [params, hasHalfSockets, halfSocketsStatus.available, setParams]);

  const toggleFlat = useCallback(() => {
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.flat',
      enabled: !isFlat,
    });
    setParams(resolved);
  }, [params, isFlat, setParams]);

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
    setParams(resolved);
  }, [params, floorPattern.enabled, floorPatternStatus.available, setParams]);

  const setFloorPatternType = useCallback(
    (pattern: WallPatternType | null) => {
      // The picker's "none" entry is the off switch, so it has to route through
      // the constraint engine like the toggle rather than just clearing the type.
      if (pattern === null) {
        const { params: resolved } = resolveConstraints(params, {
          feature: 'floorPattern',
          enabled: false,
        });
        setParams(resolved);
        return;
      }
      if (!isFloorPatternType(pattern)) return;
      updateFloorPattern({ pattern, enabled: true });
    },
    [params, setParams, updateFloorPattern]
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
      hasHalfSockets,
      hasLightweight: base.lightweight,
      isSpacer: base.spacer,
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
      halfSocketsDisabledReason,
      lightweightDisabledReason,
      toggleSpacer,
      spacerDisabledReason,
    },
  };
}
