import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { isMagnetStyle, isScrewStyle } from '@/features/bin-designer/types';
import { deriveBodyType } from '../panel/BaseSection/bodyType';
import type { BodyType } from '../panel/BaseSection/bodyType';

/** Card titles, mirroring `BodyTypeCards` so the summary names what is chosen. */
const BODY_TYPE_KEY: Record<BodyType, string> = {
  standard: 'binDesigner.base.bodyType.standard',
  flat: 'binDesigner.flatFloor',
  spacer: 'binDesigner.spacer',
  tile: 'binDesigner.tile',
  tray: 'binDesigner.lidBottom',
};

/**
 * Read-only summary for the Base group when collapsed.
 *
 * Leads with the body type, because that is the one setting here that changes
 * what the part IS. A spacer read as "Standard (no attachment)" before, which
 * described neither its body nor the drainage holes through it.
 */
export function useBaseGroupSummary(): string {
  const t = useTranslation();
  const { base, floorPatternEnabled } = useDesignerStore(
    useShallow((s) => ({
      base: s.params.base,
      floorPatternEnabled: s.params.floorPattern?.enabled ?? false,
    }))
  );

  return useMemo(() => {
    const parts: string[] = [t(BODY_TYPE_KEY[deriveBodyType(base)])];

    if (isMagnetStyle(base.style)) {
      parts.push(t('binDesigner.base.summary.magnets', { diameter: base.magnetDiameter }));
    }
    if (isScrewStyle(base.style)) {
      parts.push(t('binDesigner.base.summary.screws', { diameter: base.screwDiameter }));
    }
    if (base.stackingLip) parts.push(t('assembledHeight.stackingLip'));
    if (base.lightweight) parts.push(t('binDesigner.lightweight'));
    if (floorPatternEnabled) parts.push(t('binDesigner.base.floorPattern'));

    return parts.join(' · ');
  }, [base, floorPatternEnabled, t]);
}
