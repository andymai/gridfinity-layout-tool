/**
 * Multi-piece Three.js renderer for split baseplates.
 *
 * Positions each piece at its grid offset in assembled mode, or adds
 * explode gaps between pieces in exploded mode for visual clarity.
 * Each piece supports hover/click interaction
 * that syncs with the panel mini-map via the page store.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import {
  MESH_MATERIAL_PROPS,
  EDGE_MATERIAL_PROPS,
  PREVIEW_EMISSIVE_INTENSITY,
  desaturateColor,
} from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { computePiecePlacement } from './pieceLayout';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { useSettingsStore } from '@/core/store';
import { getAccentHex } from '@/shared/utils/color';
import type { PieceMeshEntry, SplitViewMode } from '../../store/baseplatePageStore';

/** Face opacity when xray mode is enabled (matches BaseplateMesh). */
const XRAY_OPACITY = 0.3;

interface PieceMeshProps {
  readonly entry: PieceMeshEntry;
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  readonly splitViewMode: SplitViewMode;
  readonly hoveredPieceLabel: string | null;
  readonly selectedPieceLabel: string | null;
  readonly isPreview: boolean;
  readonly xray: boolean;
}

/** Renders a single piece mesh with position offset, color, and interaction. */
function PieceMesh({
  entry,
  totalWidthMm,
  totalDepthMm,
  gridUnitMm,
  gridUnitMmY,
  splitViewMode,
  hoveredPieceLabel,
  selectedPieceLabel,
  isPreview,
  xray,
}: PieceMeshProps) {
  const { invalidate } = useThree();
  const colors = useThreeColors();
  const filamentColor = useSettingsStore((s) => s.settings.baseplateFilamentColor);
  const displayColor = useMemo(
    // 0.7 gray-blend (was 0.5) — smooth normals + edge wireframes pulled the
    // preview close to BREP-quality, so a stronger desaturation keeps the
    // "draft" affordance legible.
    () => (isPreview ? desaturateColor(filamentColor, 0.7) : filamentColor),
    [filamentColor, isPreview]
  );
  const emissiveIntensity = isPreview
    ? PREVIEW_EMISSIVE_INTENSITY
    : MESH_MATERIAL_PROPS.emissiveIntensity;
  const accentHex = useMemo(() => getAccentHex(), []);

  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry(entry.mesh);

  const setHoveredPieceLabel = useBaseplatePageStore((s) => s.setHoveredPieceLabel);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);
  const isHoveredRef = useRef(false);

  // Reset cursor on unmount
  useEffect(() => {
    return () => {
      if (isHoveredRef.current) {
        document.body.style.cursor = 'auto';
      }
    };
  }, []);

  const activePiece = hoveredPieceLabel ?? selectedPieceLabel;
  const isActive = entry.label === activePiece;
  // Dim non-active pieces only while hovering — when no pointer is over any
  // piece, every piece renders at full brightness.
  const isDimmed = hoveredPieceLabel !== null && !isActive;

  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  const handlePointerOver = useCallback(() => {
    setHoveredPieceLabel(entry.label);
    isHoveredRef.current = true;
    document.body.style.cursor = 'pointer';
  }, [entry.label, setHoveredPieceLabel]);

  const handlePointerOut = useCallback(() => {
    setHoveredPieceLabel(null);
    isHoveredRef.current = false;
    document.body.style.cursor = 'auto';
  }, [setHoveredPieceLabel]);

  const handleClick = useCallback(() => {
    setSelectedPieceLabel(selectedPieceLabel === entry.label ? null : entry.label);
  }, [entry.label, selectedPieceLabel, setSelectedPieceLabel]);

  // Single source of truth for placement + footprint. Depth uses the Y pitch so
  // pieces collapse without a residual per-row gap on non-square grids (#3089).
  const placement = computePiecePlacement(entry, {
    totalWidthMm,
    totalDepthMm,
    gridUnitMm,
    gridUnitMmY,
    splitViewMode,
  });

  // Invisible hit-test plane covering the full piece footprint.
  // Catches pointer events over socket holes and empty areas within the piece.
  const { widthMm: pieceWidthMm, depthMm: pieceDepthMm } = placement;

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

  const { x, y } = placement;

  // 180°-rotated placement keeps a single canonical mesh shared between
  // opposite-corner pieces (preferIdenticalPieces). Rotation is around the
  // piece center, applied via the inner group so the outer group still owns
  // the world translation and the hit plane stays axis-aligned for the picker.
  const rotZ = entry.placementRotationDeg === 180 ? Math.PI : 0;

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
      <group rotation={[0, 0, rotZ]}>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            {...MESH_MATERIAL_PROPS}
            color={displayColor}
            emissive={displayColor}
            emissiveIntensity={emissiveIntensity}
            flatShading={!hasPrecomputedNormals}
            transparent={isDimmed || xray}
            opacity={xray ? (isDimmed ? 0.55 * XRAY_OPACITY : XRAY_OPACITY) : isDimmed ? 0.55 : 1}
            depthWrite={!xray}
          />
        </mesh>
        {edgesGeometry && (
          <lineSegments geometry={edgesGeometry} renderOrder={1}>
            <lineBasicMaterial {...EDGE_MATERIAL_PROPS} />
          </lineSegments>
        )}
      </group>
      {splitViewMode === 'exploded' && (
        <Text
          position={[0, 0, GRIDFINITY_SPEC.SOCKET_HEIGHT + 3]}
          fontSize={5}
          color={accentHex}
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
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  readonly isPreview?: boolean;
  readonly xray?: boolean;
}

/**
 * Renders all pieces of a split baseplate with assembled or exploded positioning.
 */
export function SplitBaseplateMeshes({
  totalWidthUnits,
  totalDepthUnits,
  gridUnitMm,
  gridUnitMmY,
  isPreview = false,
  xray = false,
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

  const totalWidthMm = totalWidthUnits * gridUnitMm;
  const totalDepthMm = totalDepthUnits * gridUnitMmY;

  return (
    <>
      {pieceMeshes.map((entry) => (
        <PieceMesh
          key={entry.label}
          entry={entry}
          totalWidthMm={totalWidthMm}
          totalDepthMm={totalDepthMm}
          gridUnitMm={gridUnitMm}
          gridUnitMmY={gridUnitMmY}
          splitViewMode={splitViewMode}
          hoveredPieceLabel={hoveredPieceLabel}
          selectedPieceLabel={selectedPieceLabel}
          isPreview={isPreview}
          xray={xray}
        />
      ))}
    </>
  );
}
