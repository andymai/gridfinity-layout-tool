/**
 * Clickable overlay rendering one hit target per eligible divider segment, plus
 * a discoverability dot at every divider and a live tilt line for dividers that
 * carry an override (or an in-flight drag preview).
 *
 * Layered above the cell grid but below the ghost-preview, with
 * `pointer-events: none` on the container so cell drag-merge still works; each
 * individual hit line opts back into pointer events via `pointer-events: auto`.
 *
 * Geometry mirrors the worker's per-pair derivation. Percentages are top-down
 * (grid row 0 is the visual bottom, so `y = (1 − row/rows)·100`). The tilt line
 * lives in an SVG with `preserveAspectRatio="none"` so endpoints land on the
 * correct cell fractions; `vector-effect: non-scaling-stroke` keeps the stroke
 * an even width despite the non-uniform scale, and dots are positioned divs so
 * they stay round.
 */

import { Button } from '@/design-system';
import type { CompartmentConfig, DividerTiltPreview } from '@/features/bin-designer/types';
import type { EligibleDivider } from '@/features/bin-designer/utils/compartments';
import { computeSegmentSpan, overlayLineGeom, type SegmentSpan } from './dividerOverlayGeom';
import { rowKeyOf } from './useDividerTiltSubsection';

interface DividerHitTargetsProps {
  readonly compartments: CompartmentConfig;
  readonly dividers: readonly EligibleDivider[];
  readonly interiorW: number;
  readonly interiorD: number;
  readonly preview: DividerTiltPreview | null;
  readonly selectedKey: string | null;
  readonly hoveredKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onHoverChange: (key: string | null) => void;
  readonly rowLabel: (a: number, b: number) => string;
}

export function DividerHitTargets({
  compartments,
  dividers,
  interiorW,
  interiorD,
  preview,
  selectedKey,
  hoveredKey,
  onSelect,
  onHoverChange,
  rowLabel,
}: DividerHitTargetsProps) {
  return (
    <div className="pointer-events-none absolute inset-2 z-10">
      {/* Tilt lines (visual only). Drawn first so dots + hit targets sit on top. */}
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {dividers.map((d) => {
          const span = computeSegmentSpan(compartments, d);
          if (!span) return null;
          const key = rowKeyOf(d.compartmentA, d.compartmentB);
          const ov =
            preview && preview.key === key
              ? { offsetStart: preview.offsetStart, offsetEnd: preview.offsetEnd }
              : { offsetStart: d.offsetStart, offsetEnd: d.offsetEnd };
          if (ov.offsetStart === 0 && ov.offsetEnd === 0) return null;
          const line = overlayLineGeom(span, ov.offsetStart, ov.offsetEnd, interiorW, interiorD);
          const isActive = selectedKey === key || hoveredKey === key;
          return (
            <line
              key={key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={isActive ? 'stroke-accent' : 'stroke-accent/60'}
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {dividers.map((d) => {
        const span = computeSegmentSpan(compartments, d);
        if (!span) return null;
        const key = rowKeyOf(d.compartmentA, d.compartmentB);
        const isTilted = d.offsetStart !== 0 || d.offsetEnd !== 0;
        const ov =
          preview && preview.key === key
            ? { offsetStart: preview.offsetStart, offsetEnd: preview.offsetEnd }
            : { offsetStart: d.offsetStart, offsetEnd: d.offsetEnd };
        const dot = overlayLineGeom(span, ov.offsetStart, ov.offsetEnd, interiorW, interiorD);
        return (
          <DividerHitLine
            key={key}
            span={span}
            dotX={dot.cx}
            dotY={dot.cy}
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

interface DividerHitLineProps {
  readonly span: SegmentSpan;
  readonly dotX: number;
  readonly dotY: number;
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
  dotX,
  dotY,
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

  // The hit target is wider than any visible affordance so touch users can hit
  // it reliably along the divider's nominal (straight) position.
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

  // Discoverability dot at the divider midpoint; brightens + grows on hover and
  // selection. Subtle by default so dense grids don't get noisy.
  const dotState = isSelected
    ? 'bg-accent scale-125'
    : isHovered
      ? 'bg-accent scale-110'
      : isTilted
        ? 'bg-accent/70'
        : 'bg-accent/30';

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onPointerEnter={onHoverEnter}
        onPointerLeave={onHoverLeave}
        onFocus={onHoverEnter}
        onBlur={onHoverLeave}
        onClick={onClick}
        aria-label={label}
        aria-pressed={isSelected}
        className="pointer-events-auto absolute cursor-pointer hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        style={containerStyle}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[transform,background-color] ${dotState}`}
        style={{ left: `${dotX}%`, top: `${dotY}%` }}
      />
    </>
  );
}
