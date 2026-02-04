/**
 * Pattern selector for wall patterns.
 *
 * Segmented button group with visual icons for each pattern type.
 * Patterns are mutually exclusive — only one can be active at a time.
 *
 * Implements proper ARIA radiogroup semantics with keyboard navigation.
 */

import { useCallback, useRef } from 'react';
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

/** SVG icon for gothic arch pattern (pointed arches) */
function GothicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {/* Left arch with curved sides */}
      <path d="M3,20 Q3,10 7,6 Q11,10 11,20 Z" />
      {/* Right arch with curved sides */}
      <path d="M13,20 Q13,10 17,6 Q21,10 21,20 Z" />
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
  { value: 'gothic', labelKey: 'binDesigner.walls.pattern.gothic', icon: GothicIcon },
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
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const currentIndex = PATTERN_OPTIONS.findIndex((o) => o.value === selectedPattern);
      let nextIndex = currentIndex;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % PATTERN_OPTIONS.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + PATTERN_OPTIONS.length) % PATTERN_OPTIONS.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = PATTERN_OPTIONS.length - 1;
      } else {
        return;
      }

      onChange(PATTERN_OPTIONS[nextIndex].value);
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[nextIndex]?.focus();
    },
    [selectedPattern, onChange, disabled]
  );

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <span id="pattern-selector-label" className="text-xs text-content-secondary mb-2 block">
        {t('binDesigner.walls.pattern.label')}
      </span>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="pattern-selector-label"
        className="flex gap-1"
        onKeyDown={handleKeyDown}
      >
        {PATTERN_OPTIONS.map(({ value, labelKey, icon: Icon }) => {
          const isActive = selectedPattern === value;
          const label = t(labelKey);
          return (
            <button
              key={value ?? 'none'}
              type="button"
              role="radio"
              tabIndex={isActive ? 0 : -1}
              aria-checked={isActive}
              aria-label={label}
              title={label}
              disabled={disabled}
              onClick={() => onChange(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
              } disabled:cursor-not-allowed`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
      {disabled && disabledReason && (
        <p className="text-[11px] text-content-tertiary mt-1.5">{disabledReason}</p>
      )}
    </div>
  );
}
