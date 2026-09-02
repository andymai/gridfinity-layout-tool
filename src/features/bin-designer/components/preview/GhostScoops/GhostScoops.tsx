/**
 * Renders ghost scoop ramps in the 3D preview during mesh regeneration.
 *
 * Shows translucent quarter-cylinder shapes at the scooped edge of each
 * compartment where scoops will appear. Provides immediate visual feedback
 * when the user toggles scoops or changes radius/side.
 *
 * Position math mirrors binGenerator.ts buildScoopRamps.
 */

import { useMemo, useEffect } from 'react';
import { baseWallHeight } from '@/features/bin-designer/utils/binDimensions';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import {
  resolveScoopProfile,
  resolveScoopPlacement,
  resolveScoopSide,
  computeLipOffset,
  computeInteriorHeight,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import { binFloorMm } from '@/shared/types/bin';

const GHOST_COLOR = '#f97316';
const GHOST_OPACITY = 0.35;
const ARC_SEGMENTS = 16;

export function GhostScoops() {
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
    compartments,
    scoop,
    base,
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
      compartments: s.params.compartments,
      scoop: s.params.scoop,
      base: s.params.base,
      generationStatus: s.generation.status,
    }))
  );
  const { cols, rows, cells } = compartments;

  const outerW = width * gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = depth * (gridUnitMmY ?? gridUnitMm) - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  const hasLip = base.stackingLip;
  const totalH = height * heightUnitMm;
  const boxWallHeight = baseWallHeight(base, totalH);
  // The ramp stands on the interior floor: its rise clamps against the heights
  // above that floor and the strip is drawn from there, matching the worker.
  const floorThickness = binFloorMm(wallThickness);
  const { wallHeight, interiorHeight } = scoopFrameHeights(
    boxWallHeight,
    computeInteriorHeight(boxWallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER),
    floorThickness
  );
  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;

  const shouldShow =
    scoop.enabled &&
    style === 'standard' &&
    generationStatus === 'generating' &&
    cells.length >= rows * cols;

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const side = resolveScoopSide(scoop);
    const processedCompartments = new Set<number>();
    const allPositions: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const compId = cells[row * cols + col];
        if (processedCompartments.has(compId)) continue;
        processedCompartments.add(compId);

        const bounds = getCompartmentBounds(compartments, compId);
        if (!bounds) continue;

        const placement = resolveScoopPlacement(side, bounds, { cols, rows, innerW, innerD });
        const { span, depth, isOuter, alongCenter, edge, runsAlongY, runSign } = placement;

        const lipOffset = computeLipOffset(hasLip, isOuter, lipTaperWidth, wallThickness);
        const profile = resolveScoopProfile(
          scoop,
          span,
          depth,
          isOuter,
          hasLip,
          wallHeight,
          interiorHeight,
          lipOffset
        );
        if (!profile) continue;
        const { run, height, style } = profile;

        // Build the ramp surface as a triangle strip: two rows of vertices, one
        // at each end of the compartment along the scooped wall.
        const alongMin = alongCenter - span / 2;
        const alongMax = alongCenter + span / 2;

        // Ramp profile points (offset by lipOffset so the scoop top meets the
        // lip): a concave quarter-ellipse for 'curved', a single bevel edge for
        // 'straight'. Runs from the wall top (dz = height) down to the floor.
        const profilePoints: [number, number][] = [];
        if (style === 'curved') {
          for (let i = 0; i <= ARC_SEGMENTS; i++) {
            const angle = (Math.PI / 2) * (i / ARC_SEGMENTS);
            profilePoints.push([
              lipOffset + run * (1 - Math.cos(angle)),
              height * (1 - Math.sin(angle)),
            ]);
          }
        } else {
          profilePoints.push([lipOffset, height]);
          profilePoints.push([lipOffset + run, 0]);
        }

        for (const [dRun, dz] of profilePoints) {
          const runCoord = edge + runSign * dRun;
          const z = floorThickness + dz;
          if (runsAlongY) {
            allPositions.push(alongMin, runCoord, z);
            allPositions.push(alongMax, runCoord, z);
          } else {
            allPositions.push(runCoord, alongMin, z);
            allPositions.push(runCoord, alongMax, z);
          }
        }

        // Build triangle indices for the strip
        for (let i = 0; i < profilePoints.length - 1; i++) {
          const bl = vertexOffset + i * 2;
          const br = bl + 1;
          const tl = bl + 2;
          const tr = bl + 3;
          allIndices.push(bl, br, tl);
          allIndices.push(br, tr, tl);
        }

        vertexOffset += profilePoints.length * 2;
      }
    }

    if (allPositions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    geo.setIndex(allIndices);
    geo.computeVertexNormals();
    return geo;
  }, [
    shouldShow,
    innerW,
    innerD,
    interiorHeight,
    wallHeight,
    floorThickness,
    wallThickness,
    hasLip,
    lipTaperWidth,
    compartments,
    cols,
    rows,
    cells,
    scoop,
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
