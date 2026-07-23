import { LinkedDimensionInput } from '@/shared/components/LinkedDimensionInput';
import { CONSTRAINTS } from '@/core/constants';
import { useTranslation } from '@/i18n';

export interface PrintBedInputProps {
  /** Print bed width in mm */
  width: number;
  /** Print bed depth in mm */
  depth: number;
  /** Called with (width, depth?) — depth is undefined when linked (square bed) */
  onChange: (width: number, depth?: number) => void;
  /** Optional id forwarded to the first input (for htmlFor label association) */
  id?: string;
  /** 'compact' = sidebar/defaults, 'mobile' = mobile panel */
  variant?: 'compact' | 'mobile';
  min?: number;
  max?: number;
  step?: number;
}

export function PrintBedInput({
  width,
  depth,
  onChange,
  id,
  variant = 'compact',
  min = CONSTRAINTS.PRINT_BED_MM_MIN,
  max = CONSTRAINTS.PRINT_BED_MM_MAX,
  step = 10,
}: PrintBedInputProps) {
  const t = useTranslation();
  return (
    <LinkedDimensionInput
      width={width}
      depth={depth}
      onChange={onChange}
      id={id}
      variant={variant}
      min={min}
      max={max}
      step={step}
      widthAriaLabel={t('printBedInput.widthAriaLabel')}
      depthAriaLabel={t('printBedInput.depthAriaLabel')}
      linkAriaLabel={t('printBedInput.linkAriaLabel')}
      unlinkAriaLabel={t('printBedInput.unlinkAriaLabel')}
    />
  );
}
