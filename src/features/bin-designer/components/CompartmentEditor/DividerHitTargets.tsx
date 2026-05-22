/**
 * Clickable overlay rendering one hit target per eligible divider segment.
 *
 * Layered above the cell grid but below the ghost-preview, with
 * `pointer-events: none` on the container so cell drag-merge still works;
 * each individual line opts back into pointer events via `pointer-events: auto`.
 *
 * Segment span is derived from the two compartments' shared boundary in grid
 * coords, mirroring the worker's per-pair derivation. Visual y is flipped
 * (`flex-col-reverse` parent) so percentages anchor to `bottom`, not `top`.
 */

import type { CompartmentConfig } from '@/features/bin-designer/types';
import {
  getCompartmentBounds,
  type EligibleDivider,
} from '@/features/bin-designer/utils/compartments';
import { rowKeyOf } from './useDividerTiltSubsection';

interface DividerHitTargetsProps {
  readonly compartments: CompartmentConfig;
  readonly dividers: readonly EligibleDivider[];
  readonly selectedKey: string | null;
  readonly hoveredKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onHoverChange: (key: string | null) => void;
  readonly rowLabel: (a: number, b: number) => string;
}

export function DividerHitTargets({
  compartments,
  dividers,
  selectedKey,
  hoveredKey,
  onSelect,
  onHoverChange,
  rowLabel,
}: DividerHitTargetsProps) {
  return (
    <div className="pointer-events-none absolute inset-2 z-10">
      {dividers.map((d) => {
        const span = computeSegmentSpan(compartments, d);
        if (!span) return null;
        const key = rowKeyOf(d.compartmentA, d.compartmentB);
        const isTilted = d.offsetStart !== 0 || d.offsetEnd !== 0;
        return (
          <DividerHitLine
            key={key}
            span={span}
            isHovered={hoveredKey === key}
            isSelected={selectedKey === key}
            isTilted={isTilted}
            label={rowLabel(d.compartmentA + 1, d.compartmentB + 1)}
            onClick={() => onSelect(key)}
            onHoverEnter={() => onHoverChange(key)}
            onHoverLeave={() => onHoverChange(null)}
          />
        );
      })}
    </div>
  );
}

interface SegmentSpan {
  readonly axis: 'vertical' | 'horizontal';
  /** Column or row boundary in [1, gridDim-1] (the perpendicular coord of the line). */
  readonly axisCoord: number;
  /** Start of the segment along the parallel axis, in [0, gridDim]. */
  readonly spanStart: number;
  /** End (exclusive) of the segment, in [0, gridDim]. */
  readonly spanEnd: number;
  /** Length of the grid dimension parallel to the segment. */
  readonly parallelDim: number;
  /** Length of the grid dimension perpendicular to the segment. */
  readonly perpDim: number;
}

/**
 * Find the contiguous run of cell boundaries where the (compartmentA, compartmentB)
 * pair appears. With the rectangular-compartment invariant the run is unique
 * and contiguous, so a single scan along the perpendicular axis is enough.
 */
function computeSegmentSpan(
  config: CompartmentConfig,
  divider: EligibleDivider
): SegmentSpan | null {
  const aBounds = getCompartmentBounds(config, divider.compartmentA);
  const bBounds = getCompartmentBounds(config, divider.compartmentB);
  if (!aBounds || !bBounds) return null;

  if (divider.axis === 'vertical') {
    const axisCoord = Math.min(aBounds.maxCol, bBounds.maxCol) + 1;
    const spanStart = Math.max(aBounds.minRow, bBounds.minRow);
    const spanEnd = Math.min(aBounds.maxRow, bBounds.maxRow) + 1;
    if (spanEnd <= spanStart) return null;
    return {
      axis: 'vertical',
      axisCoord,
      spanStart,
      spanEnd,
      parallelDim: config.rows,
      perpDim: config.cols,
    };
  }

  const axisCoord = Math.min(aBounds.maxRow, bBounds.maxRow) + 1;
  const spanStart = Math.max(aBounds.minCol, bBounds.minCol);
  const spanEnd = Math.min(aBounds.maxCol, bBounds.maxCol) + 1;
  if (spanEnd <= spanStart) return null;
  return {
    axis: 'horizontal',
    axisCoord,
    spanStart,
    spanEnd,
    parallelDim: config.cols,
    perpDim: config.rows,
  };
}

interface DividerHitLineProps {
  readonly span: SegmentSpan;
  readonly isHovered: boolean;
  readonly isSelected: boolean;
  readonly isTilted: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly onHoverEnter: () => void;
  readonly onHoverLeave: () => void;
}

/** Hit target thickness in px. Generous so touch users can hit it. */
const HIT_THICKNESS_PX = 14;

function DividerHitLine({
  span,
  isHovered,
  isSelected,
  isTilted,
  label,
  onClick,
  onHoverEnter,
  onHoverLeave,
}: DividerHitLineProps) {
  const isVertical = span.axis === 'vertical';
  const perpPct = (span.axisCoord / span.perpDim) * 100;
  const startPct = (span.spanStart / span.parallelDim) * 100;
  const endPct = ((span.parallelDim - span.spanEnd) / span.parallelDim) * 100;

  // The hit target is wider than the visible line so touch users can hit it
  // reliably; the visible line is a thin stripe centered inside via ::after.
  const containerStyle = isVertical
    ? {
        left: `calc(${perpPct}% - ${HIT_THICKNESS_PX / 2}px)`,
        top: `${100 - (span.spanEnd / span.parallelDim) * 100}%`,
        bottom: `${startPct}%`,
        width: `${HIT_THICKNESS_PX}px`,
      }
    : {
        bottom: `calc(${perpPct}% - ${HIT_THICKNESS_PX / 2}px)`,
        left: `${startPct}%`,
        right: `${endPct}%`,
        height: `${HIT_THICKNESS_PX}px`,
      };

  // Inner stripe is the visible affordance; brightens on hover and selection.
  const stripeClass = isVertical
    ? 'absolute inset-y-0 left-1/2 -translate-x-1/2'
    : 'absolute inset-x-0 top-1/2 -translate-y-1/2';
  const stripeThickness = isVertical ? 'w-[2px]' : 'h-[2px]';
  const stripeColor = isSelected
    ? 'bg-accent'
    : isHovered
      ? 'bg-accent/80'
      : isTilted
        ? 'bg-accent/40'
        : 'bg-transparent';

  return (
    <button
      type="button"
      onPointerEnter={onHoverEnter}
      onPointerLeave={onHoverLeave}
      onFocus={onHoverEnter}
      onBlur={onHoverLeave}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isSelected}
      className="pointer-events-auto absolute cursor-pointer transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      style={containerStyle}
    >
      <span className={`${stripeClass} ${stripeThickness} ${stripeColor} transition-colors`} />
    </button>
  );
}
