/**
 * Multi-piece Three.js renderer for split baseplates.
 *
 * Positions each piece at its grid offset in assembled mode, or adds
 * explode gaps between pieces in exploded mode for visual clarity.
 * Each piece is color-coded and supports hover/click interaction
 * that syncs with the panel mini-map via the page store.
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { EXPLODE_GAP_MM } from '../../constants';
import { useThreeColors } from '@/hooks/useThemeEffect';
import type { PieceMeshEntry, SplitViewMode } from '../../store/baseplatePageStore';

/** Default mesh color shared by all pieces. */
const PIECE_COLOR = '#d4d8dc';

interface PieceMeshProps {
  readonly entry: PieceMeshEntry;
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
  readonly explodeX: number;
  readonly explodeY: number;
  readonly splitViewMode: SplitViewMode;
  readonly hoveredPieceLabel: string | null;
  readonly selectedPieceLabel: string | null;
}

/** Renders a single piece mesh with position offset, color, and interaction. */
function PieceMesh({
  entry,
  totalWidthMm,
  totalDepthMm,
  explodeX,
  explodeY,
  splitViewMode,
  hoveredPieceLabel,
  selectedPieceLabel,
}: PieceMeshProps) {
  const { invalidate } = useThree();
  const colors = useThreeColors();
  const { vertices, normals, indices, edgeVertices } = entry.mesh;
  const hasPrecomputedNormals = normals !== null && normals.length > 0;

  const setHoveredPieceLabel = useBaseplatePageStore((s) => s.setHoveredPieceLabel);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);

  const activePiece = hoveredPieceLabel ?? selectedPieceLabel;
  const isActive = entry.label === activePiece;
  // Only dim non-active pieces during hover — when no pointer is over any
  // piece, the full baseplate should render at normal brightness.
  const isDimmed = hoveredPieceLabel !== null && !isActive;

  const geometry = useMemo(() => {
    if (!vertices || vertices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    if (indices && indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    if (hasPrecomputedNormals) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geo.computeVertexNormals();
    }

    return geo;
  }, [vertices, normals, indices, hasPrecomputedNormals]);

  const edgesGeometry = useMemo(() => {
    if (!edgeVertices || edgeVertices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      edgesGeometry?.dispose();
    };
  }, [geometry, edgesGeometry]);

  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  const handlePointerOver = useCallback(() => {
    setHoveredPieceLabel(entry.label);
    document.body.style.cursor = 'pointer';
  }, [entry.label, setHoveredPieceLabel]);

  const handlePointerOut = useCallback(() => {
    setHoveredPieceLabel(null);
    document.body.style.cursor = 'auto';
  }, [setHoveredPieceLabel]);

  const handleClick = useCallback(() => {
    setSelectedPieceLabel(selectedPieceLabel === entry.label ? null : entry.label);
  }, [entry.label, selectedPieceLabel, setSelectedPieceLabel]);

  // Invisible hit-test plane covering the full piece footprint.
  // Catches pointer events over socket holes and empty areas within the piece.
  const GS = GRIDFINITY_SPEC.GRID_SIZE;
  const pieceWidthMm = entry.widthUnits * GS;
  const pieceDepthMm = entry.depthUnits * GS;

  const hitPlaneGeometry = useMemo(
    () => new THREE.PlaneGeometry(pieceWidthMm, pieceDepthMm),
    [pieceWidthMm, pieceDepthMm]
  );

  useEffect(() => {
    return () => {
      hitPlaneGeometry.dispose();
    };
  }, [hitPlaneGeometry]);

  if (!geometry) return null;

  // Position: piece's grid center relative to the total baseplate center
  const pieceCenterX = entry.offsetX * GS + pieceWidthMm / 2 - totalWidthMm / 2;
  const pieceCenterY = entry.offsetY * GS + pieceDepthMm / 2 - totalDepthMm / 2;

  const x = pieceCenterX + explodeX;
  const y = pieceCenterY + explodeY;

  return (
    <group position={[x, y, 0.1]}>
      {/* Invisible hit plane for continuous hover over socket holes */}
      <mesh
        geometry={hitPlaneGeometry}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={PIECE_COLOR}
          roughness={0.45}
          metalness={0}
          side={THREE.DoubleSide}
          emissive={PIECE_COLOR}
          emissiveIntensity={isActive ? 0.25 : 0.08}
          flatShading={!hasPrecomputedNormals}
          transparent={isDimmed}
          opacity={isDimmed ? 0.55 : 1}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color="#000000" />
        </lineSegments>
      )}
      {splitViewMode === 'exploded' && (
        <Text
          position={[0, 0, GRIDFINITY_SPEC.SOCKET_HEIGHT + 3]}
          fontSize={5}
          color={isActive ? colors.labelColor : colors.labelColor}
          fillOpacity={isActive ? 1 : 0.6}
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

interface SplitBaseplateMeshesProps {
  readonly totalWidthUnits: number;
  readonly totalDepthUnits: number;
}

/**
 * Renders all pieces of a split baseplate with assembled or exploded positioning.
 */
export function SplitBaseplateMeshes({
  totalWidthUnits,
  totalDepthUnits,
}: SplitBaseplateMeshesProps) {
  const { pieceMeshes, splitViewMode, hoveredPieceLabel, selectedPieceLabel } =
    useBaseplatePageStore(
      useShallow((s) => ({
        pieceMeshes: s.pieceMeshes,
        splitViewMode: s.splitViewMode,
        hoveredPieceLabel: s.hoveredPieceLabel,
        selectedPieceLabel: s.selectedPieceLabel,
      }))
    );

  const GS = GRIDFINITY_SPEC.GRID_SIZE;
  const totalWidthMm = totalWidthUnits * GS;
  const totalDepthMm = totalDepthUnits * GS;

  return (
    <>
      {pieceMeshes.map((entry) => {
        const explodeX = splitViewMode === 'exploded' ? entry.col * EXPLODE_GAP_MM : 0;
        const explodeY = splitViewMode === 'exploded' ? entry.row * EXPLODE_GAP_MM : 0;

        return (
          <PieceMesh
            key={entry.label}
            entry={entry}
            totalWidthMm={totalWidthMm}
            totalDepthMm={totalDepthMm}
            explodeX={explodeX}
            explodeY={explodeY}
            splitViewMode={splitViewMode}
            hoveredPieceLabel={hoveredPieceLabel}
            selectedPieceLabel={selectedPieceLabel}
          />
        );
      })}
    </>
  );
}
