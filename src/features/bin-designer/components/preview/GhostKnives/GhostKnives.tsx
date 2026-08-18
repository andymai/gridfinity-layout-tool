/**
 * Translucent side profiles of the knives a block's slots were sized for,
 * lying in their designed pose: blade in the slot, spine flush with the fill
 * top, handle out over the rest's saddle.
 *
 * Shown whenever the design has a rest to plan, rather than on selection or
 * during generation like the cutout ghosts: what the block and the rest are
 * FOR is only legible with something lying across the pair, and the slot
 * outlines alone read as a row of trenches.
 *
 * Drawn with `LineSegments2` — an instanced fat line, never a plain `Mesh`.
 * `exportPreviewGlb` merges every visible mesh in this scene into the
 * published community GLB and skips only instanced geometry, so a mesh-drawn
 * ghost would be baked into every published knife block (CLAUDE.md #16).
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { useLineMaterialResolution } from '../useLineMaterialResolution';
import { PREVIEW_Z_OFFSET } from '../LidMesh/lidAnchorZ';
import { buildKnifeGhostPositions } from './knifeGhostGeometry';

/** Steel, so the knife reads as contents rather than as another cut. */
const GHOST_COLOR = '#94a3b8';
const GHOST_OPACITY = 0.55;
const LINE_WIDTH = 2;

export function GhostKnives() {
  const { invalidate } = useThree();

  const params = useDesignerStore((s) => s.params);

  // No rest to plan means no open-ended slot on a solid host, so there is no
  // knife lying anywhere for this design.
  const hasRest = useMemo(() => planKnifeRest(params) !== null, [params]);

  const geometry = useMemo(() => {
    if (!hasRest) return null;
    const positions = buildKnifeGhostPositions(params);
    if (positions.length === 0) return null;
    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    return geo;
  }, [hasRest, params]);

  const material = useMemo(() => {
    if (!geometry) return null;
    return new LineMaterial({
      color: new THREE.Color(GHOST_COLOR).getHex(),
      linewidth: LINE_WIDTH,
      transparent: true,
      opacity: GHOST_OPACITY,
      // The blade is inside the block by design, so the profile has to draw
      // through the solid or the only visible part is the handle.
      depthTest: false,
      depthWrite: false,
      resolution: new THREE.Vector2(),
    });
  }, [geometry]);

  useLineMaterialResolution(material);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  const lineSegments = useMemo(
    () => (geometry && material ? new LineSegments2(geometry, material) : null),
    [geometry, material]
  );

  if (!lineSegments) return null;

  return <primitive object={lineSegments} position={[0, 0, PREVIEW_Z_OFFSET]} renderOrder={3} />;
}
