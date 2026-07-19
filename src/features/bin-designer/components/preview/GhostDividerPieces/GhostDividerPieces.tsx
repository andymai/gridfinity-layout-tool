/**
 * Renders ghost divider piece boxes in the 3D preview for slotted bins.
 *
 * Shows translucent cyan boxes at each slot position indicating where
 * removable dividers will sit. Always visible when style is 'slotted'
 * (not just during generation), so users can see divider placement
 * without waiting for mesh regeneration.
 *
 * Also renders a reference divider piece per enabled axis offset from
 * the bin — including cross-lap notches when both directions are on —
 * so users can visualize the actual divider geometry without exporting.
 *
 * Pattern matches GhostLabelTabs.tsx (batched geometry with matrix transforms).
 */

import { useMemo, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  calculateSlotPositions,
  calculateDividerHeight,
  calculateDividerLength,
  getEffectiveSlotDimensions,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';

const GHOST_COLOR = '#22d3ee';
const GHOST_OPACITY = 0.3;
/** Gap in mm between the bin outer wall and the reference divider */
const REFERENCE_GAP = 20;
/** How long in-bin ghost dividers stay visible after a param change (ms) */
const GHOST_LINGER_MS = 1500;
/** localStorage key matching PreviewCanvas — used to sync reference divider color */
const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
const DEFAULT_COLOR = '#d4d8dc';

export function GhostDividerPieces() {
  const { invalidate } = useThree();

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
    hasLip,
    baseStyle,
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
      hasLip: s.params.base.stackingLip,
      baseStyle: s.params.base.style,
    }))
  );

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * heightUnitMm;
  const isFlat = baseStyle === 'flat';
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  // Socketed bases are translated up by SOCKET_HEIGHT in preview, placing the
  // cavity floor at SOCKET_HEIGHT + wallThickness. Flat bases have no offset.
  const floorZ = (isFlat ? 0 : GRIDFINITY.SOCKET_HEIGHT) + wallThickness;

  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const lipOverhang = hasLip ? Math.max(0, lipTaperWidth - wallThickness) : 0;

  const shouldShow =
    style === 'slotted' &&
    wallThickness >= MIN_WALL_FOR_SLOTS &&
    (slotConfig.x.enabled || slotConfig.y.enabled);

  // ── Sync preview color from PreviewCanvas via localStorage + custom event ─
  const [previewColor, setPreviewColor] = useState(() => {
    try {
      return localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_COLOR;
    } catch {
      return DEFAULT_COLOR;
    }
  });

  useEffect(() => {
    const handler = (e: CustomEvent<string>) => {
      if (e.detail) setPreviewColor(e.detail);
    };
    window.addEventListener('preview-color-change', handler as EventListener);
    return () => window.removeEventListener('preview-color-change', handler as EventListener);
  }, []);

  // ── Ghost linger: show in-bin ghosts briefly after param changes ──────
  // The geometry useMemo returns a new object ref when any dependency changes,
  // and a *stable* ref when deps are unchanged (React memoization guarantee).
  // We track which geometry ref has been "timed out" — comparing by reference
  // identity (===) is intentional and reliable here because useMemo creates
  // exactly one BufferGeometry per unique set of inputs.
  const [hiddenGeometry, setHiddenGeometry] = useState<THREE.BufferGeometry | null>(null);
  const lingerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const dividerHeight = calculateDividerHeight(dividerPieces, wallHeight, hasLip);
    const { thickness, clearance } = dividerPieces;

    const matrices: THREE.Matrix4[] = [];
    const boxSizes: { w: number; d: number; h: number }[] = [];

    // X-axis dividers: span width (X), positioned along depth (Y)
    if (slotConfig.x.enabled) {
      const yPositions = calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang);
      const { slotDepth } = getEffectiveSlotDimensions(wallThickness, thickness, clearance);
      const divLength = calculateDividerLength(innerW, slotDepth, clearance);

      for (const yPos of yPositions) {
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(0, yPos, floorZ + dividerHeight / 2);
        matrices.push(matrix);
        boxSizes.push({ w: divLength, d: thickness, h: dividerHeight });
      }
    }

    // Y-axis dividers: span depth (Y), positioned along width (X)
    if (slotConfig.y.enabled) {
      const xPositions = calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang);
      const { slotDepth } = getEffectiveSlotDimensions(wallThickness, thickness, clearance);
      const divLength = calculateDividerLength(innerD, slotDepth, clearance);

      for (const xPos of xPositions) {
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(xPos, 0, floorZ + dividerHeight / 2);
        matrices.push(matrix);
        boxSizes.push({ w: thickness, d: divLength, h: dividerHeight });
      }
    }

    if (matrices.length === 0) return null;

    // Merge all boxes into a single BufferGeometry
    const allPositions: number[] = [];
    const allIndices: number[] = [];

    for (let i = 0; i < matrices.length; i++) {
      const { w, d, h } = boxSizes[i];
      const box = new THREE.BoxGeometry(w, d, h);
      const positions = box.getAttribute('position');
      const index = box.getIndex();
      if (!index) {
        box.dispose();
        continue;
      }

      const offset = allPositions.length / 3;

      for (let v = 0; v < positions.count; v++) {
        const vec = new THREE.Vector3(positions.getX(v), positions.getY(v), positions.getZ(v));
        vec.applyMatrix4(matrices[i]);
        allPositions.push(vec.x, vec.y, vec.z);
      }

      for (let j = 0; j < index.count; j++) {
        allIndices.push(index.array[j] + offset);
      }

      box.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    merged.setIndex(allIndices);

    return merged;
  }, [
    shouldShow,
    slotConfig,
    dividerPieces,
    innerW,
    innerD,
    wallThickness,
    wallHeight,
    hasLip,
    floorZ,
    lipOverhang,
  ]);

  // When geometry changes (new ref), it's a fresh param update — show ghosts.
  // After the linger timeout, mark this geometry as hidden. The timeout
  // callback is async so it doesn't trigger the set-state-in-effect lint rule.
  useEffect(() => {
    if (!geometry) return;
    clearTimeout(lingerTimer.current);
    lingerTimer.current = setTimeout(() => setHiddenGeometry(geometry), GHOST_LINGER_MS);
    return () => clearTimeout(lingerTimer.current);
  }, [geometry]);

  const ghostVisible = shouldShow && geometry !== null && geometry !== hiddenGeometry;

  // ── Reference dividers: one piece per enabled axis, offset from the bin ──
  // Tab thickness simplifies to exactly `thickness` (slotWidth - 2*clearance
  // = thickness + 2*clearance - 2*clearance), so a single-direction divider
  // is a plain rectangular wall. With both directions enabled, each piece
  // carries cross-lap notches (X pieces notched from the top, Y from the
  // bottom) — modeled here as merged box segments to match the export.
  const dividerHeight = useMemo(() => {
    if (!shouldShow) return 0;
    return calculateDividerHeight(dividerPieces, wallHeight, hasLip);
  }, [shouldShow, dividerPieces, wallHeight, hasLip]);

  const referencePieces = useMemo(() => {
    if (!shouldShow) return [];

    const { thickness, clearance } = dividerPieces;
    const { slotWidth, slotDepth } = getEffectiveSlotDimensions(
      wallThickness,
      thickness,
      clearance
    );
    if (dividerHeight <= 0) return [];

    const bothAxes = slotConfig.x.enabled && slotConfig.y.enabled;
    const notchDepth = dividerHeight / 2 + clearance;

    // Build a reference piece as merged boxes: full-height wall when there
    // are no notches, otherwise an intact half plus segments between notches.
    // Local space matches the rendered mesh: X = length, Y = thickness,
    // Z = installed height (centered).
    const buildPieceGeometry = (
      length: number,
      notchPositions: number[],
      notchFromTop: boolean
    ): THREE.BufferGeometry => {
      if (notchPositions.length === 0) {
        return new THREE.BoxGeometry(length, thickness, dividerHeight);
      }

      const intactH = dividerHeight - notchDepth;
      const segments: { x: number; z: number; w: number; h: number }[] = [
        // Intact strip: bottom for top-notched pieces, top for bottom-notched
        {
          x: 0,
          z: notchFromTop ? -notchDepth / 2 : notchDepth / 2,
          w: length,
          h: intactH,
        },
      ];

      const sorted = [...notchPositions].sort((a, b) => a - b);
      const edges = [
        -length / 2,
        ...sorted.flatMap((p) => [p - slotWidth / 2, p + slotWidth / 2]),
        length / 2,
      ];
      const segZ = notchFromTop
        ? (dividerHeight - notchDepth) / 2
        : -(dividerHeight - notchDepth) / 2;
      for (let i = 0; i < edges.length; i += 2) {
        const w = edges[i + 1] - edges[i];
        if (w <= 0) continue;
        segments.push({ x: (edges[i] + edges[i + 1]) / 2, z: segZ, w, h: notchDepth });
      }

      const positions: number[] = [];
      const indices: number[] = [];
      for (const seg of segments) {
        const boxGeo = new THREE.BoxGeometry(seg.w, thickness, seg.h);
        const pos = boxGeo.getAttribute('position');
        const index = boxGeo.getIndex();
        if (!index) {
          boxGeo.dispose();
          continue;
        }
        const offset = positions.length / 3;
        for (let v = 0; v < pos.count; v++) {
          positions.push(pos.getX(v) + seg.x, pos.getY(v), pos.getZ(v) + seg.z);
        }
        for (let j = 0; j < index.count; j++) {
          indices.push(index.array[j] + offset);
        }
        boxGeo.dispose();
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      merged.setIndex(indices);
      merged.computeVertexNormals();
      return merged;
    };

    const pieces: {
      axis: 'x' | 'y';
      geometry: THREE.BufferGeometry;
      position: [number, number, number];
      rotation: [number, number, number];
    }[] = [];

    if (slotConfig.x.enabled) {
      const length = calculateDividerLength(innerW, slotDepth, clearance);
      const notches = bothAxes
        ? calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang)
        : [];
      if (length > 0) {
        // X-axis divider spans X → place offset in +Y (behind bin)
        pieces.push({
          axis: 'x',
          geometry: buildPieceGeometry(length, notches, true),
          position: [0, outerD / 2 + REFERENCE_GAP, floorZ + dividerHeight / 2],
          rotation: [0, 0, 0],
        });
      }
    }

    if (slotConfig.y.enabled) {
      const length = calculateDividerLength(innerD, slotDepth, clearance);
      const notches = bothAxes
        ? calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang)
        : [];
      if (length > 0) {
        // Y-axis divider spans Y → place offset in +X (right of bin),
        // rotated 90° around Z so its length runs along Y
        pieces.push({
          axis: 'y',
          geometry: buildPieceGeometry(length, notches, false),
          position: [outerW / 2 + REFERENCE_GAP, 0, floorZ + dividerHeight / 2],
          rotation: [0, 0, Math.PI / 2],
        });
      }
    }

    return pieces;
  }, [
    shouldShow,
    slotConfig,
    dividerPieces,
    innerW,
    innerD,
    outerW,
    outerD,
    wallThickness,
    dividerHeight,
    floorZ,
    lipOverhang,
  ]);

  const material = useMemo(() => {
    if (!shouldShow) return null;

    return new THREE.MeshBasicMaterial({
      color: GHOST_COLOR,
      transparent: true,
      opacity: GHOST_OPACITY,
      side: THREE.DoubleSide,
      depthTest: true,
    });
  }, [shouldShow]);

  const referenceMaterial = useMemo(() => {
    if (!shouldShow) return null;

    return new THREE.MeshStandardMaterial({
      color: previewColor,
      roughness: 0.45,
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(previewColor),
      emissiveIntensity: 0.08,
      flatShading: true,
    });
  }, [shouldShow, previewColor]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
      for (const piece of referencePieces) piece.geometry.dispose();
      referenceMaterial?.dispose();
    };
  }, [geometry, material, referencePieces, referenceMaterial]);

  useEffect(() => {
    if (geometry || referencePieces.length > 0) invalidate();
  }, [geometry, material, referencePieces, referenceMaterial, ghostVisible, invalidate]);

  if (!shouldShow) return null;

  return (
    <>
      {ghostVisible && material && (
        <mesh geometry={geometry} material={material} position={[0, 0, 0]} renderOrder={1} />
      )}
      {referenceMaterial &&
        referencePieces.map((piece) => (
          <mesh
            key={piece.axis}
            geometry={piece.geometry}
            material={referenceMaterial}
            position={piece.position}
            rotation={piece.rotation}
            renderOrder={1}
          />
        ))}
    </>
  );
}
