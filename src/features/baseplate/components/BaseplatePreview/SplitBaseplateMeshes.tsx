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
import { EXPLODE_GAP_MM } from '../../constants';
import {
  MESH_MATERIAL_PROPS,
  EDGE_MATERIAL_PROPS,
  PREVIEW_EMISSIVE_INTENSITY,
  desaturateColor,
} from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { useSettingsStore } from '@/core/store';
import type { PieceMeshEntry, SplitViewMode } from '../../store/baseplatePageStore';

/** Fallback accent hex (amber-500) when CSS var is unavailable. */
const FALLBACK_ACCENT = '#f59e0b';

/** Read the current accent color from CSS custom properties. */
function getAccentHex(): string {
  if (typeof document === 'undefined') return FALLBACK_ACCENT;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
  return raw || FALLBACK_ACCENT;
}

interface PieceMeshProps {
  readonly entry: PieceMeshEntry;
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
  readonly gridUnitMm: number;
  readonly explodeX: number;
  readonly explodeY: number;
  readonly splitViewMode: SplitViewMode;
  readonly hoveredPieceLabel: string | null;
  readonly selectedPieceLabel: string | null;
  readonly isPreview: boolean;
}

/** Renders a single piece mesh with position offset, color, and interaction. */
function PieceMesh({
  entry,
  totalWidthMm,
  totalDepthMm,
  gridUnitMm,
  explodeX,
  explodeY,
  splitViewMode,
  hoveredPieceLabel,
  selectedPieceLabel,
  isPreview,
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

  // Invisible hit-test plane covering the full piece footprint.
  // Catches pointer events over socket holes and empty areas within the piece.
  const pieceWidthMm = entry.widthUnits * gridUnitMm;
  const pieceDepthMm = entry.depthUnits * gridUnitMm;

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
  const pieceCenterX = entry.offsetX * gridUnitMm + pieceWidthMm / 2 - totalWidthMm / 2;
  const pieceCenterY = entry.offsetY * gridUnitMm + pieceDepthMm / 2 - totalDepthMm / 2;

  const x = pieceCenterX + explodeX;
  const y = pieceCenterY + explodeY;

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
            transparent={isDimmed}
            opacity={isDimmed ? 0.55 : 1}
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
  readonly isPreview?: boolean;
}

/**
 * Renders all pieces of a split baseplate with assembled or exploded positioning.
 */
export function SplitBaseplateMeshes({
  totalWidthUnits,
  totalDepthUnits,
  gridUnitMm,
  isPreview = false,
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
  const totalDepthMm = totalDepthUnits * gridUnitMm;

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
            gridUnitMm={gridUnitMm}
            explodeX={explodeX}
            explodeY={explodeY}
            splitViewMode={splitViewMode}
            hoveredPieceLabel={hoveredPieceLabel}
            selectedPieceLabel={selectedPieceLabel}
            isPreview={isPreview}
          />
        );
      })}
    </>
  );
}
