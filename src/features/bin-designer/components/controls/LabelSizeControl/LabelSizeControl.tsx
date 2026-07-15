/**
 * Label-size control shared by the cutout inspector and the label-tab panel.
 *
 * Encodes the Auto convention in one place: `value === undefined` means
 * auto-fit, and toggling into manual mode seeds the override at `max` (the
 * largest size the band allows) rather than an arbitrary default. The slider is
 * only shown while an explicit size is set.
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
}

export function LabelSizeControl({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  labelClassName = 'text-[10px] text-text-muted',
}: LabelSizeControlProps) {
  const t = useTranslation();
  const isAuto = value === undefined;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <span className={labelClassName}>{t('binDesigner.textSize')}</span>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => onChange(isAuto ? max : null)}
          aria-pressed={isAuto}
          className={`px-1.5 py-0.5 text-[10px] leading-none ${getSegmentClass(isAuto)}`}
        >
          {t('binDesigner.textSizeAuto')}
        </Button>
      </div>
      {value !== undefined && (
        <SliderInput
          label={t('binDesigner.textSize')}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={0.5}
          unit="mm"
          disabled={disabled}
        />
      )}
    </div>
  );
}
