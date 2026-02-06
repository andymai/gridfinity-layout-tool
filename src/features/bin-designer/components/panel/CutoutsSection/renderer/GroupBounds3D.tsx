/**
 * Dashed amber bounding box for multi-selection in the cutout editor.
 *
 * World coordinates: mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { RENDER_ORDER, HANDLE_COLOR } from './constants';

interface GroupBounds3DProps {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
}

const boundsColor = new THREE.Color(HANDLE_COLOR);

export function GroupBounds3D({ x, y, width, depth }: GroupBounds3DProps) {
  const lineObj = useMemo(() => {
    const points = [
      new THREE.Vector3(x, y, 0.04),
      new THREE.Vector3(x + width, y, 0.04),
      new THREE.Vector3(x + width, y + depth, 0.04),
      new THREE.Vector3(x, y + depth, 0.04),
      new THREE.Vector3(x, y, 0.04),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: boundsColor,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.GROUP_BOUNDS;
    return line;
  }, [x, y, width, depth]);

  return <primitive object={lineObj} />;
}
