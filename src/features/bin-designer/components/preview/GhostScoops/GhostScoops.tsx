/**
 * Renders ghost scoop ramps in the 3D preview during mesh regeneration.
 *
 * Shows translucent quarter-cylinder shapes at the front edge of each
 * compartment where scoops will appear. Provides immediate visual feedback
 * when the user toggles scoops, changes radius, or modifies allRows.
 *
 * Position math mirrors binGenerator.ts buildScoopCuts.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

const GHOST_COLOR = '#f97316';
const GHOST_OPACITY = 0.35;
const ARC_SEGMENTS = 16;

export function GhostScoops() {
  const { invalidate } = useThree();

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const { width, depth, height, wallThickness, style, compartments, scoop, base } = params;
  const { cols, rows, cells } = compartments;

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  // Mirror the generator's interiorHeight calculation for radius clamping
  const hasLip = base.stackingLip;
  const isFlat = base.style === 'flat';
  const totalH = height * GRIDFINITY.HEIGHT_UNIT + (hasLip ? GRIDFINITY.LIP_HEIGHT : 0);
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const interiorHeight = hasLip ? wallHeight - GRIDFINITY.LIP_SMALL_TAPER : wallHeight;

  const shouldShow =
    scoop.enabled &&
    style === 'standard' &&
    generationStatus === 'generating' &&
    cells.length >= rows * cols;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const cellW = innerW / cols;
    const cellD = innerD / rows;

    const processedCompartments = new Set<number>();
    const allPositions: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    for (let row = 0; row < rows; row++) {
      if (!scoop.allRows && row !== 0) continue;

      for (let col = 0; col < cols; col++) {
        const compId = cells[row * cols + col];
        if (processedCompartments.has(compId)) continue;
        processedCompartments.add(compId);

        // Find compartment bounds
        let minCol = cols,
          maxCol = -1,
          minRow = rows,
          maxRow = -1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (cells[r * cols + c] === compId) {
              minCol = Math.min(minCol, c);
              maxCol = Math.max(maxCol, c);
              minRow = Math.min(minRow, r);
              maxRow = Math.max(maxRow, r);
            }
          }
        }
        if (maxCol === -1) continue;
        if (!scoop.allRows && minRow !== 0) continue;

        const compCols = maxCol - minCol + 1;
        const compRows = maxRow - minRow + 1;
        const compW = compCols * cellW;
        const compD = compRows * cellD;

        const minDim = Math.min(compW, compD);
        let radius: number;
        if (scoop.radius === 'auto') {
          radius = Math.min(minDim / 3, 15);
        } else {
          radius = scoop.radius;
        }
        radius = Math.min(radius, compD - 0.5, interiorHeight - 0.5);
        if (radius < 1) continue;

        // Compartment position
        const compCenterX = -innerW / 2 + (minCol + compCols / 2) * cellW;
        const frontEdgeY = -innerD / 2 + minRow * cellD;

        // Build a quarter-cylinder surface as a triangle strip
        // Two rows of vertices: left edge and right edge of the compartment
        const leftX = compCenterX - compW / 2;
        const rightX = compCenterX + compW / 2;

        // Concave arc: quarter-circle centered at (radius, radius)
        // Curves toward the wall-floor corner, matching the BRep ramp surface
        for (let i = 0; i <= ARC_SEGMENTS; i++) {
          const angle = (Math.PI / 2) * (i / ARC_SEGMENTS);
          const dy = radius * (1 - Math.cos(angle)); // distance from wall into compartment
          const dz = radius * (1 - Math.sin(angle)); // height

          // Left vertex
          allPositions.push(leftX, frontEdgeY + dy, dz);
          // Right vertex
          allPositions.push(rightX, frontEdgeY + dy, dz);
        }

        // Build triangle indices for the strip
        for (let i = 0; i < ARC_SEGMENTS; i++) {
          const bl = vertexOffset + i * 2;
          const br = bl + 1;
          const tl = bl + 2;
          const tr = bl + 3;
          allIndices.push(bl, br, tl);
          allIndices.push(br, tr, tl);
        }

        vertexOffset += (ARC_SEGMENTS + 1) * 2;
      }
    }

    if (allPositions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    geo.setIndex(allIndices);
    geo.computeVertexNormals();
    return geo;
  }, [shouldShow, innerW, innerD, interiorHeight, cols, rows, cells, scoop.radius, scoop.allRows]);

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

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  if (!geometry || !material) return null;

  // Position at socket height so Z=0 in local coords = bin floor
  const socketZ = GRIDFINITY.SOCKET_HEIGHT;
  return (
    <mesh geometry={geometry} material={material} position={[0, 0, socketZ]} renderOrder={2} />
  );
}
