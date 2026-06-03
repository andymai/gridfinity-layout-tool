/**
 * Dashed footprint cue for insertion fit. The 2D editor shows a cutout at its
 * nominal size, but the worker enlarges it by `clearance` (and flares the top
 * by `chamfer`). While the user drags one of those fields, this overlays the
 * true cut footprint as a dashed accent outline so the otherwise-invisible
 * effect is legible.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import type { FitCue } from '../cutoutSectionVisibility';
import { cutoutToPolygon } from '../booleanGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

const ACCENT = new THREE.Color(ACCENT_COLOR_HEX);

interface FitCueOverlay3DProps {
  readonly cutout: Cutout;
  readonly cue: Exclude<FitCue, null>;
}

export function FitCueOverlay3D({ cutout, cue }: FitCueOverlay3DProps) {
  const lineObj = useMemo(() => {
    // Clearance adds `clearance` to each bbox dimension; the chamfer's top rim
    // flares by `2·chamfer`. Expand about the cutout center so the cue is
    // concentric with the drawn nominal outline.
    const expand = cue === 'clearance' ? (cutout.clearance ?? 0) : 2 * (cutout.chamferWidth ?? 0);
    if (expand <= 0.001 || cutout.shape === 'path') return null;

    const expanded: Cutout = {
      ...cutout,
      x: cutout.x - expand / 2,
      y: cutout.y - expand / 2,
      width: cutout.width + expand,
      depth: cutout.depth + expand,
    };
    const poly = cutoutToPolygon(expanded);
    if (!poly || poly.length === 0) return null;

    const ring = poly[0];
    const pts = ring.map(([x, y]) => new THREE.Vector3(x, y, 0.05));
    if (pts.length === 0) return null;
    pts.push(pts[0].clone());

    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const material = new THREE.LineDashedMaterial({
      color: ACCENT,
      dashSize: 1.5,
      gapSize: 1,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return line;
  }, [cutout, cue]);

  if (!lineObj) return null;
  return <primitive object={lineObj} />;
}
