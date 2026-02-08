/**
 * WebGL drawing preview for corner-to-corner shape creation.
 *
 * Dashed outline showing the shape being drawn.
 * World coordinates: mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { CutoutShape } from '@/features/bin-designer/types';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface DrawingPreview3DProps {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShape;
}

const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);

export function DrawingPreview3D({ x, y, width, depth, shape }: DrawingPreview3DProps) {
  const lineObj = useMemo(() => {
    let points: THREE.Vector3[];

    if (shape === 'circle') {
      const segments = 64;
      points = [];
      const rx = width / 2;
      const ry = depth / 2;
      const cx = x + rx;
      const cy = y + ry;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta), 0.04));
      }
    } else {
      points = [
        new THREE.Vector3(x, y, 0.04),
        new THREE.Vector3(x + width, y, 0.04),
        new THREE.Vector3(x + width, y + depth, 0.04),
        new THREE.Vector3(x, y + depth, 0.04),
        new THREE.Vector3(x, y, 0.04),
      ];
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: ACCENT_COLOR,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;
    return line;
  }, [x, y, width, depth, shape]);

  return <primitive object={lineObj} />;
}
