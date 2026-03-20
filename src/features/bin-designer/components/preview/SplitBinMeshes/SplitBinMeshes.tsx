/**
 * Multi-piece Three.js renderer for split bin preview.
 *
 * Positions each piece at its grid offset in assembled mode, or adds
 * explode gaps between pieces in exploded mode for visual clarity.
 * Mirrors the SplitBaseplateMeshes pattern from the baseplate feature.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { SplitPieceMeshEntry } from '../../../types';

/** Gap between pieces in exploded mode (mm) */
const EXPLODE_GAP_MM = 10;

/** Small Z offset so split pieces render above the grid floor */
const PIECE_Z_OFFSET = 0.1;

/** Vertical gap between bin top and floating piece label (mm) */
const LABEL_OFFSET_MM = 3;

/** Edge line color (matches BinMesh) */
const EDGE_COLOR = '#000000';

/** Fallback accent hex (amber-500) when CSS var is unavailable. */
const FALLBACK_ACCENT = '#f59e0b';

function getAccentHex(): string {
  if (typeof document === 'undefined') return FALLBACK_ACCENT;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
  return raw || FALLBACK_ACCENT;
}

interface PieceMeshProps {
  readonly entry: SplitPieceMeshEntry;
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
  readonly gridUnitMm: number;
  readonly explodeX: number;
  readonly explodeY: number;
  readonly isExploded: boolean;
  readonly color: string;
  readonly wireframe: boolean;
  readonly labelZ: number;
}

/** Renders a single split bin piece with position offset and optional label. */
function PieceMesh({
  entry,
  totalWidthMm,
  totalDepthMm,
  gridUnitMm,
  explodeX,
  explodeY,
  isExploded,
  color,
  wireframe,
  labelZ,
}: PieceMeshProps) {
  const { invalidate } = useThree();
  const colors = useThreeColors();
  const accentHex = useMemo(() => getAccentHex(), []);

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry(entry.mesh);

  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  if (!geometry) return null;

  // Position: piece's grid center relative to the total bin center
  const pieceWidthMm = entry.widthUnits * gridUnitMm;
  const pieceDepthMm = entry.depthUnits * gridUnitMm;
  const pieceCenterX = entry.offsetX * gridUnitMm + pieceWidthMm / 2 - totalWidthMm / 2;
  const pieceCenterY = entry.offsetY * gridUnitMm + pieceDepthMm / 2 - totalDepthMm / 2;

  const x = pieceCenterX + explodeX;
  const y = pieceCenterY + explodeY;

  return (
    <group position={[x, y, PIECE_Z_OFFSET]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0}
          wireframe={wireframe}
          side={THREE.DoubleSide}
          emissive={color}
          emissiveIntensity={0.08}
          flatShading={!hasPrecomputedNormals}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {!wireframe && edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color={EDGE_COLOR} />
        </lineSegments>
      )}
      {isExploded && (
        <Text
          position={[0, 0, labelZ]}
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
}

/**
 * Renders all pieces of a split bin with assembled or exploded positioning.
 */
export function SplitBinMeshes({ color, wireframe }: SplitBinMeshesProps) {
  const { splitPieceMeshes, splitViewMode, params } = useDesignerStore(
    useShallow((s) => ({
      splitPieceMeshes: s.ui.splitPieceMeshes,
      splitViewMode: s.ui.splitViewMode,
      params: s.params,
    }))
  );

  const gridUnitMm = params.gridUnitMm;
  const totalWidthMm = params.width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const totalDepthMm = params.depth * gridUnitMm - GRIDFINITY.TOLERANCE;
  const totalH = params.height * GRIDFINITY.HEIGHT_UNIT;
  const isExploded = splitViewMode === 'exploded';

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
      {splitPieceMeshes.map((entry) => {
        // Center the explosion: offset relative to midpoint so pieces spread symmetrically
        const explodeX = isExploded ? (entry.col - (maxCol + 1) / 2) * EXPLODE_GAP_MM : 0;
        const explodeY = isExploded ? (entry.row - (maxRow + 1) / 2) * EXPLODE_GAP_MM : 0;

        return (
          <PieceMesh
            key={entry.label}
            entry={entry}
            totalWidthMm={totalWidthMm}
            totalDepthMm={totalDepthMm}
            gridUnitMm={gridUnitMm}
            explodeX={explodeX}
            explodeY={explodeY}
            isExploded={isExploded}
            color={color}
            wireframe={wireframe}
            labelZ={labelZ}
          />
        );
      })}
    </>
  );
}
