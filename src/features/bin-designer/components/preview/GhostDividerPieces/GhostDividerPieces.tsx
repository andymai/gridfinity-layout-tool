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
import { baseFloorZ, baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  calculateSlotPositions,
  calculateDividerLength,
  calculateDividerPieceHeight,
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  dividerGrooveDepth,
  dividerSeatZ,
  getEffectiveSlotDimensions,
  getReceptacleDepth,
  lapNotchWidth,
  resolveCrossDividerMode,
  dividerInterior,
  MIN_WALL_FOR_SLOTS,
  tabEngagement,
} from '@/shared/utils/slotMath';
import {
  clearOfNotches,
  keepBottomBand,
  planPieceWindow,
  windowBottomBand,
  windowCornerBand,
} from '@/shared/utils/dividerPieceWindow';
import { pieceCorners, resolveDividerFilletSeat } from '@/shared/utils/slottedFillet';
import type { PieceCorners } from '@/shared/utils/slottedFillet';
import { useDividerBedFit } from './useDividerBedFit';
import { referencePieceGeometry } from './referencePieceOutline';
import { inBinGhostGeometry, mergeBoxes, slotSegments } from './inBinGhost';

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
    base,
    lid,
    overhang,
    cellMask,
    fractionalEdgeX,
    fractionalEdgeY,
    magnetAnchor,
    walls,
    interiorFilletMm,
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
      base: s.params.base,
      lid: s.params.lid,
      overhang: s.params.overhang,
      cellMask: s.params.cellMask,
      fractionalEdgeX: s.params.fractionalEdgeX,
      fractionalEdgeY: s.params.fractionalEdgeY,
      magnetAnchor: s.params.magnetAnchor,
      walls: s.params.walls,
      interiorFilletMm: s.params.interiorFilletMm,
    }))
  );

  const bedFit = useDividerBedFit();

  const { outerW, outerD, innerW, innerD, offsetX, offsetY } = dividerInterior({
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    wallThickness,
    overhang,
    cellMask,
  });
  const totalH = height * heightUnitMm;
  const wallHeight = baseWallHeight(base, totalH);
  // Socketed bases are translated up by SOCKET_HEIGHT in preview. The pieces
  // seat on the interior floor top, or the groove floor below it, never on the
  // body's Z=0. Flat bases have no offset.
  const grooveDepth = dividerGrooveDepth({
    style,
    dividerPieces,
    base,
    wallThickness,
    slotConfig,
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    fractionalEdgeX,
    fractionalEdgeY,
    magnetAnchor,
    cellMask,
  });
  const seatZ = dividerSeatZ(wallThickness, base.style, grooveDepth);
  const floorZ = baseFloorZ(base, heightUnitMm, lid, cellMask) + seatZ;
  // Over an interior fillet, each end that seats in a wall slot is rounded.
  const filletSeat = useMemo(
    () =>
      resolveDividerFilletSeat(
        {
          interiorFilletMm,
          style,
          base,
          cellMask,
          wallThickness,
          dividerPieces,
          slotConfig,
          width,
          depth,
          gridUnitMm,
          gridUnitMmY,
          fractionalEdgeX,
          fractionalEdgeY,
          magnetAnchor,
        },
        { innerW, innerD, wallHeight, hasLip }
      ),
    [
      interiorFilletMm,
      style,
      base,
      cellMask,
      wallThickness,
      dividerPieces,
      slotConfig,
      width,
      depth,
      gridUnitMm,
      gridUnitMmY,
      fractionalEdgeX,
      fractionalEdgeY,
      magnetAnchor,
      innerW,
      innerD,
      wallHeight,
      hasLip,
    ]
  );

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
    return inBinGhostGeometry({
      slotConfig,
      dividerPieces,
      dividerHeight: calculateDividerPieceHeight(dividerPieces, wallHeight, hasLip, seatZ),
      wallThickness,
      innerW,
      innerD,
      offsetX,
      offsetY,
      floorZ,
      lipOverhang,
      filletSeat,
      shape: walls.shape,
    });
  }, [
    shouldShow,
    slotConfig,
    dividerPieces,
    innerW,
    innerD,
    offsetX,
    offsetY,
    wallThickness,
    wallHeight,
    hasLip,
    floorZ,
    seatZ,
    lipOverhang,
    filletSeat,
    walls.shape,
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
  // A single-direction divider is a plain rectangular wall. With both
  // directions enabled, each piece carries cross-lap notches (X pieces notched
  // from the top, Y from the bottom), modeled here as merged box segments to
  // match the export. The neck relief and the piece fit's thinning take at most
  // 0.6mm off the faces and leave the outline alone, too little to read at
  // preview scale, so the piece shows its full thickness.
  const dividerHeight = useMemo(() => {
    if (!shouldShow) return 0;
    return calculateDividerPieceHeight(dividerPieces, wallHeight, hasLip, seatZ);
  }, [shouldShow, dividerPieces, wallHeight, hasLip, seatZ]);

  const referencePieces = useMemo(() => {
    if (!shouldShow) return [];

    const { thickness, clearance } = dividerPieces;
    const { slotDepth } = getEffectiveSlotDimensions(wallThickness, thickness, clearance);
    const notchWidth = lapNotchWidth(dividerPieces);
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

      for (const seg of slotSegments(notchPositions, length, notchWidth)) {
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
          ? [offsetX, offsetY + outerD / 2 + REFERENCE_GAP, floorZ + dividerHeight / 2]
          : [offsetX + outerW / 2 + REFERENCE_GAP, offsetY, floorZ + dividerHeight / 2];
      const stackStep: [number, number] = axis === 'x' ? [0, thickness + 5] : [thickness + 5, 0];
      const rotation: [number, number, number] = axis === 'x' ? [0, 0, 0] : [0, 0, Math.PI / 2];
      const notchFromTop = axis === 'x';

      const push = (
        key: string,
        length: number,
        notches: number[],
        index: number,
        engagement: number,
        corners: PieceCorners | null
      ): void => {
        const planned = planPieceWindow(
          walls,
          wallThickness,
          length - 2 * engagement,
          0,
          dividerHeight - grooveDepth
        );
        const clear =
          planned &&
          clearOfNotches(
            planned,
            notches.map((offset) => ({ offset, width: notchWidth })),
            dividerHeight,
            notchDepth
          );
        const window =
          clear &&
          keepBottomBand(
            clear,
            dividerHeight,
            windowCornerBand(
              clear,
              length,
              corners,
              windowBottomBand(dividerHeight, length, bedFit)
            )
          );
        pieces.push({
          key,
          geometry:
            window || corners
              ? referencePieceGeometry(
                  length,
                  dividerHeight,
                  thickness,
                  notches.map((offset) => ({
                    offset,
                    width: notchWidth,
                    depth: notchDepth,
                    fromTop: notchFromTop,
                  })),
                  window || null,
                  walls.shape,
                  corners
                )
              : buildPieceGeometry(length, notches, notchFromTop),
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
        const receptacle = tabEngagement(getReceptacleDepth(thickness), clearance);
        let index = 0;
        if (lengths.interior !== null && lengths.interior > 0) {
          push(`${axis}-interior`, lengths.interior, [], index++, receptacle, null);
        }
        if (lengths.edge !== null && lengths.edge > 0) {
          const wallTab = tabEngagement(slotDepth, clearance);
          push(
            `${axis}-edge`,
            lengths.edge,
            [],
            index,
            Math.min(wallTab, receptacle),
            pieceCorners(filletSeat, true, false)
          );
        }
        return;
      }

      const length = calculateDividerLength(spanDim, slotDepth, clearance);
      const notches =
        bothAxes && !insertActive ? calculateSlotPositions(spanDim, crossPitch, lipOverhang) : [];
      if (length > 0) {
        push(
          axis,
          length,
          notches,
          0,
          tabEngagement(slotDepth, clearance),
          pieceCorners(filletSeat, true, true)
        );
      }
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
    offsetX,
    offsetY,
    wallThickness,
    dividerHeight,
    floorZ,
    lipOverhang,
    walls,
    grooveDepth,
    bedFit,
    filletSeat,
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
