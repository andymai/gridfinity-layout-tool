/**
 * Renders ghost scoop ramps in the 3D preview during mesh regeneration.
 *
 * Shows translucent quarter-cylinder shapes at the scooped edge of each
 * compartment where scoops will appear. Provides immediate visual feedback
 * when the user toggles scoops or changes radius/side.
 *
 * Position math mirrors binGenerator.ts buildScoopRamps.
 */

import { useMemo } from 'react';
import {
  baseFloorZ,
  baseWallHeight,
  cutoutInterior,
} from '@/features/bin-designer/utils/binDimensions';
import * as THREE from 'three';
import { useGhostMeshMaterial } from '../useGhostMeshMaterial';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import {
  resolveScoopProfile,
  resolveScoopPlacement,
  resolveScoopSides,
  computeLipOffset,
  computeInteriorHeight,
  scoopArcAnchors,
  scoopFaceOffset,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveOverhang, taperInsetAt } from '@/shared/utils/overhang';
import { resolveBinFloorMm } from '@/shared/utils/slotMath';

const GHOST_COLOR = '#f97316';
const GHOST_OPACITY = 0.35;
const ARC_SEGMENTS = 16;

export function GhostScoops() {
  const {
    params,
    height,
    heightUnitMm,
    wallThickness,
    style,
    compartments,
    scoop,
    base,
    cellMask,
    overhang,
    lid,
    floorThickness,
    generationStatus,
  } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      height: s.params.height,
      heightUnitMm: s.params.heightUnitMm,
      wallThickness: s.params.wallThickness,
      style: s.params.style,
      compartments: s.params.compartments,
      scoop: s.params.scoop,
      base: s.params.base,
      cellMask: s.params.cellMask,
      overhang: s.params.overhang,
      lid: s.params.lid,
      floorThickness: resolveBinFloorMm(s.params),
      generationStatus: s.generation.status,
    }))
  );
  const { cols, rows, cells } = compartments;

  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);

  const hasLip = base.stackingLip;
  const totalH = height * heightUnitMm;
  const boxWallHeight = baseWallHeight(base, totalH);
  // The ramp stands on the interior floor: its rise clamps against the heights
  // above that floor and the strip is drawn from there, matching the worker.
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

    const sides = resolveScoopSides(scoop);
    const { taper } = resolveOverhang(isPartialMask(cellMask) ? undefined : overhang);
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

        // One ghost per selected wall, mirroring `scoopRampBuilder`'s loop so
        // the overlay shows what the worker will build.
        for (const side of sides) {
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
          const { height, style } = profile;
          const wallAt = (zAboveFloor: number): number =>
            taper && isOuter
              ? taperInsetAt(taper, taper[side], floorThickness + zAboveFloor, boxWallHeight)
              : 0;
          const wallAtTop = wallAt(height);
          const { arcTop, floorStart } = scoopArcAnchors(
            lipOffset,
            wallAtTop,
            wallAt(0),
            scoopFaceOffset(isOuter, compartments.thickness)
          );
          const run = Math.min(profile.run, depth - 0.5 - floorStart);
          if (run < 1) continue;

          // Build the ramp surface as a triangle strip: two rows of vertices, one
          // at each end of the compartment along the scooped wall.
          const alongMin = alongCenter - span / 2;
          const alongMax = alongCenter + span / 2;

          // Ramp profile points, from where the arc leaves its wall (the lip
          // face, or a divider's face) down to the floor: a concave
          // quarter-ellipse for 'curved', a single bevel edge for 'straight'.
          const profilePoints: [number, number][] = [];
          if (style === 'curved') {
            for (let i = 0; i <= ARC_SEGMENTS; i++) {
              const angle = (Math.PI / 2) * (i / ARC_SEGMENTS);
              const z = height * (1 - Math.sin(angle));
              profilePoints.push([arcTop + wallAt(z) - wallAtTop + run * (1 - Math.cos(angle)), z]);
            }
          } else {
            profilePoints.push([arcTop, height]);
            profilePoints.push([floorStart + run, 0]);
          }

          for (const [dRun, dz] of profilePoints) {
            const runCoord = edge + runSign * dRun;
            const z = floorThickness + dz;
            if (runsAlongY) {
              allPositions.push(offsetX + alongMin, offsetY + runCoord, z);
              allPositions.push(offsetX + alongMax, offsetY + runCoord, z);
            } else {
              allPositions.push(offsetX + runCoord, offsetY + alongMin, z);
              allPositions.push(offsetX + runCoord, offsetY + alongMax, z);
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
    offsetX,
    offsetY,
    interiorHeight,
    wallHeight,
    boxWallHeight,
    floorThickness,
    wallThickness,
    hasLip,
    lipTaperWidth,
    compartments,
    cols,
    rows,
    cells,
    scoop,
    overhang,
    cellMask,
  ]);

  const material = useGhostMeshMaterial(geometry, { color: GHOST_COLOR, opacity: GHOST_OPACITY });

  if (!geometry || !material) return null;

  // Position at socket height so Z=0 in local coords = bin floor
  const floorZ = baseFloorZ(base, heightUnitMm, lid, cellMask);
  return <mesh geometry={geometry} material={material} position={[0, 0, floorZ]} renderOrder={2} />;
}
