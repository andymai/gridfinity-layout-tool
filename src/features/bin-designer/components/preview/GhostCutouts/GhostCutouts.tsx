/**
 * Renders ghost cutout outlines in the 3D preview during mesh regeneration.
 *
 * Shows translucent shape outlines at the top surface and at the cut depth
 * of each cutout, providing instant visual feedback for cutout placement
 * and depth while the mesh is being regenerated.
 *
 * Uses Line2 for proper line width support across WebGL implementations.
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

/** Ghost line color (cyan for cutouts — distinct from amber dividers) */
const GHOST_COLOR = '#22d3ee';
const GHOST_OPACITY = 0.6;
const LINE_WIDTH = 2;
/** Number of segments for circle approximation */
const CIRCLE_SEGMENTS = 24;

export function GhostCutouts() {
  const { invalidate, size } = useThree();
  const lineRef = useRef<LineSegments2 | null>(null);
  const materialRef = useRef<LineMaterial | null>(null);

  const canvasWidth = size?.width ?? 800;
  const canvasHeight = size?.height ?? 600;

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

  const { cutouts, base } = params;
  const isSolid = base.solid;
  const totalH = params.height * GRIDFINITY.HEIGHT_UNIT;
  const isFlat = base.style === 'flat';
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.BASE_HEIGHT;
  const floorZ = isFlat ? 0 : GRIDFINITY.BASE_HEIGHT;

  const shouldShow = isSolid && cutouts.length > 0 && generationStatus === 'generating';

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    const positions: number[] = [];

    for (const cutout of cutouts) {
      // Positions in model space (same as inserts)
      const cx = cutout.x;
      const cy = cutout.y;
      const topZ = floorZ + wallHeight;
      const bottomZ = floorZ + wallHeight - cutout.cutDepth;

      if (cutout.shape === 'circle') {
        const r = cutout.width / 2;
        // Draw circle outline at top and bottom
        for (let z = 0; z < 2; z++) {
          const zVal = z === 0 ? topZ : bottomZ;
          for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
            const a1 = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            const a2 = ((i + 1) / CIRCLE_SEGMENTS) * Math.PI * 2;
            positions.push(
              cx + Math.cos(a1) * r,
              cy + Math.sin(a1) * r,
              zVal,
              cx + Math.cos(a2) * r,
              cy + Math.sin(a2) * r,
              zVal
            );
          }
        }
        // Vertical lines connecting top and bottom circles (4 points)
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          positions.push(px, py, topZ, px, py, bottomZ);
        }
      } else {
        // Rectangle
        const hw = cutout.width / 2;
        const hd = cutout.depth / 2;
        const corners = [
          [cx - hw, cy - hd],
          [cx + hw, cy - hd],
          [cx + hw, cy + hd],
          [cx - hw, cy + hd],
        ];

        // Draw rectangle outline at top and bottom
        for (let z = 0; z < 2; z++) {
          const zVal = z === 0 ? topZ : bottomZ;
          for (let i = 0; i < 4; i++) {
            const [x1, y1] = corners[i];
            const [x2, y2] = corners[(i + 1) % 4];
            positions.push(x1, y1, zVal, x2, y2, zVal);
          }
        }
        // Vertical lines at corners
        for (const [px, py] of corners) {
          positions.push(px, py, topZ, px, py, bottomZ);
        }
      }
    }

    if (positions.length === 0) return null;

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [shouldShow, cutouts, floorZ, wallHeight]);

  const material = useMemo(() => {
    if (!shouldShow) return null;

    return new LineMaterial({
      color: new THREE.Color(GHOST_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthTest: true,
      resolution: new THREE.Vector2(canvasWidth, canvasHeight),
    });
  }, [shouldShow, canvasWidth, canvasHeight]);

  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.resolution.set(canvasWidth, canvasHeight);
    }
  });

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

  return (
    <primitive
      ref={lineRef}
      object={new LineSegments2(geometry, material)}
      position={[0, 0, 0.1]}
      renderOrder={3}
    />
  );
}
