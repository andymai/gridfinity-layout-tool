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
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  getEffectiveSlotDimensions,
  getReceptacleDepth,
  resolveCrossDividerMode,
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

/**
 * Split a span into the gaps left between crossing dividers, each `gapWidth`
 * wide. Returns the center and length of every positive-length gap (from the
 * span edge to the first divider, between dividers, and to the far edge).
 */
function slotSegments(
  positions: number[],
  span: number,
  gapWidth: number
): { center: number; len: number }[] {
  const sorted = [...positions].sort((a, b) => a - b);
  const edges = [
    -span / 2,
    ...sorted.flatMap((p) => [p - gapWidth / 2, p + gapWidth / 2]),
    span / 2,
  ];
  const segments: { center: number; len: number }[] = [];
  for (let i = 0; i < edges.length; i += 2) {
    const len = edges[i + 1] - edges[i];
    if (len > 0) segments.push({ center: (edges[i] + edges[i + 1]) / 2, len });
  }
  return segments;
}

/** Merge translated boxes into one BufferGeometry, remapping vertex indices. */
function mergeBoxes(
  boxes: { w: number; d: number; h: number; matrix: THREE.Matrix4 }[],
  computeNormals: boolean
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const vec = new THREE.Vector3();

  for (const { w, d, h, matrix } of boxes) {
    const box = new THREE.BoxGeometry(w, d, h);
    const pos = box.getAttribute('position');
    const index = box.getIndex();
    if (!index) {
      box.dispose();
      continue;
    }
    const offset = positions.length / 3;
    for (let v = 0; v < pos.count; v++) {
      vec.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(matrix);
      positions.push(vec.x, vec.y, vec.z);
    }
    for (let j = 0; j < index.count; j++) {
      indices.push(index.array[j] + offset);
    }
    box.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  if (computeNormals) merged.computeVertexNormals();
  return merged;
}

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
    const crossMode = resolveCrossDividerMode(slotConfig, thickness);
    const { slotDepth } = getEffectiveSlotDimensions(wallThickness, thickness, clearance);
    const boxZ = floorZ + dividerHeight / 2;
    const at = (x: number, y: number): THREE.Matrix4 =>
      new THREE.Matrix4().makeTranslation(x, y, boxZ);

    const boxes: { w: number; d: number; h: number; matrix: THREE.Matrix4 }[] = [];

    // In insert mode the short-axis ghosts are segmented per compartment:
    // one box per gap between long dividers (and between wall and divider).
    // Sub-0.5mm slivers are dropped.
    const compartmentSegments = (
      longPositions: number[],
      innerDim: number
    ): { center: number; len: number }[] =>
      slotSegments(longPositions, innerDim, thickness).filter((s) => s.len > 0.5);

    const xPositions = slotConfig.y.enabled
      ? calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang)
      : [];
    const yPositions = slotConfig.x.enabled
      ? calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang)
      : [];
    const insertActive =
      slotConfig.x.enabled &&
      slotConfig.y.enabled &&
      crossMode.style === 'insert' &&
      (crossMode.longAxis === 'y' ? xPositions : yPositions).length > 0;

    // X-axis dividers: span width (X), positioned along depth (Y)
    if (slotConfig.x.enabled) {
      const divLength = calculateDividerLength(innerW, slotDepth, clearance);
      const segmented = insertActive && crossMode.longAxis === 'y';

      for (const yPos of yPositions) {
        if (segmented) {
          for (const seg of compartmentSegments(xPositions, innerW)) {
            boxes.push({
              w: seg.len,
              d: thickness,
              h: dividerHeight,
              matrix: at(seg.center, yPos),
            });
          }
        } else {
          boxes.push({ w: divLength, d: thickness, h: dividerHeight, matrix: at(0, yPos) });
        }
      }
    }

    // Y-axis dividers: span depth (Y), positioned along width (X)
    if (slotConfig.y.enabled) {
      const divLength = calculateDividerLength(innerD, slotDepth, clearance);
      const segmented = insertActive && crossMode.longAxis === 'x';

      for (const xPos of xPositions) {
        if (segmented) {
          for (const seg of compartmentSegments(yPositions, innerD)) {
            boxes.push({
              w: thickness,
              d: seg.len,
              h: dividerHeight,
              matrix: at(xPos, seg.center),
            });
          }
        } else {
          boxes.push({ w: thickness, d: divLength, h: dividerHeight, matrix: at(xPos, 0) });
        }
      }
    }

    if (boxes.length === 0) return null;

    return mergeBoxes(boxes, false);
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
      const segZ = notchFromTop ? intactH / 2 : -intactH / 2;
      const boxes: { w: number; d: number; h: number; matrix: THREE.Matrix4 }[] = [
        // Intact strip: bottom for top-notched pieces, top for bottom-notched
        {
          w: length,
          d: thickness,
          h: intactH,
          matrix: new THREE.Matrix4().makeTranslation(
            0,
            0,
            notchFromTop ? -notchDepth / 2 : notchDepth / 2
          ),
        },
      ];

      for (const seg of slotSegments(notchPositions, length, slotWidth)) {
        boxes.push({
          w: seg.len,
          d: thickness,
          h: notchDepth,
          matrix: new THREE.Matrix4().makeTranslation(seg.center, 0, segZ),
        });
      }

      return mergeBoxes(boxes, true);
    };

    const pieces: {
      key: string;
      geometry: THREE.BufferGeometry;
      position: [number, number, number];
      rotation: [number, number, number];
    }[] = [];

    // In insert mode the long piece renders plain (grooves are too shallow
    // to read at preview scale) and the short axis shows the compartment
    // pieces — interior and edge — stacked outward from the bin.
    const crossMode = resolveCrossDividerMode(slotConfig, thickness);
    const longPositions =
      bothAxes && crossMode.style === 'insert'
        ? calculateSlotPositions(
            crossMode.longAxis === 'y' ? innerW : innerD,
            slotConfig[crossMode.longAxis].pitch,
            lipOverhang
          )
        : [];
    const insertActive = bothAxes && crossMode.style === 'insert' && longPositions.length > 0;
    // Short pieces only exist where the short axis has rows to seat them
    const rows = insertActive
      ? calculateSlotPositions(
          crossMode.longAxis === 'y' ? innerD : innerW,
          slotConfig[crossMode.longAxis === 'y' ? 'x' : 'y'].pitch,
          lipOverhang
        )
      : [];

    const shortLengths = (spanDim: number): { interior: number | null; edge: number | null } => {
      const spans = calculateShortDividerSpans(longPositions, spanDim, thickness);
      return calculateShortDividerLengths(
        spans,
        slotDepth,
        getReceptacleDepth(thickness),
        clearance
      );
    };

    // Base position for each axis's reference, plus the direction to stack
    // additional pieces further away from the bin.
    const addAxisPieces = (axis: 'x' | 'y'): void => {
      const spanDim = axis === 'x' ? innerW : innerD;
      const crossPitch = axis === 'x' ? slotConfig.y.pitch : slotConfig.x.pitch;
      const basePosition: [number, number, number] =
        axis === 'x'
          ? [0, outerD / 2 + REFERENCE_GAP, floorZ + dividerHeight / 2]
          : [outerW / 2 + REFERENCE_GAP, 0, floorZ + dividerHeight / 2];
      const stackStep: [number, number] = axis === 'x' ? [0, thickness + 5] : [thickness + 5, 0];
      const rotation: [number, number, number] = axis === 'x' ? [0, 0, 0] : [0, 0, Math.PI / 2];
      const notchFromTop = axis === 'x';

      const push = (key: string, length: number, notches: number[], index: number): void => {
        pieces.push({
          key,
          geometry: buildPieceGeometry(length, notches, notchFromTop),
          position: [
            basePosition[0] + index * stackStep[0],
            basePosition[1] + index * stackStep[1],
            basePosition[2],
          ],
          rotation,
        });
      };

      const isShortAxis = insertActive && crossMode.longAxis !== axis;
      if (isShortAxis) {
        if (rows.length === 0) return;
        const lengths = shortLengths(spanDim);
        let index = 0;
        if (lengths.interior !== null && lengths.interior > 0) {
          push(`${axis}-interior`, lengths.interior, [], index++);
        }
        if (lengths.edge !== null && lengths.edge > 0) {
          push(`${axis}-edge`, lengths.edge, [], index);
        }
        return;
      }

      const length = calculateDividerLength(spanDim, slotDepth, clearance);
      const notches =
        bothAxes && !insertActive ? calculateSlotPositions(spanDim, crossPitch, lipOverhang) : [];
      if (length > 0) push(axis, length, notches, 0);
    };

    if (slotConfig.x.enabled) addAxisPieces('x');
    if (slotConfig.y.enabled) addAxisPieces('y');

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
            key={piece.key}
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
