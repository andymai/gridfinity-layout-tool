/**
 * Board-level settings for swappable-label plates: the printer fit offset,
 * what the plan resolved to, and the plate preview/export.
 *
 * Shown only once a cutout asks for a socket, and reads the same
 * `label.plateFitOffset` the compartment sockets use, because the offset describes
 * one printer, not one kind of bin, so a maker who calibrated it on a gridded
 * bin does not calibrate it again for a board.
 */

import { Collapsible, InfoIcon, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  LABEL_PLATE_FIT_OFFSET_MAX,
  LABEL_PLATE_FIT_OFFSET_MIN,
  LABEL_PLATE_FIT_OFFSET_STEP,
} from '@/shared/constants/labelPlates';
import {
  MAX_CUTOUT_LABEL_SOCKETS,
  useCutoutSocketPlan,
} from '@/features/bin-designer/hooks/useCutoutSocketPlan';
import { LabelFitSampleButton } from '../panel/LabelTabsSection/LabelFitSampleButton';
import { LabelPlatesControls } from '../panel/LabelTabsSection/LabelPlatesControls';

export function CutoutPlateSettings() {
  const t = useTranslation();
  const plan = useCutoutSocketPlan();
  const plateFitOffset = useDesignerStore((s) => s.params.label.plateFitOffset ?? 0);
  const updateLabel = useDesignerStore((s) => s.updateLabel);

  const hasSockets = plan.socketCount > 0 || plan.skippedCount > 0;
  if (!hasSockets) return null;

  const setOffset = (value: number) => {
    updateLabel({ plateFitOffset: value });
  };
  const step = (delta: number) => {
    const next = plateFitOffset + delta * LABEL_PLATE_FIT_OFFSET_STEP;
    const clamped = Math.min(
      LABEL_PLATE_FIT_OFFSET_MAX,
      Math.max(LABEL_PLATE_FIT_OFFSET_MIN, next)
    );
    setOffset(Math.round(clamped * 100) / 100);
  };

  return (
    <div className="space-y-3 border-t border-stroke-subtle pt-3">
      <span className="block text-micro font-semibold uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.cutoutSocket.boardSection')}
      </span>

      <p className="text-label text-content-secondary">
        {t(
          plan.socketCount === 1
            ? 'binDesigner.cutoutSocket.socketCount.one'
            : 'binDesigner.cutoutSocket.socketCount.other',
          { n: plan.socketCount }
        )}
      </p>
      {plan.skippedCount > 0 && (
        <p role="status" className="text-label text-warning">
          {t('binDesigner.cutoutSocket.skippedCount', {
            n: plan.skippedCount,
            max: MAX_CUTOUT_LABEL_SOCKETS,
          })}
        </p>
      )}

      <Collapsible title={t('binDesigner.plateFitGroup')} size="sm">
        <div className="min-w-0">
          <span className="mb-1 flex items-center gap-1 text-xs font-medium text-content-secondary">
            {t('binDesigner.plateFitOffset')}
            <span title={t('binDesigner.plateFitOffsetHint')} className="inline-flex">
              <InfoIcon size="xs" className="text-content-tertiary" />
            </span>
          </span>
          <Stepper
            value={plateFitOffset}
            onChange={setOffset}
            onStep={step}
            min={LABEL_PLATE_FIT_OFFSET_MIN}
            max={LABEL_PLATE_FIT_OFFSET_MAX}
            step={LABEL_PLATE_FIT_OFFSET_STEP}
            // Two decimals, or the default one-decimal rendering shows every
            // 0.05 step as its 0.1 neighbour and the control reads as stuck.
            inputDecimals={2}
            size="md"
            aria-label={t('binDesigner.plateFitOffset')}
          />
        </div>
        <LabelFitSampleButton />
        <LabelPlatesControls />
      </Collapsible>
    </div>
  );
}
