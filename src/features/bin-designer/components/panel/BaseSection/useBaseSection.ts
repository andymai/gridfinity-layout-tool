import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { resolveConstraints, getFeatureStatus } from '@/shared/constraints';
import type { SectionMeta } from '../types';

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
    if (!magnetStatus.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'base.magnet',
      enabled: !hasMagnet,
    });
    setParams(resolved);
  }, [params, hasMagnet, magnetStatus.available, setParams]);

  const toggleScrew = useCallback(() => {
    if (!screwStatus.available) return;
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
    if (!halfSocketsStatus.available) return;
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

  const setMagnetRadius = useCallback(
    (radius: number) => {
      updateBase({ magnetDiameter: radius * 2 });
    },
    [updateBase]
  );

  const setMagnetHeight = useCallback(
    (depth: number) => {
      updateBase({ magnetDepth: depth });
    },
    [updateBase]
  );

  const setScrewRadius = useCallback(
    (radius: number) => {
      updateBase({ screwDiameter: radius * 2 });
    },
    [updateBase]
  );

  const meta: SectionMeta = useMemo(() => {
    const summaryParts: string[] = [];
    if (isFlat) {
      summaryParts.push(t('binDesigner.flatFloor'));
    } else {
      if (hasHalfSockets) {
        summaryParts.push('Half sockets');
      } else {
        if (hasMagnet) summaryParts.push(`${base.magnetDiameter}mm magnets`);
        if (hasScrew) summaryParts.push(`M${base.screwDiameter} screws`);
      }
    }
    if (base.stackingLip) summaryParts.push('Lip');
    const summary =
      summaryParts.length > 0 ? summaryParts.join(' \u2022 ') : 'Standard (no attachment)';
    return { summary };
  }, [
    hasMagnet,
    hasScrew,
    isFlat,
    hasHalfSockets,
    base.magnetDiameter,
    base.screwDiameter,
    base.stackingLip,
    t,
  ]);

  return {
    state: { base, hasMagnet, hasScrew, isFlat, hasHalfSockets },
    handlers: {
      toggleMagnet,
      toggleScrew,
      toggleStackingLip,
      toggleHalfSockets,
      toggleFlat,
      setMagnetRadius,
      setMagnetHeight,
      setScrewRadius,
      magnetDisabledReason,
      screwDisabledReason,
      flatDisabledReason,
      halfSocketsDisabledReason,
    },
    meta,
  };
}
