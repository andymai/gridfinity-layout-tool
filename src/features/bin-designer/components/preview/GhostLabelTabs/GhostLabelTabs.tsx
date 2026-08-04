/**
 * Renders ghost label tab shelf planes in the 3D preview during mesh regeneration.
 *
 * Shows translucent amber quads at the top of each compartment's back edge where
 * label tabs will appear. Provides immediate visual feedback when the user changes
 * label tab width, depth, alignment, or support style.
 *
 * Position math mirrors binGenerator.ts buildLabelTabs.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  labelLipReservationMm,
  labelShelfCeilingMm,
  resolveLabelShelfTopMm,
} from '@/shared/constants/labelPlates';
import {
  compartmentTabEligible,
  compartmentTabXSpan,
  spanningTabEligible,
} from '@/features/bin-designer/utils/compartments';

const GHOST_COLOR = '#fbbf24';
const GHOST_OPACITY = 0.45;

export function GhostLabelTabs() {
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
    baseStyle,
    stackingLip,
    compartments,
    label,
    generationStatus,
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
      baseStyle: s.params.base.style,
      stackingLip: s.params.base.stackingLip,
      compartments: s.params.compartments,
      label: s.params.label,
      generationStatus: s.generation.status,
    }))
  );
  const { cols, rows, cells } = compartments;

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * heightUnitMm;
  // Floor sits at SOCKET_HEIGHT for socketed bins, at z=0 for flat. The wall
  // top is at totalH in both cases (the socket extends below the floor).
  // Mirrors `binDimensions`.
  const wallHeightMm = baseStyle === 'flat' ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const floorZ = baseStyle === 'flat' ? 0 : GRIDFINITY.SOCKET_HEIGHT;
  // World Z of the shelf TOP — the same resolution the BREP builder runs
  // (interior ceiling under the lip taper, stacking relief for click-in
  // sockets, an explicit `label.height` capped at that plane), so the ghost
  // lands exactly
  // where the regenerated mesh will (#1898).
  const shelfTopWorldZ =
    floorZ +
    resolveLabelShelfTopMm(labelShelfCeilingMm(wallHeightMm, stackingLip), stackingLip, label);

  const shouldShow =
    label.enabled &&
    style !== 'slotted' &&
    generationStatus === 'generating' &&
    cells.length >= rows * cols;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const cellD = innerD / rows;
    // Socket mode (#2666) forces full-width tabs in the worker; mirror that.
    // (The rare bin-spanning fallback — no compartment fits a plate — still
    // ghosts as per-compartment shelves; the overlay is a transient
    // approximation and the exact mesh replaces it.)
    const widthPercent = (label.mode ?? 'text') === 'socket' ? 100 : label.width;
    // Use `label.depth` directly (not clamped to cellD) so the ghost reflects
    // the actual shelf depth the worker would produce. The collision and
    // depth-vs-compartment guards below silently drop tabs that won't fit.
    const tabDepth = label.depth;
    const alignment = label.alignment;
    const inset = label.inset ?? 0;
    const edges = label.edges ?? 'back';
    const includeBack = edges === 'back' || edges === 'both';
    const includeFront = edges === 'front' || edges === 'both';

    const fit = { tabDepth, inset, cellD, bothEdges: edges === 'both' };

    const matrices: THREE.Matrix4[] = [];

    // Lip strip (#2971): a thin vertical rim ghosted along each tab's free edge
    // for instant feedback before the mesh regenerates. 0 unless the lip is
    // enabled on a text-mode tab. Rotating the base XY quad to vertical (XZ)
    // lets the merge loop below consume it like any tab quad; local Z ∈
    // [0, lipHeight] renders above the shelf plane once the mesh's
    // shelfTopWorldZ offset is applied.
    const lipHeight = labelLipReservationMm({
      mode: label.mode,
      lip: label.lip,
      lipHeight: label.lipHeight,
    });
    const pushLipStrip = (centerX: number, freeEdgeY: number, tabWidth: number) => {
      if (lipHeight <= 0) return;
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(centerX, freeEdgeY, lipHeight / 2),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
        new THREE.Vector3(tabWidth, lipHeight, 1)
      );
      matrices.push(m);
    };

    // Build per-row tab quads for one anchor (back or front). Mirrors the
    // worker-side grouping in `labelTabBuilder.ts` — both must stay in sync
    // so the ghost overlay matches the eventual BREP output.
    // Full-width mode (#2897): one shelf per row, outer wall to outer wall.
    const buildSpanningRow = (row: number, anchor: 'back' | 'front') => {
      const depthSign = anchor === 'back' ? -1 : 1;
      if (!spanningTabEligible(compartments, row, anchor, fit)) return;

      const availableLeft = -innerW / 2;
      const availableRight = innerW / 2;
      const tabWidth = ((availableRight - availableLeft) * widthPercent) / 100;
      if (tabWidth <= 0) return;

      let tabXStart: number;
      if (alignment === 'left') {
        tabXStart = availableLeft;
      } else if (alignment === 'right') {
        tabXStart = availableRight - tabWidth;
      } else {
        tabXStart = (availableLeft + availableRight) / 2 - tabWidth / 2;
      }

      const anchorY =
        anchor === 'back' ? -innerD / 2 + (row + 1) * cellD : -innerD / 2 + row * cellD;
      const centerY = anchorY + depthSign * inset + depthSign * (tabDepth / 2);

      const matrix = new THREE.Matrix4();
      matrix.makeScale(tabWidth, tabDepth, 1);
      matrix.setPosition(tabXStart + tabWidth / 2, centerY, 0);
      matrices.push(matrix);
      pushLipStrip(tabXStart + tabWidth / 2, centerY + depthSign * (tabDepth / 2), tabWidth);
    };

    const buildAnchorRow = (row: number, anchor: 'back' | 'front') => {
      const depthSign = anchor === 'back' ? -1 : 1;
      const isOuterEdgeRow = anchor === 'back' ? row === rows - 1 : row === 0;
      const neighborRowOffset = anchor === 'back' ? 1 : -1;

      let col = 0;
      while (col < cols) {
        const cellId = cells[row * cols + col];
        const neighborCellId = isOuterEdgeRow
          ? undefined
          : cells[(row + neighborRowOffset) * cols + col];

        const hasEdge = isOuterEdgeRow || cellId !== neighborCellId;
        if (!hasEdge) {
          col++;
          continue;
        }

        // Same predicate the worker gates on, so the ghost can't show a tab
        // that will be silently dropped from the mesh (#1904 review).
        if (!compartmentTabEligible(compartments, cellId, anchor, fit)) {
          col++;
          continue;
        }

        // Find extent of consecutive same-compId columns with edges
        let groupEnd = col + 1;
        while (groupEnd < cols) {
          const gCellId = cells[row * cols + groupEnd];
          const gNeighborCellId = isOuterEdgeRow
            ? undefined
            : cells[(row + neighborRowOffset) * cols + groupEnd];
          if (gCellId !== cellId || !(isOuterEdgeRow || gCellId !== gNeighborCellId)) break;
          groupEnd++;
        }

        // Same span the worker builds against, so a shifted divider moves the
        // ghost and the mesh together (#3225).
        const span = compartmentTabXSpan(compartments, cellId, innerW);
        if (!span) {
          col = groupEnd;
          continue;
        }
        const { left: availableLeft, right: availableRight } = span;
        const availableWidth = availableRight - availableLeft;

        const tabWidth = (availableWidth * widthPercent) / 100;
        if (tabWidth <= 0) {
          col = groupEnd;
          continue;
        }

        let tabXStart: number;
        if (alignment === 'left') {
          tabXStart = availableLeft;
        } else if (alignment === 'right') {
          tabXStart = availableRight - tabWidth;
        } else {
          const availableCenter = (availableLeft + availableRight) / 2;
          tabXStart = availableCenter - tabWidth / 2;
        }

        const anchorY =
          anchor === 'back' ? -innerD / 2 + (row + 1) * cellD : -innerD / 2 + row * cellD;
        const positionY = anchorY + depthSign * inset;
        const centerY = positionY + depthSign * (tabDepth / 2);

        const matrix = new THREE.Matrix4();
        matrix.makeScale(tabWidth, tabDepth, 1);
        matrix.setPosition(tabXStart + tabWidth / 2, centerY, 0);
        matrices.push(matrix);
        pushLipStrip(tabXStart + tabWidth / 2, centerY + depthSign * (tabDepth / 2), tabWidth);

        col = groupEnd;
      }
    };

    const buildRow = label.span === true ? buildSpanningRow : buildAnchorRow;
    for (let row = 0; row < rows; row++) {
      if (includeBack) buildRow(row, 'back');
      if (includeFront) buildRow(row, 'front');
    }

    if (matrices.length === 0) return null;

    // Merge all quads into a single BufferGeometry
    const plane = new THREE.PlaneGeometry(1, 1);
    const merged = new THREE.BufferGeometry();
    const allPositions: number[] = [];
    const allIndices: number[] = [];

    const basePositions = plane.getAttribute('position');
    const baseIndex = plane.getIndex();
    if (!baseIndex) {
      plane.dispose();
      return null;
    }

    for (let i = 0; i < matrices.length; i++) {
      const offset = i * basePositions.count;

      // Transform each vertex by the matrix
      for (let v = 0; v < basePositions.count; v++) {
        const vec = new THREE.Vector3(
          basePositions.getX(v),
          basePositions.getY(v),
          basePositions.getZ(v)
        );
        vec.applyMatrix4(matrices[i]);
        allPositions.push(vec.x, vec.y, vec.z);
      }

      for (let j = 0; j < baseIndex.count; j++) {
        allIndices.push(baseIndex.array[j] + offset);
      }
    }

    plane.dispose();

    merged.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    merged.setIndex(allIndices);

    return merged;
  }, [
    shouldShow,
    innerW,
    innerD,
    cols,
    rows,
    cells,
    compartments,
    label.width,
    label.mode,
    label.depth,
    label.alignment,
    label.edges,
    label.inset,
    label.span,
    label.lip,
    label.lipHeight,
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

  // Dispose resources on unmount or change
  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  // Invalidate frame when geometry changes
  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  if (!geometry || !material) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 0, shelfTopWorldZ + 0.2]}
      renderOrder={2}
    />
  );
}
