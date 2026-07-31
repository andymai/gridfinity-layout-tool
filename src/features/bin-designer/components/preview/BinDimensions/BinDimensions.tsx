/**
 * Architectural dimension lines for the bin designer 3D preview.
 *
 * Shows width, depth, and height annotations with end caps and centered labels.
 * Positioned just outside the bin's bounding box, matching the visual style
 * of DrawerDimensions in the layout planner's IsometricPreview.
 *
 * The bin mesh is centered at origin (0,0) in XY with base at Z≈0.
 * All coordinates are in millimeters (scene unit = mm).
 *
 * The height dimension is driven by the assembled-height bands (issue #3037)
 * rather than re-deriving from height units here, so this drawing, the sidebar
 * readout, and the generated mesh cannot disagree.
 */

import { Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import type { AssembledSegment } from '@/features/bin-designer/utils/assembledHeight';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

interface BinDimensionsProps {
  /** Bin width in grid units */
  width: number;
  /** Bin depth in grid units */
  depth: number;
  /** Grid unit size in mm along X / width (for label text) */
  gridUnitMm: number;
  /** Optional grid unit size in mm along Y / depth (non-square grid); defaults to gridUnitMm */
  gridUnitMmY?: number;
  /**
   * Assembled height bands, bottom to top. Disjoint and summing to
   * {@link totalMm}; `startMm` is measured from the underside of the assembly.
   */
  segments: readonly AssembledSegment[];
  /** Bottom of the baseplate to the highest point, in mm. */
  totalMm: number;
  /** Annotate each band separately instead of showing only the total. */
  expanded: boolean;
  /**
   * Pre-translated label for one band, e.g. "Stacking lip 4.3mm". Passed in
   * rather than translated here so this stays a pure drawing component (same
   * contract as {@link stackPitchLabel}).
   */
  segmentLabel: (segment: AssembledSegment) => string;
  /**
   * Pre-translated secondary label shown under the height dimension, e.g.
   * "stacks +21mm". Conveys that stacked bins advance by body height (the lip
   * nests), so N bins ≠ N × printed height. Omitted when there's no lip.
   */
  stackPitchLabel?: string;
}

// Layout constants matched to planner's DrawerDimensions proportions
// (planner: OFFSET=0.8, END_CAP=0.15, FONT_SIZE=0.32, label_gap=0.3)
const OFFSET = 14; // Distance from bin edge to dimension line
const END_CAP = 1; // Length of end cap markers (half-length, extends both directions)
const BAND_TICK = 0.6; // Shorter mark at an interior band boundary
const LABEL_GAP = 4; // Additional offset from line to label text
const LINE_OPACITY = 0.5;
const TEXT_OPACITY = 0.7;
const FONT_SIZE = 4.5;
/** Band labels render smaller than the total so they read as subordinate. */
const BAND_FONT_SCALE = 0.62;
/**
 * A band shorter than its own label's line height cannot hold one without
 * overlapping its neighbour, so it gets a boundary mark only. Derived from the
 * font size so the two can't drift. The sidebar list stays complete — it is
 * where every band, however thin, is accounted for.
 */
const MIN_LABELLED_BAND_MM = FONT_SIZE * BAND_FONT_SCALE;

/** Format mm for display: nearest 0.1, no trailing zeros. */
function fmt(mm: number): string {
  return String(Math.round(mm * 10) / 10);
}

/**
 * Dimension lines showing bin width, depth, and assembled height in mm.
 * Matches the architectural drawing style from the layout planner.
 */
export function BinDimensions({
  width,
  depth,
  gridUnitMm,
  gridUnitMmY,
  segments,
  totalMm,
  expanded,
  segmentLabel,
  stackPitchLabel,
}: BinDimensionsProps) {
  const colors = useThreeColors();
  // Y axis uses gridUnitMmY when set (non-square grid); otherwise equals X.
  const gridUnitMmYEff = gridUnitMmY ?? gridUnitMm;
  // Bin extents in mm (mesh is centered at origin)
  const outerW = width * gridUnitMm;
  const outerD = depth * gridUnitMmYEff;

  // Display labels use the user's configured unit sizes
  const widthMm = Math.round(width * gridUnitMm);
  const depthMm = Math.round(depth * gridUnitMmYEff);

  /**
   * Bands are measured from the underside of the baseplate, but the mesh puts
   * the bin's own bottom at scene Z=0. Shifting by where the bin band starts
   * maps one frame onto the other, and correctly drops the dimension below the
   * bin whenever the plate has solid material under its pockets.
   */
  const originOffset = segments.find((s) => s.kind === 'bin')?.startMm ?? 0;
  const bottomZ = -originOffset;
  const topZ = totalMm - originOffset;

  const dimensions = useMemo(() => {
    const halfW = outerW / 2;
    const halfD = outerD / 2;

    return {
      // Width: along front edge, offset in -Y direction
      width: {
        start: [-halfW, -halfD - OFFSET, 0] as [number, number, number],
        end: [halfW, -halfD - OFFSET, 0] as [number, number, number],
        labelPos: [0, -halfD - OFFSET - LABEL_GAP, 0] as [number, number, number],
        label: `${widthMm}mm`,
        endCaps: {
          left: [
            [-halfW, -halfD - OFFSET - END_CAP, 0],
            [-halfW, -halfD - OFFSET + END_CAP, 0],
          ] as [[number, number, number], [number, number, number]],
          right: [
            [halfW, -halfD - OFFSET - END_CAP, 0],
            [halfW, -halfD - OFFSET + END_CAP, 0],
          ] as [[number, number, number], [number, number, number]],
        },
      },
      // Depth: along left edge, offset in -X direction
      depth: {
        start: [-halfW - OFFSET, -halfD, 0] as [number, number, number],
        end: [-halfW - OFFSET, halfD, 0] as [number, number, number],
        labelPos: [-halfW - OFFSET - LABEL_GAP, 0, 0] as [number, number, number],
        label: `${depthMm}mm`,
        endCaps: {
          left: [
            [-halfW - OFFSET - END_CAP, -halfD, 0],
            [-halfW - OFFSET + END_CAP, -halfD, 0],
          ] as [[number, number, number], [number, number, number]],
          right: [
            [-halfW - OFFSET - END_CAP, halfD, 0],
            [-halfW - OFFSET + END_CAP, halfD, 0],
          ] as [[number, number, number], [number, number, number]],
        },
      },
      // Height: vertical at back-left corner, offset from both edges
      height: {
        x: -halfW - OFFSET,
        y: halfD + OFFSET,
        start: [-halfW - OFFSET, halfD + OFFSET, bottomZ] as [number, number, number],
        end: [-halfW - OFFSET, halfD + OFFSET, topZ] as [number, number, number],
        // Expanded, the band labels own the midpoints, so the total moves above
        // the top cap rather than fighting them for the same space.
        labelPos: [
          -halfW - OFFSET - LABEL_GAP,
          halfD + OFFSET,
          expanded ? topZ + FONT_SIZE * 2.2 : (bottomZ + topZ) / 2,
        ] as [number, number, number],
        label: `${fmt(totalMm)}mm`,
        endCaps: {
          bottom: [
            [-halfW - OFFSET - END_CAP, halfD + OFFSET, bottomZ],
            [-halfW - OFFSET + END_CAP, halfD + OFFSET, bottomZ],
          ] as [[number, number, number], [number, number, number]],
          top: [
            [-halfW - OFFSET - END_CAP, halfD + OFFSET, topZ],
            [-halfW - OFFSET + END_CAP, halfD + OFFSET, topZ],
          ] as [[number, number, number], [number, number, number]],
        },
      },
    };
  }, [outerW, outerD, bottomZ, topZ, widthMm, depthMm, totalMm, expanded]);

  /**
   * Interior boundary marks plus a label per band.
   *
   * Band labels sit outboard, on the same side as the total. The inboard side
   * looks free in the layout but is exactly where the bin mesh is, so labels
   * placed there render over the model and are unreadable; the total moves
   * above the top cap instead to keep the midpoints clear. Zero-height bands (a
   * plate the bin fully nests into) get a mark but no label — the sidebar row
   * explains those.
   */
  const bands = useMemo(() => {
    if (!expanded) return [];
    const { x, y } = dimensions.height;
    return segments.map((segment) => {
      const startZ = segment.startMm - originOffset;
      return {
        kind: segment.kind,
        tick: [
          [x - BAND_TICK, y, startZ],
          [x + BAND_TICK, y, startZ],
        ] as [[number, number, number], [number, number, number]],
        labelPos: [x - LABEL_GAP, y, startZ + segment.mm / 2] as [number, number, number],
        label: segmentLabel(segment),
        showLabel: segment.mm >= MIN_LABELLED_BAND_MM,
      };
    });
  }, [expanded, segments, originOffset, dimensions.height, segmentLabel]);

  return (
    <group>
      {/* Width dimension line */}
      <Line
        points={[dimensions.width.start, dimensions.width.end]}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.width.endCaps.left}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.width.endCaps.right}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Text
        position={dimensions.width.labelPos}
        fontSize={FONT_SIZE}
        color={colors.lineColor}
        fillOpacity={TEXT_OPACITY}
        anchorX="center"
        anchorY="top"
      >
        {dimensions.width.label}
      </Text>

      {/* Depth dimension line */}
      <Line
        points={[dimensions.depth.start, dimensions.depth.end]}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.depth.endCaps.left}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.depth.endCaps.right}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Text
        position={dimensions.depth.labelPos}
        fontSize={FONT_SIZE}
        color={colors.lineColor}
        fillOpacity={TEXT_OPACITY}
        anchorX="right"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
      >
        {dimensions.depth.label}
      </Text>

      {/* Height dimension line — spans the whole assembled stack */}
      <Line
        points={[dimensions.height.start, dimensions.height.end]}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.height.endCaps.bottom}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Line
        points={dimensions.height.endCaps.top}
        color={colors.lineColor}
        lineWidth={1}
        transparent
        opacity={LINE_OPACITY}
      />
      <Text
        position={dimensions.height.labelPos}
        fontSize={FONT_SIZE}
        color={colors.lineColor}
        fillOpacity={TEXT_OPACITY}
        anchorX="right"
        anchorY="middle"
      >
        {dimensions.height.label}
      </Text>

      {/* Per-band boundary marks and labels */}
      {bands.map((band) => (
        <group key={band.kind}>
          <Line
            points={band.tick}
            color={colors.lineColor}
            lineWidth={1}
            transparent
            opacity={LINE_OPACITY}
          />
          {band.showLabel && (
            <Text
              position={band.labelPos}
              fontSize={FONT_SIZE * BAND_FONT_SCALE}
              color={colors.lineColor}
              fillOpacity={TEXT_OPACITY * 0.85}
              anchorX="right"
              anchorY="middle"
            >
              {band.label}
            </Text>
          )}
        </group>
      ))}

      {stackPitchLabel && (
        <Text
          position={[
            dimensions.height.labelPos[0],
            dimensions.height.labelPos[1],
            dimensions.height.labelPos[2] - FONT_SIZE * 1.4,
          ]}
          fontSize={FONT_SIZE * 0.72}
          color={colors.lineColor}
          fillOpacity={TEXT_OPACITY * 0.8}
          anchorX="right"
          anchorY="middle"
        >
          {stackPitchLabel}
        </Text>
      )}
    </group>
  );
}
