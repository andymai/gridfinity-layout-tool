import { useState, useCallback } from 'react';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { useTranslation } from '@/i18n';

export interface PrintBedInputProps {
  /** Print bed width in mm */
  width: number;
  /** Print bed depth in mm */
  depth: number;
  /** Called when width changes (blur/Enter) */
  onWidthChange: (value: number) => void;
  /** Called when depth changes (blur/Enter) */
  onDepthChange: (value: number) => void;
  /** 'compact' = sidebar/defaults, 'mobile' = mobile panel */
  variant?: 'compact' | 'mobile';
  min?: number;
  max?: number;
  step?: number;
}

const LINK_ICON =
  'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71';
const UNLINK_ICON_PATHS = [
  'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71',
  'M5.17 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71',
  'M8 21l1-3M16 3l-1 3M21 8l-3 1M3 16l3-1',
];

export function PrintBedInput({
  width,
  depth,
  onWidthChange,
  onDepthChange,
  variant = 'compact',
  min = 42,
  max = 500,
  step = 10,
}: PrintBedInputProps) {
  const t = useTranslation();

  // Track whether the user has expanded to show two inputs.
  // When width !== depth, always show two inputs regardless.
  const [expanded, setExpanded] = useState(false);
  const isSquare = width === depth;
  const showSingleInput = isSquare && !expanded;

  const handleLinkedChange = useCallback(
    (value: number) => {
      onWidthChange(value);
      onDepthChange(value);
    },
    [onWidthChange, onDepthChange]
  );

  const handleToggleLink = useCallback(() => {
    if (showSingleInput) {
      setExpanded(true);
    } else {
      setExpanded(false);
      onDepthChange(width);
    }
  }, [showSingleInput, width, onDepthChange]);

  const isCompact = variant === 'compact';
  const inputClass = isCompact
    ? 'input w-14 py-0.5 px-1 text-xs text-right'
    : 'input w-20 h-10 text-center';
  const iconSize = isCompact ? 'w-3 h-3' : 'w-4 h-4';
  const btnClass = `flex-shrink-0 rounded text-content-disabled hover:text-content-tertiary transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${isCompact ? 'p-0.5' : 'p-1'}`;

  const linkButton = (
    <button
      type="button"
      onClick={handleToggleLink}
      className={btnClass}
      aria-label={
        showSingleInput ? t('printBedInput.unlinkAriaLabel') : t('printBedInput.linkAriaLabel')
      }
    >
      <svg
        className={iconSize}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {showSingleInput ? (
          <path d={LINK_ICON} />
        ) : (
          UNLINK_ICON_PATHS.map((d) => <path key={d} d={d} />)
        )}
      </svg>
    </button>
  );

  if (showSingleInput) {
    return (
      <div className="flex items-center gap-1">
        <DeferredNumberInput
          value={width}
          onChange={handleLinkedChange}
          min={min}
          max={max}
          step={step}
          className={inputClass}
          aria-label={t('printBedInput.widthAriaLabel')}
        />
        {linkButton}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <DeferredNumberInput
        value={width}
        onChange={onWidthChange}
        min={min}
        max={max}
        step={step}
        className={inputClass}
        aria-label={t('printBedInput.widthAriaLabel')}
      />
      <span className="text-[10px] text-content-tertiary">×</span>
      <DeferredNumberInput
        value={depth}
        onChange={onDepthChange}
        min={min}
        max={max}
        step={step}
        className={inputClass}
        aria-label={t('printBedInput.depthAriaLabel')}
      />
      {linkButton}
    </div>
  );
}
