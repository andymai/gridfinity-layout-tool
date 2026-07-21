/**
 * Pattern selector for wall patterns.
 *
 * Dropdown select with visual preview icons for each pattern type.
 * Patterns are mutually exclusive — only one can be active at a time.
 */

import { Select } from '@/design-system';
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

/** SVG icon for honeycomb pattern (single hexagon) */
function HoneycombIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" />
    </svg>
  );
}

/** SVG icon for round-hole pattern (single circle) */
function RoundIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

/** SVG icon for diamond-lattice pattern (single diamond) */
function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="12,3 21,12 12,21 3,12" />
    </svg>
  );
}

/** SVG icon for triangular pattern (two alternating triangles) */
function TriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="7,4 12,13 2,13" />
      <polygon points="17,20 22,11 12,11" />
    </svg>
  );
}

/** SVG icon for vertical-slot pattern (three louvers) */
function SlotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="3.5" height="16" rx="1.5" />
      <rect x="10.25" y="4" width="3.5" height="16" rx="1.5" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="1.5" />
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
  { value: 'round', labelKey: 'binDesigner.walls.pattern.round', icon: RoundIcon },
  { value: 'diamond', labelKey: 'binDesigner.walls.pattern.diamond', icon: DiamondIcon },
  { value: 'triangle', labelKey: 'binDesigner.walls.pattern.triangle', icon: TriangleIcon },
  { value: 'slots', labelKey: 'binDesigner.walls.pattern.slots', icon: SlotsIcon },
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
      <Select
        id="pattern-selector"
        value={selectedPattern ?? 'none'}
        onChange={handleChange}
        disabled={disabled}
        options={PATTERN_OPTIONS.map(({ value, labelKey }) => ({
          id: value ?? 'none',
          name: t(labelKey),
        }))}
        leftIcon={<SelectedIcon className="w-4 h-4 text-content-primary" />}
        fullWidth
      />
      {disabled && disabledReason && (
        <p className="text-[11px] text-content-tertiary mt-1.5">{disabledReason}</p>
      )}
    </div>
  );
}
