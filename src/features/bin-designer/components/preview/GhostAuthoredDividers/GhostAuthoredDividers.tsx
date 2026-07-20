/**
 * Numbered assembly map for custom (authored-layout) removable dividers.
 *
 * Draws each seated divider wall as a line at the rim, with its 1-based number
 * at the center — matching the exported piece labels (`divider-01…`) so the
 * printed pieces can be placed by number. Only shown for slotted bins in
 * custom layout.
 */

import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import { computeAuthoredDividers } from '@/shared/utils/authoredDividerMath';
import { getEffectiveSlotDimensions } from '@/shared/utils/slotMath';
import { resolveOverhang, overhangExpansion } from '@/shared/utils/overhang';

const WALL_COLOR = '#22d3ee';
const LABEL_COLOR = '#e2e8f0';
const LABEL_SIZE = 4;

export function GhostAuthoredDividers() {
  const {
    width,
    depth,
    height,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    wallThickness,
    style,
    slotConfig,
    dividerPieces,
    overhang,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      heightUnitMm: s.params.heightUnitMm,
      wallThickness: s.params.wallThickness,
      style: s.params.style,
      slotConfig: s.params.slotConfig,
      dividerPieces: s.params.dividerPieces,
      overhang: s.params.overhang,
    }))
  );

  const active = style === 'slotted' && slotConfig.layout === 'custom';

  // Interior expands into the overhang in lockstep with the body.
  const ovh = overhangExpansion(resolveOverhang(overhang));
  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE + ovh.addW;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE + ovh.addD;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const topZ = height * heightUnitMm;

  const labels = useMemo(() => {
    const grid = slotConfig.customGrid;
    if (!active || !grid) return [];
    const { slotDepth } = getEffectiveSlotDimensions(
      wallThickness,
      dividerPieces.thickness,
      dividerPieces.clearance
    );
    const pieces = computeAuthoredDividers(
      deriveWallSegments(grid, innerW, innerD),
      innerW,
      innerD,
      dividerPieces.thickness,
      slotDepth,
      dividerPieces.clearance
    );
    return pieces.map((p) => {
      const isV = p.orientation === 'vertical';
      const a0 = Math.max(0, p.start);
      const a1 = Math.min(isV ? innerD : innerW, p.end);
      // Interior coords → centered scene coords. Asymmetric overhang shifts the
      // interior center by (offsetX, offsetY), matching the seated mesh.
      const cx = (v: number) => v - innerW / 2 + ovh.offsetX;
      const cy = (v: number) => v - innerD / 2 + ovh.offsetY;
      const start: [number, number, number] = isV
        ? [cx(p.pos), cy(a0), topZ]
        : [cx(a0), cy(p.pos), topZ];
      const end: [number, number, number] = isV
        ? [cx(p.pos), cy(a1), topZ]
        : [cx(a1), cy(p.pos), topZ];
      // Place the label ~30% along the divider (not the center) so the labels
      // of two crossing dividers don't stack on the same point.
      const t = 0.3;
      const labelPos: [number, number, number] = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        topZ + 0.5,
      ];
      return { index: p.index, start, end, labelPos };
    });
  }, [
    active,
    slotConfig.customGrid,
    innerW,
    innerD,
    topZ,
    wallThickness,
    dividerPieces.thickness,
    dividerPieces.clearance,
    ovh.offsetX,
    ovh.offsetY,
  ]);

  if (labels.length === 0) return null;

  return (
    <group renderOrder={3}>
      {labels.map((l) => (
        <group key={l.index}>
          <Line
            points={[l.start, l.end]}
            color={WALL_COLOR}
            lineWidth={2}
            transparent
            opacity={0.7}
          />
          <Text
            position={l.labelPos}
            fontSize={LABEL_SIZE}
            color={LABEL_COLOR}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.3}
            outlineColor="#0f172a"
          >
            {String(l.index)}
          </Text>
        </group>
      ))}
    </group>
  );
}
