/**
 * Multi-piece Three.js renderer for split bin preview.
 *
 * Each piece renders in the bin's own frame, so it takes the same colors as
 * the unsplit bin; exploded mode only adds a gap between pieces. Mirrors the
 * SplitBaseplateMeshes pattern from the baseplate feature.
 */

import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { getAccentHex } from '@/shared/utils/color';
import { useZoneColoredMesh } from '@/features/bin-designer/hooks/useZoneColoredMesh';
import type { ZoneClickHandler } from '@/features/bin-designer/hooks/useZoneColoredMesh';
import { colorFrameOf, mergeColorFrameParts } from '@/features/bin-designer/utils/colorFrame';
import type { ColorFrame } from '@/features/bin-designer/utils/colorFrame';
import { isMultiColorDesign } from '@/features/bin-designer/utils/multiColorDesign';
import {
  splitPieceCenterMm,
  splitPieceInBinFrame,
} from '@/features/bin-designer/utils/splitPieceFrame';
import type { SplitPieceBinFrameMesh } from '@/features/bin-designer/utils/splitPieceFrame';
import type { SplitPieceMeshEntry } from '../../../types';

/** Gap between pieces in exploded mode (mm) */
const EXPLODE_GAP_MM = 10;

/** Small Z offset so split pieces render above the grid floor */
const PIECE_Z_OFFSET = 0.1;

/** Vertical gap between bin top and floating piece label (mm) */
const LABEL_OFFSET_MM = 3;

/** Edge line color (matches BinMesh) */
const EDGE_COLOR = '#000000';

interface PieceMeshProps {
  readonly entry: SplitPieceMeshEntry;
  readonly mesh: SplitPieceBinFrameMesh;
  readonly frame: ColorFrame | null;
  readonly center: { readonly x: number; readonly y: number };
  readonly explodeX: number;
  readonly explodeY: number;
  readonly isExploded: boolean;
  readonly color: string;
  readonly wireframe: boolean;
  readonly xray: boolean;
  readonly labelZ: number;
  readonly onZoneClick?: ZoneClickHandler;
}

/** Renders a single split bin piece with position offset and optional label. */
function PieceMesh({
  entry,
  mesh,
  frame,
  center,
  explodeX,
  explodeY,
  isExploded,
  color,
  wireframe,
  xray,
  labelZ,
  onZoneClick,
}: PieceMeshProps) {
  const colors = useThreeColors();
  const accentHex = useMemo(() => getAccentHex(), []);

  const { geometry, edgesGeometry, materials, singleMatProps, meshProps } = useZoneColoredMesh({
    ...mesh,
    frame,
    wireframe,
    xray,
    color,
    onZoneClick,
  });

  if (!geometry) return null;

  // Same keyed multi↔single swap as BinMesh: reusing one <mesh> lets R3F's
  // prop diff clobber the zone materials.
  const pieceMesh = materials ? (
    <mesh key="multi-color" geometry={geometry} material={materials} {...meshProps} />
  ) : (
    <mesh key="single-color" geometry={geometry} {...meshProps}>
      <meshStandardMaterial {...singleMatProps} />
    </mesh>
  );

  return (
    <group position={[explodeX, explodeY, PIECE_Z_OFFSET]}>
      {pieceMesh}
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color={EDGE_COLOR} />
        </lineSegments>
      )}
      {isExploded && (
        <Text
          position={[center.x, center.y, labelZ]}
          fontSize={5}
          color={accentHex}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.3}
          outlineColor={colors.gradientBottom}
          renderOrder={2}
          raycast={() => null}
        >
          {entry.label}
        </Text>
      )}
    </group>
  );
}

interface SplitBinMeshesProps {
  readonly color: string;
  readonly wireframe: boolean;
  readonly xray?: boolean;
  /** Same contract as BinMesh: fired on a piece click while a color tool is active. */
  readonly onZoneClick?: ZoneClickHandler;
}

/**
 * Renders all pieces of a split bin with assembled or exploded positioning.
 */
export function SplitBinMeshes({
  color,
  wireframe,
  xray = false,
  onZoneClick,
}: SplitBinMeshesProps) {
  const { splitPieceMeshes, splitViewMode, params } = useDesignerStore(
    useShallow((s) => ({
      splitPieceMeshes: s.ui.splitPieceMeshes,
      splitViewMode: s.ui.splitViewMode,
      params: s.params,
    }))
  );

  const { width, depth, gridUnitMm, gridUnitMmY } = params;
  const totalH = params.height * params.heightUnitMm;
  const isExploded = splitViewMode === 'exploded';

  const pieces = useMemo(() => {
    const bin = { width, depth, gridUnitMm, gridUnitMmY };
    return splitPieceMeshes.map((entry) => ({
      entry,
      center: splitPieceCenterMm(entry, bin),
      mesh: splitPieceInBinFrame(entry, bin),
    }));
  }, [splitPieceMeshes, width, depth, gridUnitMm, gridUnitMmY]);

  // Measured over every piece at once: a piece measured alone puts the lip's
  // center inside itself and paints all four lip corners on each piece.
  const multiColor = isMultiColorDesign(params);
  const { featureColors } = params;
  const merged = useMemo(() => {
    if (!multiColor) return null;
    const parts = [];
    for (const { mesh } of pieces) {
      if (!mesh.vertices || !mesh.indices || !mesh.faceGroups) return null;
      parts.push({ vertices: mesh.vertices, indices: mesh.indices, faceGroups: mesh.faceGroups });
    }
    return parts.length > 0 ? mergeColorFrameParts(parts) : null;
  }, [multiColor, pieces]);
  const frame = useMemo(
    () => (merged ? colorFrameOf(merged, featureColors) : null),
    [merged, featureColors]
  );

  // Compute max col/row for centering the explosion offsets
  const maxCol = useMemo(
    () => splitPieceMeshes.reduce((m, e) => Math.max(m, e.col), 0),
    [splitPieceMeshes]
  );
  const maxRow = useMemo(
    () => splitPieceMeshes.reduce((m, e) => Math.max(m, e.row), 0),
    [splitPieceMeshes]
  );

  const labelZ = totalH + LABEL_OFFSET_MM;

  return (
    <>
      {pieces.map(({ entry, center, mesh }) => {
        // Center the explosion: offset relative to midpoint so pieces spread symmetrically
        const explodeX = isExploded ? (entry.col - (maxCol + 1) / 2) * EXPLODE_GAP_MM : 0;
        const explodeY = isExploded ? (entry.row - (maxRow + 1) / 2) * EXPLODE_GAP_MM : 0;

        return (
          <PieceMesh
            key={entry.label}
            entry={entry}
            mesh={mesh}
            frame={frame}
            center={center}
            explodeX={explodeX}
            explodeY={explodeY}
            isExploded={isExploded}
            color={color}
            wireframe={wireframe}
            xray={xray}
            labelZ={labelZ}
            onZoneClick={onZoneClick}
          />
        );
      })}
    </>
  );
}
