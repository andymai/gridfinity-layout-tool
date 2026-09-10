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

import { useMemo } from 'react';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useDesignerStore } from '@/features/bin-designer/store';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { useGhostLineSegments } from '../useGhostLineSegments';
import { PREVIEW_Z_OFFSET } from '../LidMesh/lidAnchorZ';
import { buildKnifeGhostPositions } from './knifeGhostGeometry';

/** Steel, so the knife reads as contents rather than as another cut. */
const GHOST_COLOR = '#94a3b8';
const GHOST_OPACITY = 0.55;
const LINE_WIDTH = 2;

export function GhostKnives() {
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

  // The blade is inside the block by design, so the profile has to draw
  // through the solid or the only visible part is the handle.
  const lineSegments = useGhostLineSegments(geometry, {
    color: GHOST_COLOR,
    opacity: GHOST_OPACITY,
    lineWidth: LINE_WIDTH,
    throughSolid: true,
  });

  if (!lineSegments) return null;

  return <primitive object={lineSegments} position={[0, 0, PREVIEW_Z_OFFSET]} renderOrder={3} />;
}
