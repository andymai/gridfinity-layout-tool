/**
 * Label-size control shared by the cutout inspector and the label-tab panel.
 *
 * Encodes the Auto convention in one place: `value === undefined` means
 * auto-fit, and toggling into manual mode seeds the override at `manualSeed`
 * (the size currently rendering, where the caller knows it) or `max`. The
 * slider is only shown while an explicit size is set.
 *
 * Two variants, because the number means different things:
 *  - `cap` (label tabs): a CEILING — generation applies it as
 *    `min(auto-fit, max(minFontSize, override))`, so a label that cannot fit at
 *    this size still renders smaller, and label tabs additionally share one
 *    size across each row. Titled and hinted accordingly so the number on
 *    screen is not read as the printed size.
 *  - `exact` (cutout labels): a TARGET — the label renders at this size,
 *    reaching over neighbouring cutouts if it must, and shrinks only when the
 *    bin interior cannot hold it.
 */

import { Button, SliderInput, cn } from '@/design-system';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';
import { useTranslation } from '@/i18n';

interface LabelSizeControlProps {
  /** Current override in mm, or `undefined` for auto-fit. */
  readonly value: number | undefined;
  /** Called with a size in mm, or `null` to clear the override. */
  readonly onChange: (size: number | null) => void;
  readonly min: number;
  readonly max: number;
  readonly disabled?: boolean;
  /** Extra classes on the wrapper (e.g. top margin at a given call site). */
  readonly className?: string;
  /** Typography for the row label, which differs between call sites. */
  readonly labelClassName?: string;
  /** What the number means: a ceiling on auto-fit, or the rendered size. */
  readonly variant?: 'cap' | 'exact';
  /** Size to seed when leaving Auto — pass the currently rendered size so the
   *  switch freezes what is on screen instead of jumping to `max`. */
  readonly manualSeed?: number;
  /** Hide the Auto toggle. A text element has no band to auto-fit into, so
   *  its size is always explicit and the slider always shows. */
  readonly allowAuto?: boolean;
  /**
   * Explain that labels can render below the set size. Off by default: only
   * label tabs share a size across siblings, so only there does one label shrink
   * because another needed to fit.
   */
  readonly explainShared?: boolean;
}

export function LabelSizeControl({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  labelClassName = 'text-micro text-content-tertiary',
  variant = 'cap',
  manualSeed,
  allowAuto = true,
  explainShared = false,
}: LabelSizeControlProps) {
  const t = useTranslation();
  const isAuto = value === undefined;
  const setLabel = variant === 'exact' ? t('binDesigner.textSize') : t('binDesigner.textSizeMax');
  const info =
    variant === 'exact'
      ? t('binDesigner.textSizeExactHint')
      : explainShared
        ? t('binDesigner.textSizeCapHint')
        : undefined;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <span className={labelClassName}>{isAuto ? t('binDesigner.textSize') : setLabel}</span>
        {allowAuto && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              onChange(isAuto ? Math.min(max, Math.max(min, manualSeed ?? max)) : null)
            }
            aria-pressed={isAuto}
            className={`px-1.5 py-0.5 text-micro leading-none ${getSegmentClass(isAuto)}`}
          >
            {t('binDesigner.textSizeAuto')}
          </Button>
        )}
      </div>
      {value !== undefined && (
        <SliderInput
          label={setLabel}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={0.5}
          unit="mm"
          disabled={disabled}
          info={info}
        />
      )}
    </div>
  );
}
