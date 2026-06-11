/**
 * Interior compartment dimension lines for the 3D preview.
 *
 * Mirrors `BinDimensions` (the bin's exterior width/depth/height annotations)
 * but for a single interior compartment — the one currently hovered or
 * selected in the 2D grid editor (`ui.hoveredCompartmentId`). Drawing only the
 * active compartment keeps the preview uncluttered: at rest nothing is shown,
 * and dense grids never paint dozens of overlapping lines.
 *
 * Lines sit at the top of the compartment's dividers (the opening plane) so
 * they read clearly from the default top-down-ish camera. Labels report the
 * usable cavity size (divider walls subtracted), matching the 2D readout.
 *
 * The bin mesh is centered at origin in XY; the cavity floor is at `floorZ`.
 * All coordinates are millimeters (scene unit = mm).
 */

import { Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { compartmentCavity } from '@/features/bin-designer/utils/compartmentDimensions';
import { getCompartmentCount } from '@/features/bin-designer/utils/compartments';
import { calculateDividerHeight, resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

// Proportions scaled down from BinDimensions (compartments are smaller than
// the whole bin, so caps/labels need to be tighter to stay legible).
const END_CAP = 0.7;
const LABEL_GAP = 2.5;
const LINE_OPACITY = 0.65;
const TEXT_OPACITY = 0.85;
const FONT_SIZE = 3.5;

type Vec3 = [number, number, number];

function formatMm(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}mm`;
}

export function CompartmentDimensions() {
  const { params, hoveredCompartmentId } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      hoveredCompartmentId: s.ui.hoveredCompartmentId,
    }))
  );
  const colors = useThreeColors();

  const { innerW, innerD, wallHeight, floorZ } = binDimensions(params);
  const { compartments, base } = params;

  const geometry = useMemo(() => {
    if (hoveredCompartmentId === null) return null;
    // A whole-bin compartment would just duplicate BinDimensions — skip it.
    if (getCompartmentCount(compartments) <= 1) return null;
    if (innerW <= 0 || innerD <= 0) return null;

    const cavity = compartmentCavity(compartments, hoveredCompartmentId, innerW, innerD);
    if (!cavity) return null;

    const { cols, rows } = compartments;
    const pitchX = innerW / cols;
    const pitchY = innerD / rows;

    // Footprint span of the compartment (pitch-based), then center the cavity
    // (wall-subtracted) inside it. Row 0 = front = −Y (matches the generator).
    const footLeft = -innerW / 2 + cavity.minCol * pitchX;
    const footRight = -innerW / 2 + (cavity.maxCol + 1) * pitchX;
    const footFront = -innerD / 2 + cavity.minRow * pitchY;
    const footBack = -innerD / 2 + (cavity.maxRow + 1) * pitchY;
    const cx = (footLeft + footRight) / 2;
    const cy = (footFront + footBack) / 2;

    const xLeft = cx - cavity.width / 2;
    const xRight = cx + cavity.width / 2;
    const yFront = cy - cavity.depth / 2;
    const yBack = cy + cavity.depth / 2;

    // Height annotation tracks the resolved divider height (the wall that
    // actually separates this compartment), matching the readout's "H".
    const autoHeight = calculateDividerHeight({ height: 'auto' }, wallHeight, base.stackingLip);
    const dividerH = resolveCompartmentDividerHeight(compartments.dividerHeight, autoHeight);
    const topZ = floorZ + dividerH;

    return {
      width: {
        line: [
          [xLeft, yFront, topZ],
          [xRight, yFront, topZ],
        ] as [Vec3, Vec3],
        capLeft: [
          [xLeft, yFront - END_CAP, topZ],
          [xLeft, yFront + END_CAP, topZ],
        ] as [Vec3, Vec3],
        capRight: [
          [xRight, yFront - END_CAP, topZ],
          [xRight, yFront + END_CAP, topZ],
        ] as [Vec3, Vec3],
        labelPos: [cx, yFront - LABEL_GAP, topZ] as Vec3,
        label: formatMm(cavity.width),
      },
      depth: {
        line: [
          [xLeft, yFront, topZ],
          [xLeft, yBack, topZ],
        ] as [Vec3, Vec3],
        capFront: [
          [xLeft - END_CAP, yFront, topZ],
          [xLeft + END_CAP, yFront, topZ],
        ] as [Vec3, Vec3],
        capBack: [
          [xLeft - END_CAP, yBack, topZ],
          [xLeft + END_CAP, yBack, topZ],
        ] as [Vec3, Vec3],
        labelPos: [xLeft - LABEL_GAP, cy, topZ] as Vec3,
        label: formatMm(cavity.depth),
      },
      height: {
        line: [
          [xRight, yBack, floorZ],
          [xRight, yBack, topZ],
        ] as [Vec3, Vec3],
        capBottom: [
          [xRight - END_CAP, yBack, floorZ],
          [xRight + END_CAP, yBack, floorZ],
        ] as [Vec3, Vec3],
        capTop: [
          [xRight - END_CAP, yBack, topZ],
          [xRight + END_CAP, yBack, topZ],
        ] as [Vec3, Vec3],
        labelPos: [xRight + LABEL_GAP, yBack, floorZ + dividerH / 2] as Vec3,
        label: formatMm(dividerH),
      },
    };
  }, [hoveredCompartmentId, compartments, innerW, innerD, wallHeight, floorZ, base.stackingLip]);

  if (!geometry) return null;

  const lineProps = {
    color: colors.lineColor,
    lineWidth: 1,
    transparent: true,
    opacity: LINE_OPACITY,
  };
  const textProps = {
    fontSize: FONT_SIZE,
    color: colors.lineColor,
    fillOpacity: TEXT_OPACITY,
  };

  return (
    <group>
      {/* Width */}
      <Line points={geometry.width.line} {...lineProps} />
      <Line points={geometry.width.capLeft} {...lineProps} />
      <Line points={geometry.width.capRight} {...lineProps} />
      <Text position={geometry.width.labelPos} anchorX="center" anchorY="top" {...textProps}>
        {geometry.width.label}
      </Text>

      {/* Depth */}
      <Line points={geometry.depth.line} {...lineProps} />
      <Line points={geometry.depth.capFront} {...lineProps} />
      <Line points={geometry.depth.capBack} {...lineProps} />
      <Text
        position={geometry.depth.labelPos}
        anchorX="right"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
        {...textProps}
      >
        {geometry.depth.label}
      </Text>

      {/* Height */}
      <Line points={geometry.height.line} {...lineProps} />
      <Line points={geometry.height.capBottom} {...lineProps} />
      <Line points={geometry.height.capTop} {...lineProps} />
      <Text position={geometry.height.labelPos} anchorX="left" anchorY="middle" {...textProps}>
        {geometry.height.label}
      </Text>
    </group>
  );
}
