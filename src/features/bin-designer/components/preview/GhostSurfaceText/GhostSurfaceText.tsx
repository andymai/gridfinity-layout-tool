/**
 * Live outline of the wall captions in the 3D preview.
 *
 * Runs the SAME solver the worker runs (`@/shared/utils/wallTextPlan`) against
 * the same font buffers, so anchoring, size, tracking, case and line breaking
 * are shown exactly as they will be cut. That is the whole point of having
 * moved the solver into `shared/`: a preview that re-derived any of it would
 * agree with the print only until one side changed.
 *
 * Drawn as outlines rather than filled glyphs, deliberately. Filling would mean
 * deciding which contours are counters, which is real work for no gain here,
 * and an outline reads as a preview rather than as finished geometry.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { resolveEffectiveFont } from '@/shared/utils/typePlan';
import { resolveWallTextStyle, WALL_TEXT_SIDES } from '@/shared/types/bin';
import { buildWallTextOutline } from './wallTextOutline';
import { useTypeMeasurer } from '@/features/bin-designer/hooks/useTypeMeasurer';

const GHOST_COLOR = '#22d3ee';
const GHOST_OPACITY = 0.75;

export function GhostSurfaceText() {
  const { invalidate } = useThree();
  const params = useDesignerStore(useShallow((s) => s.params));
  const generationStatus = useDesignerStore((s) => s.generation.status);

  // Every face the walls actually reference, so the overlay never measures
  // against a face that has not arrived.
  const families = useMemo(() => {
    const out = new Set<string>();
    for (const side of WALL_TEXT_SIDES) {
      if ((params.surfaceText?.walls?.[side]?.trim() ?? '') === '') continue;
      const style = resolveWallTextStyle(params.textDefaults, params.surfaceText, side);
      out.add(resolveEffectiveFont(style.font, style.mode));
    }
    return [...out];
  }, [params.surfaceText, params.textDefaults]);

  const measurer = useTypeMeasurer(families as Parameters<typeof useTypeMeasurer>[0]);

  const geometry = useMemo(
    () => (measurer ? buildWallTextOutline(params, measurer) : null),
    [params, measurer]
  );

  // Allocated only alongside geometry: a design with no wall text should cost
  // no GPU resource at all, and the overlay is absent far more often than not.
  const material = useMemo(
    () =>
      geometry
        ? new THREE.LineBasicMaterial({
            color: GHOST_COLOR,
            transparent: true,
            opacity: GHOST_OPACITY,
            depthTest: true,
          })
        : null,
    [geometry]
  );

  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  // Shown while the mesh is being rebuilt, matching the other ghosts: once the
  // real geometry lands it is the better answer and the outline would only
  // double it.
  if (!geometry || !material || generationStatus !== 'generating') return null;
  return <lineSegments geometry={geometry} material={material} />;
}
