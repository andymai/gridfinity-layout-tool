import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { BaseStyle } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import type { SectionMeta } from '../types';

/** Derive base style from individual magnet/screw/flat booleans */
function computeBaseStyle(
  magnet: boolean,
  screw: boolean,
  flat: boolean,
  currentStyle: BaseStyle
): BaseStyle {
  if (flat) return 'flat';
  if (!magnet && !screw && currentStyle === 'weighted') return 'weighted';
  if (magnet && screw) return 'magnet_and_screw';
  if (magnet) return 'magnet';
  if (screw) return 'screw';
  return 'standard';
}

export function useBaseSection() {
  const t = useTranslation();
  const { base, width, depth, updateBase } = useDesignerStore(
    useShallow((s) => ({
      base: s.params.base,
      width: s.params.width,
      depth: s.params.depth,
      updateBase: s.updateBase,
    }))
  );

  const hasMagnet = base.style === 'magnet' || base.style === 'magnet_and_screw';
  const hasScrew = base.style === 'screw' || base.style === 'magnet_and_screw';
  const isFlat = base.style === 'flat';
  const hasQuarterFeet = base.quarterFeet;

  // Quarter feet require bins >= 1×1 unit
  const minDimensionForQuarterFeet = 1.0;
  const canEnableQuarterFeet =
    !isFlat && width >= minDimensionForQuarterFeet && depth >= minDimensionForQuarterFeet;

  const flatDisabledReason = isFlat ? t('binDesigner.flatFloorDisablesAttachment') : undefined;
  const quarterFeetDisabledReason = isFlat
    ? t('binDesigner.flatFloorDisablesQuarterFeet')
    : !canEnableQuarterFeet
      ? t('binDesigner.quarterFeetRequires1x1')
      : undefined;

  const toggleMagnet = useCallback(() => {
    if (isFlat || hasQuarterFeet) return;
    const newMagnet = !hasMagnet;
    updateBase({ style: computeBaseStyle(newMagnet, hasScrew, false, base.style) });
  }, [base.style, hasMagnet, hasScrew, isFlat, hasQuarterFeet, updateBase]);

  const toggleScrew = useCallback(() => {
    if (isFlat || hasQuarterFeet) return;
    const newScrew = !hasScrew;
    updateBase({ style: computeBaseStyle(hasMagnet, newScrew, false, base.style) });
  }, [base.style, hasMagnet, hasScrew, isFlat, hasQuarterFeet, updateBase]);

  const toggleStackingLip = useCallback(() => {
    updateBase({ stackingLip: !base.stackingLip });
  }, [base.stackingLip, updateBase]);

  const toggleQuarterFeet = useCallback(() => {
    if (!canEnableQuarterFeet && !hasQuarterFeet) return;
    updateBase({ quarterFeet: !hasQuarterFeet });
  }, [hasQuarterFeet, canEnableQuarterFeet, updateBase]);

  const toggleFlat = useCallback(() => {
    const newFlat = !isFlat;
    updateBase({ style: computeBaseStyle(false, false, newFlat, base.style) });
  }, [base.style, isFlat, updateBase]);

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
      if (hasQuarterFeet) {
        summaryParts.push('Quarter feet');
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
    hasQuarterFeet,
    base.magnetDiameter,
    base.screwDiameter,
    base.stackingLip,
    t,
  ]);

  return {
    state: { base, hasMagnet, hasScrew, isFlat, hasQuarterFeet, canEnableQuarterFeet },
    handlers: {
      toggleMagnet,
      toggleScrew,
      toggleStackingLip,
      toggleQuarterFeet,
      toggleFlat,
      setMagnetRadius,
      setMagnetHeight,
      setScrewRadius,
      flatDisabledReason,
      quarterFeetDisabledReason,
    },
    meta,
  };
}
