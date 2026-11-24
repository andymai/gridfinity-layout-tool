/**
 * Cradle for a rectangle pocket: its floor becomes an arc across the width, so
 * a can or a bottle lies in it on its side.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { isCradle } from '@/features/bin-designer/types';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { cradleArc } from '@/shared/utils/cutoutCradle';
import { useTranslation } from '@/i18n';

export interface CutoutCradleControlsProps {
  /** The cutout with any live preview override merged, so the radius tracks a drag. */
  readonly cutout: Cutout;
  /** Fill left above the floor; the worker cuts no deeper, so neither does the arc. */
  readonly maxCutDepth: number;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
  readonly disabled?: boolean;
}

export function CutoutCradleControls({
  cutout,
  maxCutDepth,
  onUpdate,
  disabled = false,
}: CutoutCradleControlsProps) {
  const t = useTranslation();
  if (cutout.shape !== 'rectangle') return null;
  const on = isCradle(cutout);
  const depth = Math.min(cutout.cutDepth, maxCutDepth);
  return (
    <div className="space-y-1">
      <FeatureToggle
        label={t('binDesigner.cutouts.cradle')}
        info={t('binDesigner.cutouts.cradleDetail')}
        checked={on}
        onChange={() => onUpdate({ cradle: on ? undefined : true })}
        disabled={disabled}
      />
      {on && depth > 0 && cutout.width > 0 && (
        <p className="text-micro text-content-tertiary">
          {t('binDesigner.cutouts.cradleRadius', {
            radius: cradleArc(cutout.width, depth).radius.toFixed(1),
          })}
        </p>
      )}
    </div>
  );
}
