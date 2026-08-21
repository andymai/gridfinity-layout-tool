/**
 * The divider panel's little pictures: the off-state teaser, the per-row plan
 * thumbnail, the inspector's live plan view, and the lean cross-section. All
 * pure SVG from props — no store access — so the panel component stays about
 * behavior and these stay trivially testable.
 */

import { dividerFootDrift, getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { computeSegmentSpan, overlayLeanBandPoints, overlayLineGeom } from './dividerOverlayGeom';
import type { TiltRow } from './useDividerTiltSubsection';

export function TeaserDiagram() {
  return (
    <svg width={44} height={34} viewBox="0 0 44 34" aria-hidden="true" className="mt-0.5 shrink-0">
      <rect
        x={0.5}
        y={0.5}
        width={43}
        height={33}
        rx={2}
        fill="none"
        className="stroke-stroke-subtle"
      />
      <line
        x1={22}
        y1={1.5}
        x2={22}
        y2={32.5}
        strokeDasharray="2.5 2"
        strokeWidth={1.25}
        className="stroke-content-tertiary"
      />
      <line
        x1={28.5}
        y1={1.5}
        x2={15.5}
        y2={32.5}
        strokeWidth={2}
        strokeLinecap="round"
        className="stroke-accent"
      />
    </svg>
  );
}

interface MiniDiagramProps {
  readonly compartments: CompartmentConfig;
  readonly row: TiltRow;
}

const DIAGRAM_W = 20;
const DIAGRAM_H = 15;

export function DividerMiniDiagram({ compartments, row }: MiniDiagramProps) {
  const { cols, rows: gridRows } = compartments;
  const aBounds = getCompartmentBounds(compartments, row.compartmentA);
  const bBounds = getCompartmentBounds(compartments, row.compartmentB);
  if (!aBounds || !bBounds) {
    return <svg width={DIAGRAM_W} height={DIAGRAM_H} aria-hidden="true" />;
  }

  const cellW = DIAGRAM_W / cols;
  const cellH = DIAGRAM_H / gridRows;
  // SVG y is top-down while grid row 0 is the visual bottom, so rows flip.
  const boundsRect = (b: NonNullable<ReturnType<typeof getCompartmentBounds>>) => ({
    x: b.minCol * cellW,
    y: DIAGRAM_H - (b.maxRow + 1) * cellH,
    width: (b.maxCol - b.minCol + 1) * cellW,
    height: (b.maxRow - b.minRow + 1) * cellH,
  });

  const isVertical = row.axis === 'vertical';
  const boundary = isVertical
    ? (Math.min(aBounds.maxCol, bBounds.maxCol) + 1) * cellW
    : DIAGRAM_H - (Math.min(aBounds.maxRow, bBounds.maxRow) + 1) * cellH;

  // A small visual lean so tilted rows read as diagonal at a glance.
  const lean = row.hasTilt ? Math.sign(row.angleDeg) * Math.min(4, Math.abs(row.angleDeg) / 12) : 0;

  return (
    <svg
      width={DIAGRAM_W}
      height={DIAGRAM_H}
      viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <rect {...boundsRect(aBounds)} className="fill-accent/15" />
      <rect {...boundsRect(bBounds)} className="fill-accent/15" />
      <rect
        x={0.5}
        y={0.5}
        width={DIAGRAM_W - 1}
        height={DIAGRAM_H - 1}
        fill="none"
        className="stroke-stroke-subtle"
      />
      <line
        x1={isVertical ? boundary - lean : 0}
        y1={isVertical ? 0 : boundary - lean}
        x2={isVertical ? boundary + lean : DIAGRAM_W}
        y2={isVertical ? DIAGRAM_H : boundary + lean}
        strokeWidth={1.5}
        className="stroke-accent"
      />
    </svg>
  );
}

interface PlanDiagramProps {
  readonly compartments: CompartmentConfig;
  readonly row: TiltRow;
  readonly offsets: { offsetStart: number; offsetEnd: number; rakeDeg: number };
  readonly interiorW: number;
  readonly interiorD: number;
  readonly dividerHeightMm: number;
}

/**
 * Live plan view of the selected wall: the whole compartment grid with the two
 * affected compartments shaded and the wall drawn at its current offsets — top
 * edge solid, foot dashed, swept band shaded — mirroring the canvas overlay so
 * the panel and the grid always tell the same story.
 */
export function DividerPlanDiagram({
  compartments,
  row,
  offsets,
  interiorW,
  interiorD,
  dividerHeightMm,
}: PlanDiagramProps) {
  const { cols, rows: gridRows, cells } = compartments;
  const width = 76;
  const height =
    interiorW > 0 ? Math.min(84, Math.max(40, Math.round((width * interiorD) / interiorW))) : 56;

  const span = computeSegmentSpan(compartments, row);
  const line = span
    ? overlayLineGeom(span, offsets.offsetStart, offsets.offsetEnd, interiorW, interiorD)
    : null;
  const drift = dividerFootDrift(offsets, dividerHeightMm);
  const foot =
    span && line && drift !== 0
      ? overlayLineGeom(
          span,
          offsets.offsetStart + drift,
          offsets.offsetEnd + drift,
          interiorW,
          interiorD
        )
      : null;

  const pairIds = new Set([row.compartmentA, row.compartmentB]);
  const uniqueIds = [...new Set(cells)];

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="overflow-visible"
    >
      {uniqueIds.map((id) => {
        const b = getCompartmentBounds(compartments, id);
        if (!b) return null;
        return (
          <rect
            key={id}
            x={(b.minCol / cols) * 100}
            y={100 - ((b.maxRow + 1) / gridRows) * 100}
            width={((b.maxCol - b.minCol + 1) / cols) * 100}
            height={((b.maxRow - b.minRow + 1) / gridRows) * 100}
            vectorEffect="non-scaling-stroke"
            className={
              pairIds.has(id)
                ? 'fill-accent/15 stroke-stroke-subtle'
                : 'fill-none stroke-stroke-subtle'
            }
          />
        );
      })}
      {line && (
        <>
          {foot && (
            <>
              <polygon points={overlayLeanBandPoints(line, foot)} className="fill-accent/20" />
              <line
                x1={foot.x1}
                y1={foot.y1}
                x2={foot.x2}
                y2={foot.y2}
                strokeWidth={1.5}
                strokeDasharray="3 2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-accent/60"
              />
            </>
          )}
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-accent"
          />
        </>
      )}
    </svg>
  );
}

/**
 * Section through the bin showing the divider standing in it. The plan view the
 * user edits in cannot show a lean at all, so without this the angle has no
 * picture anywhere near the control that sets it.
 */
export function LeanSpecimen({ leanDeg }: { readonly leanDeg: number }) {
  const w = 58;
  const h = 46;
  const inset = 5;
  const floorY = h - inset;
  const topY = inset + 2;
  const foot = (floorY - topY) * Math.tan((leanDeg * Math.PI) / 180);
  const pivotX = w / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <path
        d={`M ${inset} ${topY} L ${inset} ${floorY} L ${w - inset} ${floorY} L ${w - inset} ${topY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="text-stroke-subtle"
      />
      <line
        x1={pivotX}
        y1={topY}
        x2={pivotX + foot}
        y2={floorY}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="text-accent"
      />
      <circle cx={pivotX} cy={topY} r={1.5} fill="currentColor" className="text-accent" />
    </svg>
  );
}
