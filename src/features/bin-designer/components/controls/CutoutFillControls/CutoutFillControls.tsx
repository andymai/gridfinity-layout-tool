/**
 * Fill level for a cutout bin, shown in both cutout editors.
 *
 * One component rather than a slider in each, because the sidebar editor grew
 * the control and the workspace never did, which is what made a shipped feature
 * look like a missing one (#3697).
 *
 * The slider swaps which end it measures from rather than offering two numbers:
 * `topOffset` is the only stored value, so a second input would be a second
 * source of truth for one plane. The unselected reading is shown underneath so
 * the conversion is never a mystery.
 */

import { useShallow } from 'zustand/react/shallow';
import { Button, SliderInput } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CUTOUT_FILL_REFERENCES } from '@/features/bin-designer/types';
import {
  MIN_CUTOUT_FILL_MM,
  cutoutFillHeightMm,
  cutoutWallHeightMm,
  maxCutoutTopOffsetMm,
  topOffsetForFillHeight,
} from '@/features/bin-designer/utils/cutoutFill';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';

const STEP_MM = 0.5;

function fmt(mm: number): string {
  return `${Math.round(mm * 100) / 100}mm`;
}

export function CutoutFillControls() {
  const t = useTranslation();
  const { topOffset, fillReference, wallHeight } = useDesignerStore(
    useShallow((s) => ({
      topOffset: s.params.cutoutConfig.topOffset,
      fillReference: s.params.cutoutConfig.fillReference ?? 'rim',
      // Derived here rather than passed in, so the two editors cannot disagree
      // about the height the slider is bounded by.
      wallHeight: cutoutWallHeightMm(s.params),
    }))
  );
  const updateCutoutConfig = useDesignerStore((s) => s.updateCutoutConfig);

  const fillHeight = cutoutFillHeightMm(wallHeight, topOffset);
  const fromFloor = fillReference === 'floor';

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span className="block text-micro text-content-tertiary">
          {t('binDesigner.cutouts.fillMeasuredFrom')}
        </span>
        <div
          role="group"
          aria-label={t('binDesigner.cutouts.fillMeasuredFrom')}
          className="inline-flex gap-0.5 rounded-lg bg-surface-tertiary p-0.5"
        >
          {CUTOUT_FILL_REFERENCES.map((reference) => (
            <Button
              key={reference}
              type="button"
              variant="ghost"
              onClick={() => updateCutoutConfig({ fillReference: reference })}
              aria-pressed={reference === fillReference}
              className={`px-2 leading-none ${getSegmentClass(reference === fillReference)}`}
            >
              {reference === 'rim'
                ? t('binDesigner.cutouts.fillFromRim')
                : t('binDesigner.cutouts.fillFromFloor')}
            </Button>
          ))}
        </div>
      </div>

      {fromFloor ? (
        <SliderInput
          label={t('binDesigner.cutouts.fillHeight')}
          value={fillHeight}
          onChange={(next) =>
            updateCutoutConfig({ topOffset: topOffsetForFillHeight(wallHeight, next) })
          }
          min={MIN_CUTOUT_FILL_MM}
          max={wallHeight}
          step={STEP_MM}
          unit="mm"
          info={t('binDesigner.cutouts.fillBelowRim', { mm: fmt(topOffset) })}
        />
      ) : (
        <SliderInput
          label={t('binDesigner.cutouts.topOffset')}
          value={topOffset}
          onChange={(next) => updateCutoutConfig({ topOffset: next })}
          min={0}
          max={maxCutoutTopOffsetMm(wallHeight)}
          step={STEP_MM}
          unit="mm"
          info={t('binDesigner.cutouts.fillAboveFloor', { mm: fmt(fillHeight) })}
        />
      )}

      <p className="text-micro leading-relaxed text-content-disabled">
        {fromFloor ? t('binDesigner.cutouts.fillHintFloor') : t('binDesigner.cutouts.fillHintRim')}
      </p>
    </div>
  );
}
