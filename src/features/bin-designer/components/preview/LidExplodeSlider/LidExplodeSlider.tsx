/**
 * Canvas-chrome slider for separating the lid from the bin in the 3D
 * preview. Continuous 0–80mm: 0 = fully snapped, max = fully exploded.
 *
 * Replaces the older [×]Bin/[×]Lid/Snapped pill toggles with a single
 * control that conveys the docking relationship more clearly. Positioned
 * in the bottom-right of the preview to avoid overlapping the camera/
 * wireframe/color toolbar at top-right; matches that toolbar's pill
 * styling so the two read as a single control surface.
 */

import { useTranslation } from '@/i18n';
import { Slider } from '@/design-system/Slider';

/** Slider range in mm. 0 = snapped, max = fully exploded. */
export const LID_OFFSET_MIN = 0;
export const LID_OFFSET_MAX = 80;
/** Initial position when the lid is first enabled. */
export const LID_OFFSET_DEFAULT = 30;

interface LidExplodeSliderProps {
  value: number;
  onChange: (mm: number) => void;
}

export function LidExplodeSlider({ value, onChange }: LidExplodeSliderProps) {
  const t = useTranslation();
  const closedLabel = t('binDesigner.preview.lidClosed');
  const openLabel = t('binDesigner.preview.lidOpen');

  return (
    <div className="absolute right-2 bottom-2 flex items-center gap-2 rounded-lg bg-surface-elevated/80 px-2.5 py-1.5 shadow-sm backdrop-blur">
      <span className="text-[11px] font-medium text-content-secondary">{closedLabel}</span>
      <div className="w-32">
        <Slider
          value={value}
          onChange={onChange}
          min={LID_OFFSET_MIN}
          max={LID_OFFSET_MAX}
          step={1}
          aria-label={t('binDesigner.preview.lidExplodeSlider')}
          aria-valuetext={`${value}mm`}
        />
      </div>
      <span className="text-[11px] font-medium text-content-secondary">{openLabel}</span>
    </div>
  );
}
