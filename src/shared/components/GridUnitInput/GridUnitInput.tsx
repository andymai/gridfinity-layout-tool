import { LinkedDimensionInput } from '@/shared/components/LinkedDimensionInput';
import { CONSTRAINTS } from '@/core/constants';
import { useTranslation } from '@/i18n';

export interface GridUnitInputProps {
  /** X-axis grid pitch in mm */
  x: number;
  /** Effective Y-axis pitch in mm (resolved: stored Y ?? X) */
  y: number;
  /** Called with (x, y?) — y is undefined when linked (square grid) */
  onChange: (x: number, y?: number) => void;
  /** Optional id forwarded to the first input (for htmlFor label association) */
  id?: string;
  /** 'compact' = sidebar/designer panels, 'mobile' = mobile panel */
  variant?: 'compact' | 'mobile';
  /** Input range; defaults to the layout authoring range (20-60mm). The bin
   * designer overrides with the wider storage-layer range. */
  min?: number;
  max?: number;
}

/**
 * Grid pitch control matching the print bed's linked-pair pattern (one input
 * + chain icon while square, X × Y when unlinked). Replaces the former
 * "Non-square grid" switch UI.
 */
export function GridUnitInput({
  x,
  y,
  onChange,
  id,
  variant = 'compact',
  min = CONSTRAINTS.GRID_UNIT_MM_MIN,
  max = CONSTRAINTS.GRID_UNIT_MM_MAX,
}: GridUnitInputProps) {
  const t = useTranslation();
  return (
    <LinkedDimensionInput
      width={x}
      depth={y}
      onChange={onChange}
      id={id}
      variant={variant}
      min={min}
      max={max}
      step={1}
      widthAriaLabel={t('gridUnitInput.xAriaLabel')}
      depthAriaLabel={t('gridUnitInput.yAriaLabel')}
      linkAriaLabel={t('gridUnitInput.linkAriaLabel')}
      unlinkAriaLabel={t('gridUnitInput.unlinkAriaLabel')}
    />
  );
}
