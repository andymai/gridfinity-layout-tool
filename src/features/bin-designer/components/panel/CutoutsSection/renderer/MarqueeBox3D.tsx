/**
 * WebGL marquee selection rectangle.
 *
 * Translucent fill with dashed outline. Coordinates in world mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface MarqueeBox3DProps {
  /** Marquee origin X in mm */
  readonly x: number;
  /** Marquee origin Y in mm */
  readonly y: number;
  /** Marquee width in mm (can be negative) */
  readonly width: number;
  /** Marquee depth in mm (can be negative) */
  readonly depth: number;
}

const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);

export function MarqueeBox3D({ x, y, width, depth }: MarqueeBox3DProps) {
  // Normalize to positive dimensions
  const minX = Math.min(x, x + width);
  const minY = Math.min(y, y + depth);
  const w = Math.abs(width);
  const d = Math.abs(depth);

  // Outline as THREE.Line (avoids JSX <line> → SVG conflict)
  const lineObj = useMemo(() => {
    const points = [
      new THREE.Vector3(minX, minY, 0.06),
      new THREE.Vector3(minX + w, minY, 0.06),
      new THREE.Vector3(minX + w, minY + d, 0.06),
      new THREE.Vector3(minX, minY + d, 0.06),
      new THREE.Vector3(minX, minY, 0.06),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: ACCENT_COLOR,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.MARQUEE;
    return line;
  }, [minX, minY, w, d]);

  return (
    <group renderOrder={RENDER_ORDER.MARQUEE}>
      {/* Fill */}
      <mesh position={[minX + w / 2, minY + d / 2, 0.055]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={ACCENT_COLOR} transparent opacity={0.1} depthTest={false} />
      </mesh>

      {/* Dashed outline */}
      <primitive object={lineObj} />
    </group>
  );
}
