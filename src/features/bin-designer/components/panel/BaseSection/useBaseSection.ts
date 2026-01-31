import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { BaseStyle } from '@/features/bin-designer/types';
import type { SectionMeta } from '../types';

/** Derive base style from individual magnet/screw booleans */
function computeBaseStyle(magnet: boolean, screw: boolean, currentStyle: BaseStyle): BaseStyle {
  if (!magnet && !screw && currentStyle === 'weighted') return 'weighted';
  if (magnet && screw) return 'magnet_and_screw';
  if (magnet) return 'magnet';
  if (screw) return 'screw';
  return 'standard';
}

export function useBaseSection() {
  const { base, updateBase } = useDesignerStore(
    useShallow((s) => ({
      base: s.params.base,
      updateBase: s.updateBase,
    }))
  );

  const hasMagnet = base.style === 'magnet' || base.style === 'magnet_and_screw';
  const hasScrew = base.style === 'screw' || base.style === 'magnet_and_screw';

  const toggleMagnet = useCallback(() => {
    const newMagnet = !hasMagnet;
    updateBase({ style: computeBaseStyle(newMagnet, hasScrew, base.style) });
  }, [base.style, hasMagnet, hasScrew, updateBase]);

  const toggleScrew = useCallback(() => {
    const newScrew = !hasScrew;
    updateBase({ style: computeBaseStyle(hasMagnet, newScrew, base.style) });
  }, [base.style, hasMagnet, hasScrew, updateBase]);

  const toggleStackingLip = useCallback(() => {
    updateBase({ stackingLip: !base.stackingLip });
  }, [base.stackingLip, updateBase]);

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
    if (hasMagnet) summaryParts.push(`${base.magnetDiameter}mm magnets`);
    if (hasScrew) summaryParts.push(`M${base.screwDiameter} screws`);
    if (base.stackingLip) summaryParts.push('Lip');
    const summary =
      summaryParts.length > 0 ? summaryParts.join(' \u2022 ') : 'Standard (no attachment)';
    return { summary };
  }, [hasMagnet, hasScrew, base.magnetDiameter, base.screwDiameter, base.stackingLip]);

  return {
    state: { base, hasMagnet, hasScrew },
    handlers: {
      toggleMagnet,
      toggleScrew,
      toggleStackingLip,
      setMagnetRadius,
      setMagnetHeight,
      setScrewRadius,
    },
    meta,
  };
}
