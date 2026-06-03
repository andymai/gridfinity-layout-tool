/**
 * Parametric-array controls: turn a single cutout into a grid / staggered /
 * radial array, tune its layout, and flatten it back to independent cutouts.
 * The master cutout drives every instance; only the layout lives in `array`.
 */

import type { Cutout, CutoutArrayMode, CutoutArrayConfig } from '@/features/bin-designer/types';
import { CUTOUT_ARRAY_MODES, MAX_ARRAY_COUNT } from '@/features/bin-designer/types';
import { arrayInstanceCount, defaultArrayConfig } from '@/shared/utils/cutoutArray';
import { useTranslation } from '@/i18n';
import { Checkbox } from '@/design-system';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { SliderInput } from '../../controls/SliderInput';

interface CutoutArrayControlsProps {
  readonly cutout: Cutout;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
  readonly onFlatten: () => void;
  readonly disabled?: boolean;
}

export function CutoutArrayControls({
  cutout,
  onUpdate,
  onFlatten,
  disabled = false,
}: CutoutArrayControlsProps) {
  const t = useTranslation();
  const array = cutout.array;

  const setArray = (patch: Partial<CutoutArrayConfig>): void => {
    if (!array) return;
    onUpdate({ array: { ...array, ...patch } });
  };

  if (!array) {
    return (
      <button
        type="button"
        className="w-full rounded border border-stroke-subtle bg-surface-elevated px-2 py-1.5 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
        onClick={() => onUpdate({ array: defaultArrayConfig(cutout.width, cutout.depth) })}
        disabled={disabled}
      >
        {t('binDesigner.cutouts.array.create')}
      </button>
    );
  }

  const count = arrayInstanceCount(array);

  return (
    <div className="space-y-1.5">
      {/* Mode segmented control */}
      <div className={SEGMENT_GROUP_CLASS}>
        {CUTOUT_ARRAY_MODES.map((mode: CutoutArrayMode) => (
          <button
            key={mode}
            type="button"
            className={`${getSegmentClass(array.mode === mode, { size: 'sm' })} flex-1`}
            onClick={() => setArray({ mode })}
            disabled={disabled}
          >
            {t(`binDesigner.cutouts.array.mode.${mode}`)}
          </button>
        ))}
      </div>

      {array.mode === 'radial' ? (
        <>
          <SliderInput
            label={t('binDesigner.cutouts.array.count')}
            value={array.count}
            onChange={(v) => setArray({ count: v })}
            min={1}
            max={MAX_ARRAY_COUNT}
            step={1}
            disabled={disabled}
          />
          <SliderInput
            label={t('binDesigner.cutouts.array.radius')}
            value={array.radius}
            onChange={(v) => setArray({ radius: v })}
            min={1}
            max={200}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <SliderInput
            label={t('binDesigner.cutouts.array.startAngle')}
            value={array.startAngle}
            onChange={(v) => setArray({ startAngle: v })}
            min={0}
            max={359}
            step={1}
            unit="°"
            disabled={disabled}
          />
          <label className="flex items-center gap-2 text-xs text-content-secondary">
            <Checkbox
              checked={array.rotateToCenter}
              onChange={(c) => setArray({ rotateToCenter: c })}
              disabled={disabled}
              aria-label={t('binDesigner.cutouts.array.rotateToCenter')}
            />
            {t('binDesigner.cutouts.array.rotateToCenter')}
          </label>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <SliderInput
              label={t('binDesigner.cutouts.array.cols')}
              value={array.cols}
              onChange={(v) => setArray({ cols: v })}
              min={1}
              max={MAX_ARRAY_COUNT}
              step={1}
              disabled={disabled}
            />
            <SliderInput
              label={t('binDesigner.cutouts.array.rows')}
              value={array.rows}
              onChange={(v) => setArray({ rows: v })}
              min={1}
              max={MAX_ARRAY_COUNT}
              step={1}
              disabled={disabled}
            />
          </div>
          <SliderInput
            label={t('binDesigner.cutouts.array.pitchX')}
            value={array.pitchX}
            onChange={(v) => setArray({ pitchX: v })}
            min={1}
            max={200}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <SliderInput
            label={t('binDesigner.cutouts.array.pitchY')}
            value={array.pitchY}
            onChange={(v) => setArray({ pitchY: v })}
            min={1}
            max={200}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
        </>
      )}

      <div className="flex items-center justify-between pt-0.5 text-[11px] text-content-tertiary">
        <span>{t('binDesigner.cutouts.array.instances', { count })}</span>
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          className="flex-1 rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
          onClick={onFlatten}
          disabled={disabled}
        >
          {t('binDesigner.cutouts.array.flatten')}
        </button>
        <button
          type="button"
          className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
          onClick={() => onUpdate({ array: undefined })}
          disabled={disabled}
          title={t('binDesigner.cutouts.array.remove')}
        >
          {t('binDesigner.cutouts.array.remove')}
        </button>
      </div>
    </div>
  );
}
