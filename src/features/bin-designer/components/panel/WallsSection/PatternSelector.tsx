/**
 * Pattern selector for wall and floor patterns.
 *
 * Dropdown select with visual preview icons for each pattern type.
 * Patterns are mutually exclusive — only one can be active at a time.
 *
 * `patterns` narrows the offered set: the floor picker passes the stamp
 * types, since the kumiko lattices only exist as a band wrapped around the
 * walls and have no meaning on a floor.
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

/** SVG icon for the kumiko triangular lattice (mitsukude three-way joint) */
function MitsukudeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    </svg>
  );
}

/** SVG icon for goma (star with parallel internal ribs) */
function GomaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M8.8 4.5v5.5M15.2 4.5v5.5" />
    </svg>
  );
}

/** SVG icon for asanoha (twelve-armed hemp leaf star) */
function AsanohaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
    </svg>
  );
}

/** SVG icon for sakura (petals radiating from the star center) */
function SakuraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M12 4l1.8 4L12 12l-1.8-4zM20 12l-4 1.8-4-1.8 4-1.8zM12 20l-1.8-4 1.8-4 1.8 4zM4 12l4-1.8 4 1.8-4 1.8z" />
    </svg>
  );
}

/** SVG icon for rindo (medial-triangle diamonds) */
function RindoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M12 3L21 19H3zM7.5 11h9M7.5 11L12 19M16.5 11L12 19" />
    </svg>
  );
}

/** SVG icon for mikado (nested imperial triangles with stubs) */
function MikadoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M12 3L21 19H3zM12 8.5l4.6 8H7.4z" />
    </svg>
  );
}

/** SVG icon for tsumiishi-kikko (hexagonal chambers in the lattice) */
function TsumiishiKikkoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M12 4l6.9 4v8L12 20l-6.9-4V8zM12 4v4.6M18.9 16l-4-2.3M5.1 16l4-2.3" />
    </svg>
  );
}

/** Pattern option configuration */
interface PatternOption {
  value: WallPatternType | null;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** i18n key for the optgroup this pattern belongs to. */
  groupKey?: string;
}

/** Available pattern options with icons */
const PATTERN_OPTIONS: PatternOption[] = [
  { value: null, labelKey: 'binDesigner.walls.pattern.none', icon: SolidIcon },
  { value: 'honeycomb', labelKey: 'binDesigner.walls.pattern.honeycomb', icon: HoneycombIcon },
  { value: 'round', labelKey: 'binDesigner.walls.pattern.round', icon: RoundIcon },
  { value: 'diamond', labelKey: 'binDesigner.walls.pattern.diamond', icon: DiamondIcon },
  { value: 'triangle', labelKey: 'binDesigner.walls.pattern.triangle', icon: TriangleIcon },
  { value: 'slots', labelKey: 'binDesigner.walls.pattern.slots', icon: SlotsIcon },
  {
    value: 'mitsukude',
    labelKey: 'binDesigner.walls.pattern.mitsukude',
    icon: MitsukudeIcon,
    groupKey: 'binDesigner.walls.pattern.groupKumiko',
  },
  {
    value: 'goma',
    labelKey: 'binDesigner.walls.pattern.goma',
    icon: GomaIcon,
    groupKey: 'binDesigner.walls.pattern.groupKumiko',
  },
  {
    value: 'asanoha',
    labelKey: 'binDesigner.walls.pattern.asanoha',
    icon: AsanohaIcon,
    groupKey: 'binDesigner.walls.pattern.groupKumiko',
  },
  {
    value: 'sakura',
    labelKey: 'binDesigner.walls.pattern.sakura',
    icon: SakuraIcon,
    groupKey: 'binDesigner.walls.pattern.groupKumiko',
  },
  {
    value: 'rindo',
    labelKey: 'binDesigner.walls.pattern.rindo',
    icon: RindoIcon,
    groupKey: 'binDesigner.walls.pattern.groupKumiko',
  },
  {
    value: 'mikado',
    labelKey: 'binDesigner.walls.pattern.mikado',
    icon: MikadoIcon,
    groupKey: 'binDesigner.walls.pattern.groupKumiko',
  },
  {
    value: 'tsumiishi-kikko',
    labelKey: 'binDesigner.walls.pattern.tsumiishiKikko',
    icon: TsumiishiKikkoIcon,
    groupKey: 'binDesigner.walls.pattern.groupKumiko',
  },
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
  /** Restrict the offered patterns. Defaults to every wall pattern. */
  patterns?: readonly WallPatternType[];
  /** DOM id, so two selectors can coexist on one panel. */
  id?: string;
  /** i18n key for the field label. */
  labelKey?: string;
}

export function PatternSelector({
  selectedPattern,
  onChange,
  disabled = false,
  disabledReason,
  patterns,
  id = 'pattern-selector',
  labelKey = 'binDesigner.walls.pattern.label',
}: PatternSelectorProps) {
  const t = useTranslation();

  const options = patterns
    ? PATTERN_OPTIONS.filter((o) => o.value === null || patterns.includes(o.value))
    : PATTERN_OPTIONS;
  const selectedOption = options.find((o) => o.value === selectedPattern) ?? options[0];
  const SelectedIcon = selectedOption.icon;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange(value === 'none' ? null : (value as WallPatternType));
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <label htmlFor={id} className="text-xs text-content-secondary mb-2 block">
        {t(labelKey)}
      </label>
      <Select
        id={id}
        // Bound to the RESOLVED option, not the raw prop: when `patterns`
        // narrows the set, a value outside it (a crafted or pre-migration
        // design) has no matching <option> and renders blank. `selectedOption`
        // already falls back to the "none" entry.
        value={selectedOption.value ?? 'none'}
        onChange={handleChange}
        disabled={disabled}
        options={options.map(({ value, labelKey: optionLabelKey, groupKey }) => ({
          id: value ?? 'none',
          name: t(optionLabelKey),
          group: groupKey ? t(groupKey) : undefined,
        }))}
        leftIcon={<SelectedIcon className="w-4 h-4 text-content-primary" />}
        fullWidth
      />
      {disabled && disabledReason && (
        <p className="text-label text-content-tertiary mt-1.5">{disabledReason}</p>
      )}
    </div>
  );
}
