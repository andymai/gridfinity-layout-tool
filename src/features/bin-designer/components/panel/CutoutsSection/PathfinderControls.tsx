/**
 * Adobe-Illustrator-style Pathfinder control: a 4-button strip for the
 * boolean ops we expose on cutout groups (Union, Subtract, Intersect,
 * Exclude). Disabled until at least two cutouts are selected.
 *
 * Behavior parity with Illustrator's shape-mode buttons:
 *  - Clicking an op groups the selection into a single group with that op.
 *    If the selection already shares a single groupId, only the op flips.
 *  - The active op is highlighted when the selection is one cohesive group.
 *  - Mixed-op selection (multiple groups w/ different ops) shows no
 *    highlight; the next click reunifies under the chosen op.
 */

import { useMemo } from 'react';
import type { Cutout, GroupOp } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { Button } from '@/design-system';
import { applyGroupOp } from './booleanGeometry';
import { resolveActiveOp } from './pathfinderHelpers';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';

interface PathfinderControlsProps {
  readonly selectedIds: readonly string[];
  readonly cutouts: readonly Cutout[];
  readonly onGroup: (ids: readonly string[], op: GroupOp) => void;
  readonly onSetGroupOp: (groupId: string, op: GroupOp) => void;
  readonly disabled?: boolean;
  /** Compact = icon-only buttons (workspace header); default = labeled buttons (sidebar). */
  readonly compact?: boolean;
}

/**
 * Single op definition: id, i18n label key, and inline SVG icon (14×14).
 *
 * Icons keep the same metaphor as Illustrator's Pathfinder panel — two
 * overlapping squares with the resulting region filled.
 */
const OP_DEFS: ReadonlyArray<{
  readonly op: GroupOp;
  readonly labelKey: 'union' | 'subtract' | 'intersect' | 'exclude';
  readonly icon: React.ReactNode;
}> = [
  {
    op: 'union',
    labelKey: 'union',
    icon: (
      <svg viewBox="0 0 14 14" className="h-3.5 w-3.5">
        <path
          d="M2 4h6v6H2z M6 6h6v6H6z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    op: 'subtract',
    labelKey: 'subtract',
    icon: (
      <svg
        viewBox="0 0 14 14"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M2 4h6v6H2z" fill="currentColor" />
        <rect x="6" y="6" width="6" height="6" fill="var(--color-surface-elevated, #1f2937)" />
      </svg>
    ),
  },
  {
    op: 'intersect',
    labelKey: 'intersect',
    icon: (
      <svg
        viewBox="0 0 14 14"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M2 4h6v6H2z" />
        <path d="M6 6h6v6H6z" />
        <rect x="6" y="6" width="2" height="4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    op: 'exclude',
    labelKey: 'exclude',
    icon: (
      <svg
        viewBox="0 0 14 14"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M2 4h6v6H2z" fill="currentColor" />
        <path d="M6 6h6v6H6z" fill="currentColor" />
        <rect
          x="6"
          y="6"
          width="2"
          height="4"
          fill="var(--color-surface-elevated, #1f2937)"
          stroke="none"
        />
      </svg>
    ),
  },
];

export function PathfinderControls({
  selectedIds,
  cutouts,
  onGroup,
  onSetGroupOp,
  disabled = false,
  compact = false,
}: PathfinderControlsProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const active = useMemo(() => resolveActiveOp(selectedIds, cutouts), [selectedIds, cutouts]);
  const tooFew = selectedIds.length < 2;
  const allDisabled = disabled || (tooFew && active === null);

  const handleClick = (op: GroupOp): void => {
    if (active && active.op === op) return;
    if (active) {
      onSetGroupOp(active.groupId, op);
    } else {
      onGroup(selectedIds, op);
    }
    // Pre-check the 2D polygon op so the user gets an immediate hint when
    // the resulting cavity is empty. The worker would silently produce no
    // cut in that case, which is hard to debug from the 3D preview alone.
    // Union can't be empty when there are >=2 valid members; the other three
    // ops can all collapse to nothing (intersect of disjoint, subtract where
    // the cutter swallows the base, exclude of perfectly coincident shapes).
    if (op !== 'union') {
      const selectedCutouts = cutouts.filter((c) => selectedIds.includes(c.id));
      if (selectedCutouts.length >= 2 && applyGroupOp(selectedCutouts, op) === null) {
        addToast({ message: t('binDesigner.cutouts.pathfinder.emptyResult'), type: 'info' });
      }
    }
  };

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label={t('binDesigner.cutouts.pathfinder.title')}
    >
      {OP_DEFS.map(({ op, labelKey, icon }) => {
        const label = t(`binDesigner.cutouts.pathfinder.${labelKey}` as const);
        const isActive = active?.op === op;
        return (
          <Button
            key={op}
            type="button"
            variant="ghost"
            className={getSegmentClass(isActive, { size: 'sm' })}
            onClick={() => handleClick(op)}
            disabled={allDisabled}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
          >
            {icon}
            {!compact && <span>{label}</span>}
          </Button>
        );
      })}
    </div>
  );
}
