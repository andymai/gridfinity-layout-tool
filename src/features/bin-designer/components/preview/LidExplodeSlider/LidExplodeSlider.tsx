/**
 * Canvas-chrome slider for separating the lid from the bin in the 3D
 * preview. Continuous 0–30mm: 0 = fully snapped, 30 = fully exploded.
 *
 * Replaces the older [×]Bin/[×]Lid/Snapped pill toggles with a single
 * control that conveys the docking relationship more clearly.
 */

import { useTranslation } from '@/i18n';
import { Slider } from '@/design-system/Slider';

/** Slider range in mm. 0 = snapped, max = fully exploded. */
export const LID_OFFSET_MIN = 0;
export const LID_OFFSET_MAX = 30;
/** Initial position when the lid is first enabled. */
export const LID_OFFSET_DEFAULT = 15;

interface LidExplodeSliderProps {
  value: number;
  onChange: (mm: number) => void;
}

export function LidExplodeSlider({ value, onChange }: LidExplodeSliderProps) {
  const t = useTranslation();
  const closedLabel = t('binDesigner.preview.lidClosed');
  const openLabel = t('binDesigner.preview.lidOpen');

  return (
    <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 rounded-full bg-surface-elevated/95 px-3 py-1.5 shadow-md backdrop-blur-sm">
        <span className="text-[11px] text-content-secondary">{closedLabel}</span>
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
        <span className="text-[11px] text-content-secondary">{openLabel}</span>
      </div>
    </div>
  );
}
