/**
 * Pattern selector for wall patterns.
 *
 * Dropdown select with visual preview icons for each pattern type.
 * Patterns are mutually exclusive — only one can be active at a time.
 */

import type { WallPatternType } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';

/** SVG icon for solid walls (filled rectangle) */
function SolidIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

/** SVG icon for honeycomb pattern (hexagonal grid) */
function HoneycombIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {/* Center hexagon */}
      <polygon points="12,5 16,8 16,13 12,16 8,13 8,8" />
      {/* Top-left partial hex */}
      <polygon points="4,5 8,8 8,3 4,0" opacity="0.6" />
      {/* Top-right partial hex */}
      <polygon points="20,5 16,8 16,3 20,0" opacity="0.6" />
      {/* Bottom-left partial hex */}
      <polygon points="4,16 8,13 8,18 4,21" opacity="0.6" />
      {/* Bottom-right partial hex */}
      <polygon points="20,16 16,13 16,18 20,21" opacity="0.6" />
    </svg>
  );
}

/** Pattern option configuration */
interface PatternOption {
  value: WallPatternType | null;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Available pattern options with icons */
const PATTERN_OPTIONS: PatternOption[] = [
  { value: null, labelKey: 'binDesigner.walls.pattern.none', icon: SolidIcon },
  { value: 'honeycomb', labelKey: 'binDesigner.walls.pattern.honeycomb', icon: HoneycombIcon },
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

  const selectedOption =
    PATTERN_OPTIONS.find((o) => o.value === selectedPattern) ?? PATTERN_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange(value === 'none' ? null : (value as WallPatternType));
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <label htmlFor="pattern-selector" className="text-xs text-content-secondary mb-2 block">
        {t('binDesigner.walls.pattern.label')}
      </label>
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <SelectedIcon className="w-4 h-4 text-content-primary" />
        </div>
        <select
          id="pattern-selector"
          value={selectedPattern ?? 'none'}
          onChange={handleChange}
          disabled={disabled}
          className="w-full appearance-none rounded-md bg-surface-secondary text-content-primary text-sm py-2 pl-9 pr-8 border border-stroke-subtle focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed"
        >
          {PATTERN_OPTIONS.map(({ value, labelKey }) => (
            <option key={value ?? 'none'} value={value ?? 'none'}>
              {t(labelKey)}
            </option>
          ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="w-4 h-4 text-content-secondary"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
      {disabled && disabledReason && (
        <p className="text-[11px] text-content-tertiary mt-1.5">{disabledReason}</p>
      )}
    </div>
  );
}
