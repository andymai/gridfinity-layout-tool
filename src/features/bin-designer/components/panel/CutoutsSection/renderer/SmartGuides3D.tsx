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
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface SmartGuides3DProps {
  readonly guides: readonly AlignmentGuide[];
  readonly binWidth: number;
  readonly binDepth: number;
  readonly zoom: number;
}

const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);
const MARKER_SIZE_PX = 3;

export function SmartGuides3D({ guides, binWidth, binDepth, zoom }: SmartGuides3DProps) {
  const lineGeometry = useMemo(() => {
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

  const markerCircles = useMemo(() => {
    if (guides.length === 0) return [];

    const mmRadius = MARKER_SIZE_PX / zoom;
    const segments = 8;
    const circles: { geometry: THREE.BufferGeometry; key: string }[] = [];

    for (const guide of guides) {
      if (guide.axis === 'x') {
        circles.push({
          geometry: createCircle(guide.position, 0, mmRadius, segments),
          key: `x-${guide.position}-0`,
        });
        circles.push({
          geometry: createCircle(guide.position, binDepth, mmRadius, segments),
          key: `x-${guide.position}-${binDepth}`,
        });
      } else {
        circles.push({
          geometry: createCircle(0, guide.position, mmRadius, segments),
          key: `y-0-${guide.position}`,
        });
        circles.push({
          geometry: createCircle(binWidth, guide.position, mmRadius, segments),
          key: `y-${binWidth}-${guide.position}`,
        });
      }
    }

    return circles;
  }, [guides, binWidth, binDepth, zoom]);

  if (!lineGeometry) return null;

  return (
    <>
      <lineSegments geometry={lineGeometry} renderOrder={RENDER_ORDER.SMART_GUIDES}>
        <lineDashedMaterial
          color={ACCENT_COLOR}
          dashSize={1.5}
          gapSize={1.5}
          transparent
          opacity={0.5}
          depthTest={false}
        />
      </lineSegments>
      {markerCircles.map(({ geometry, key }) => (
        <lineLoop key={key} geometry={geometry} renderOrder={RENDER_ORDER.SMART_GUIDES}>
          <lineBasicMaterial color={ACCENT_COLOR} transparent opacity={0.6} depthTest={false} />
        </lineLoop>
      ))}
    </>
  );
}

/** Create a circle as a line loop */
function createCircle(
  x: number,
  y: number,
  radius: number,
  segments: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 0.03);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}
