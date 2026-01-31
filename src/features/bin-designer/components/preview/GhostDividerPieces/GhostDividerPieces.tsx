/**
 * Renders ghost divider piece boxes in the 3D preview for slotted bins.
 *
 * Shows translucent cyan boxes at each slot position indicating where
 * removable dividers will sit. Always visible when style is 'slotted'
 * (not just during generation), so users can see divider placement
 * without waiting for mesh regeneration.
 *
 * Also renders a single reference divider piece offset from the bin,
 * showing the T-shaped cross-section (wall + edge tabs) so users can
 * visualize the actual divider geometry without exporting.
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

  const { params } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
    }))
  );

  const { width, depth, height, wallThickness, style, slotConfig, dividerPieces } = params;

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = totalH - GRIDFINITY.SOCKET_HEIGHT;
  const floorZ = GRIDFINITY.BASE_HEIGHT;
  const hasLip = params.base.stackingLip;

  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const lipOverhang = hasLip ? Math.max(0, lipTaperWidth - wallThickness) : 0;

  const shouldShow = style === 'slotted' && (slotConfig.x.enabled || slotConfig.y.enabled);

  // ── Sync preview color from PreviewCanvas via localStorage + custom event ─
  const [previewColor, setPreviewColor] = useState(() => {
    try {
      return localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_COLOR;
    } catch {
      return DEFAULT_COLOR;
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setPreviewColor(detail);
    };
    window.addEventListener('preview-color-change', handler);
    return () => window.removeEventListener('preview-color-change', handler);
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
      // Effective slot depth: 50% of wall thickness, clamped to [0.5, 1.5]mm
      const slotDepth = Math.min(1.5, Math.max(0.5, wallThickness * 0.5));
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
      const slotDepth = Math.min(1.5, Math.max(0.5, wallThickness * 0.5));
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

  // ── Reference divider: single box offset from the bin ──────────────────
  // Tab thickness simplifies to exactly `thickness` (slotWidth - 2*clearance
  // = thickness + 2*clearance - 2*clearance), so the divider is a plain
  // rectangular wall — one BoxGeometry suffices.
  const referenceGeometry = useMemo(() => {
    if (!shouldShow) return null;

    const { thickness, clearance } = dividerPieces;
    const slotDepth = Math.min(1.5, Math.max(0.5, wallThickness * 0.5));
    const dividerHeight = calculateDividerHeight(dividerPieces, wallHeight, hasLip);

    const isXFirst = slotConfig.x.enabled;
    const divLength = isXFirst
      ? calculateDividerLength(innerW, slotDepth, clearance)
      : calculateDividerLength(innerD, slotDepth, clearance);

    if (divLength <= 0 || dividerHeight <= 0) return null;

    return new THREE.BoxGeometry(divLength, thickness, dividerHeight);
  }, [shouldShow, slotConfig, dividerPieces, innerW, innerD, wallThickness, wallHeight, hasLip]);

  // Position: offset from the bin, raised so bottom sits at bin floor level
  const dividerHeight = useMemo(() => {
    if (!shouldShow) return 0;
    return calculateDividerHeight(dividerPieces, wallHeight, hasLip);
  }, [shouldShow, dividerPieces, wallHeight, hasLip]);

  const referencePosition = useMemo<[number, number, number]>(() => {
    if (!shouldShow) return [0, 0, 0];

    const isXFirst = slotConfig.x.enabled;
    if (isXFirst) {
      // X-axis divider spans X direction → place offset in +Y (behind bin)
      return [0, outerD / 2 + REFERENCE_GAP, floorZ + dividerHeight / 2];
    }
    // Y-axis divider spans Y direction → place offset in +X (right of bin),
    // rotated 90° around Z so its length runs along Y
    return [outerW / 2 + REFERENCE_GAP, 0, floorZ + dividerHeight / 2];
  }, [shouldShow, slotConfig, outerW, outerD, floorZ, dividerHeight]);

  // Rotation: Y-axis dividers need 90° Z rotation so they span the Y direction
  const referenceRotation = useMemo<[number, number, number]>(() => {
    if (!shouldShow) return [0, 0, 0];
    return slotConfig.x.enabled ? [0, 0, 0] : [0, 0, Math.PI / 2];
  }, [shouldShow, slotConfig]);

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
      referenceGeometry?.dispose();
      referenceMaterial?.dispose();
    };
  }, [geometry, material, referenceGeometry, referenceMaterial]);

  useEffect(() => {
    if (geometry || referenceGeometry) invalidate();
  }, [geometry, material, referenceGeometry, referenceMaterial, ghostVisible, invalidate]);

  if (!shouldShow) return null;

  return (
    <>
      {ghostVisible && geometry && material && (
        <mesh geometry={geometry} material={material} position={[0, 0, 0]} renderOrder={1} />
      )}
      {referenceGeometry && referenceMaterial && (
        <mesh
          geometry={referenceGeometry}
          material={referenceMaterial}
          position={referencePosition}
          rotation={referenceRotation}
          renderOrder={1}
        />
      )}
    </>
  );
}
