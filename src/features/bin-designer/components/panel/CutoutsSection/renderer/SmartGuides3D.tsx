/**
 * WebGL alignment guide lines for the cutout editor.
 *
 * Renders dashed lines when dragging cutouts to show alignment
 * with stationary cutouts (edges and centers).
 * World coordinates: mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { AlignmentGuide } from '../geometry';
import { RENDER_ORDER } from './constants';

interface SmartGuides3DProps {
  readonly guides: readonly AlignmentGuide[];
  readonly binWidth: number;
  readonly binDepth: number;
}

const ACCENT_COLOR = new THREE.Color('#6366f1');

export function SmartGuides3D({ guides, binWidth, binDepth }: SmartGuides3DProps) {
  const geometry = useMemo(() => {
    if (guides.length === 0) return null;

    const positions: number[] = [];
    for (const guide of guides) {
      if (guide.axis === 'x') {
        // Vertical guide line at x = guide.position
        positions.push(guide.position, 0, 0.03, guide.position, binDepth, 0.03);
      } else {
        // Horizontal guide line at y = guide.position (Y-up, no flip needed)
        positions.push(0, guide.position, 0.03, binWidth, guide.position, 0.03);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [guides, binWidth, binDepth]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} renderOrder={RENDER_ORDER.SMART_GUIDES}>
      <lineDashedMaterial
        color={ACCENT_COLOR}
        dashSize={1.5}
        gapSize={1.5}
        transparent
        opacity={0.5}
        depthTest={false}
      />
    </lineSegments>
  );
}
