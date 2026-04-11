import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { resolveConstraints, getFeatureStatus } from '@/shared/constraints';

export function useBaseSection() {
  const t = useTranslation();
  const { params, updateBase, setParams } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      updateBase: s.updateBase,
      setParams: s.setParams,
    }))
  );

  const base = params.base;
  const hasMagnet = base.style === 'magnet' || base.style === 'magnet_and_screw';
  const hasScrew = base.style === 'screw' || base.style === 'magnet_and_screw';
  const isFlat = base.style === 'flat';
  const hasHalfSockets = base.halfSockets;

  // Feature statuses and disabled reasons from constraint engine
  const magnetStatus = getFeatureStatus(params, 'base.magnet');
  const screwStatus = getFeatureStatus(params, 'base.screw');
  const flatStatus = getFeatureStatus(params, 'base.flat');
  const halfSocketsStatus = getFeatureStatus(params, 'base.halfSockets');

  const magnetDisabledReason = magnetStatus.reason ? t(magnetStatus.reason) : undefined;
  const screwDisabledReason = screwStatus.reason ? t(screwStatus.reason) : undefined;
  const flatDisabledReason = flatStatus.reason ? t(flatStatus.reason) : undefined;
  const halfSocketsDisabledReason = halfSocketsStatus.reason
    ? t(halfSocketsStatus.reason)
    : undefined;

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
    state: { base, hasMagnet, hasScrew, isFlat, hasHalfSockets },
    handlers: {
      toggleMagnet,
      toggleScrew,
      toggleStackingLip,
      toggleHalfSockets,
      toggleFlat,
      setMagnetDiameter,
      setMagnetHeight,
      setScrewDiameter,
      magnetDisabledReason,
      screwDisabledReason,
      flatDisabledReason,
      halfSocketsDisabledReason,
    },
  };
}
