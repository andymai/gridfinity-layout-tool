/**
 * MM-scale rulers for the cutout workspace canvas.
 *
 * TopRuler (horizontal) and LeftRuler (vertical) render SVG tick marks
 * synchronized with the canvas zoom/pan state.
 *
 * The LeftRuler is Y-flipped: 0mm at bottom, extent at top —
 * matching the bin coordinate system where Y=0 is the front edge.
 */

const RULER_SIZE = 24;
const MAJOR_INTERVAL = 10; // mm
const MINOR_INTERVAL = 1; // mm
const LABEL_FONT_SIZE = 10;
const TICK_COLOR = 'var(--color-content-tertiary)';
const LABEL_COLOR = 'var(--color-content-secondary)';

interface RulerProps {
  /** Total mm extent of the bin along this axis */
  readonly extent: number;
  /** Scale: CSS pixels per mm (before zoom) */
  readonly scale: number;
  /** Current zoom level */
  readonly zoom: number;
  /** Pan offset in mm along this axis */
  readonly panOffset: number;
  /** Length of the ruler in CSS pixels */
  readonly length: number;
}

export function TopRuler({ extent, scale, zoom, panOffset, length }: RulerProps) {
  const effectiveScale = scale * zoom;
  // Hide minor ticks when they'd be less than 4px apart
  const showMinor = MINOR_INTERVAL * effectiveScale >= 4;

  // Determine visible range in mm
  const mmStart = Math.max(0, -panOffset);
  const mmEnd = Math.min(extent, length / effectiveScale - panOffset);

  const ticks: React.ReactElement[] = [];
  const startMajor = Math.floor(mmStart / MAJOR_INTERVAL) * MAJOR_INTERVAL;

  for (
    let mm = startMajor;
    mm <= mmEnd + MAJOR_INTERVAL;
    mm += showMinor ? MINOR_INTERVAL : MAJOR_INTERVAL
  ) {
    if (mm < 0 || mm > extent) continue;
    const x = (mm + panOffset) * effectiveScale;
    if (x < 0 || x > length) continue;

    const isMajor = mm % MAJOR_INTERVAL === 0;
    const tickHeight = isMajor ? RULER_SIZE * 0.6 : RULER_SIZE * 0.3;

    ticks.push(
      <line
        key={mm}
        x1={x}
        y1={RULER_SIZE}
        x2={x}
        y2={RULER_SIZE - tickHeight}
        stroke={TICK_COLOR}
        strokeWidth={isMajor ? 0.75 : 0.5}
      />
    );

    if (isMajor) {
      ticks.push(
        <text
          key={`l${mm}`}
          x={x + 2}
          y={RULER_SIZE * 0.45}
          fill={LABEL_COLOR}
          fontSize={LABEL_FONT_SIZE}
          textAnchor="start"
          dominantBaseline="middle"
        >
          {mm}
        </text>
      );
    }
  }

  return (
    <svg width={length} height={RULER_SIZE} className="block flex-shrink-0 bg-surface-secondary">
      {/* Bottom border line */}
      <line
        x1={0}
        y1={RULER_SIZE - 0.5}
        x2={length}
        y2={RULER_SIZE - 0.5}
        stroke={TICK_COLOR}
        strokeWidth={0.5}
      />
      {ticks}
    </svg>
  );
}

export function LeftRuler({ extent, scale, zoom, panOffset, length }: RulerProps) {
  const effectiveScale = scale * zoom;
  const showMinor = MINOR_INTERVAL * effectiveScale >= 4;

  // Visible range in mm (Y-flipped: 0mm at bottom, extent at top)
  const mmStart = Math.max(0, extent + panOffset - length / effectiveScale);
  const mmEnd = Math.min(extent, extent + panOffset);

  const ticks: React.ReactElement[] = [];
  const startMajor = Math.floor(mmStart / MAJOR_INTERVAL) * MAJOR_INTERVAL;

  for (
    let mm = startMajor;
    mm <= mmEnd + MAJOR_INTERVAL;
    mm += showMinor ? MINOR_INTERVAL : MAJOR_INTERVAL
  ) {
    if (mm < 0 || mm > extent) continue;
    // Y-flipped: mm=0 at bottom, mm=extent at top
    const y = (extent - mm + panOffset) * effectiveScale;
    if (y < 0 || y > length) continue;

    const isMajor = mm % MAJOR_INTERVAL === 0;
    const tickWidth = isMajor ? RULER_SIZE * 0.6 : RULER_SIZE * 0.3;

    ticks.push(
      <line
        key={mm}
        x1={RULER_SIZE}
        y1={y}
        x2={RULER_SIZE - tickWidth}
        y2={y}
        stroke={TICK_COLOR}
        strokeWidth={isMajor ? 0.75 : 0.5}
      />
    );

    if (isMajor) {
      ticks.push(
        <text
          key={`l${mm}`}
          x={RULER_SIZE * 0.45}
          y={y - 2}
          fill={LABEL_COLOR}
          fontSize={LABEL_FONT_SIZE}
          textAnchor="middle"
          dominantBaseline="auto"
          transform={`rotate(-90, ${RULER_SIZE * 0.45}, ${y - 2})`}
        >
          {mm}
        </text>
      );
    }
  }

  return (
    <svg width={RULER_SIZE} height={length} className="block flex-shrink-0 bg-surface-secondary">
      {/* Right border line */}
      <line
        x1={RULER_SIZE - 0.5}
        y1={0}
        x2={RULER_SIZE - 0.5}
        y2={length}
        stroke={TICK_COLOR}
        strokeWidth={0.5}
      />
      {ticks}
    </svg>
  );
}

/** Dead zone at the intersection of top and left rulers */
export function RulerCorner({ onDoubleClick }: { readonly onDoubleClick?: () => void }) {
  return (
    <div
      className="flex-shrink-0 bg-surface-secondary border-b border-r border-stroke-subtle/30 cursor-pointer"
      style={{ width: RULER_SIZE, height: RULER_SIZE }}
      onDoubleClick={onDoubleClick}
    />
  );
}
