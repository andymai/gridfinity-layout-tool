/**
 * Pattern selector for wall patterns.
 *
 * Radio button group allowing selection between no pattern, honeycomb, or gothic arches.
 * Patterns are mutually exclusive — only one can be active at a time.
 *
 * Implements proper ARIA radiogroup semantics with keyboard navigation.
 */

import type { WallPatternType } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';

/** Available pattern options including 'none' for solid walls */
const PATTERN_OPTIONS: Array<{ value: WallPatternType | null; labelKey: string }> = [
  { value: null, labelKey: 'binDesigner.walls.pattern.none' },
  { value: 'honeycomb', labelKey: 'binDesigner.walls.pattern.honeycomb' },
  { value: 'gothic', labelKey: 'binDesigner.walls.pattern.gothic' },
];

interface PatternSelectorProps {
  /** Currently selected pattern, or null for no pattern */
  selectedPattern: WallPatternType | null;
  /** Callback when pattern selection changes */
  onChange: (pattern: WallPatternType | null) => void;
  /** Whether the selector is disabled (e.g., all walls have slots) */
  disabled?: boolean;
  /** Reason why the selector is disabled */
  disabledReason?: string;
}

export function PatternSelector({
  selectedPattern,
  onChange,
  disabled = false,
  disabledReason,
}: PatternSelectorProps) {
  const t = useTranslation();

  return (
    <div>
      <span id="pattern-selector-label" className="text-xs text-content-secondary mb-2 block">
        {t('binDesigner.walls.pattern.label')}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="pattern-selector-label"
        aria-disabled={disabled}
        className="space-y-1.5"
      >
        {PATTERN_OPTIONS.map(({ value, labelKey }) => (
          <label
            key={value ?? 'none'}
            className={`flex items-center gap-2 py-1 cursor-pointer ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input
              type="radio"
              name="wall-pattern"
              value={value ?? 'none'}
              checked={selectedPattern === value}
              aria-checked={selectedPattern === value}
              onChange={() => onChange(value)}
              disabled={disabled}
              className="w-3.5 h-3.5 text-accent focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
            <span className="text-xs text-content-secondary">{t(labelKey)}</span>
          </label>
        ))}
      </div>
      {disabled && disabledReason && (
        <p className="text-[11px] text-content-tertiary mt-1.5">{disabledReason}</p>
      )}
    </div>
  );
}
