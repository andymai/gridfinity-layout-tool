/**
 * WebGL drawing preview for corner-to-corner shape creation.
 *
 * Dashed outline showing the shape being drawn.
 * World coordinates: mm, Y-up.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { CutoutShape } from '@/features/bin-designer/types';
import { DEFAULT_POLYGON_SIDES } from '@/features/bin-designer/types';
import { regularPolygonPoints, slotCornerRadius } from '@/shared/utils/cutoutPolygon';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface DrawingPreview3DProps {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShape;
}

const ACCENT_COLOR = new THREE.Color(ACCENT_COLOR_HEX);

/** Build a closed outline as 2D points; the caller lifts to 3D and builds the fill shape. */
function buildOutlinePoints2D(
  x: number,
  y: number,
  width: number,
  depth: number,
  shape: CutoutShape
): THREE.Vector2[] {
  const cx = x + width / 2;
  const cy = y + depth / 2;

  if (shape === 'circle') {
    const segments = 64;
    const rx = width / 2;
    const ry = depth / 2;
    return Array.from({ length: segments + 1 }, (_, i) => {
      const theta = (i / segments) * Math.PI * 2;
      return new THREE.Vector2(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta));
    });
  }

  if (shape === 'polygon') {
    const poly = regularPolygonPoints(DEFAULT_POLYGON_SIDES, width, depth);
    const pts = poly.map((p) => new THREE.Vector2(cx + p.x, cy + p.y));
    if (poly.length > 0) pts.push(new THREE.Vector2(cx + poly[0].x, cy + poly[0].y));
    return pts;
  }

  if (shape === 'slot') {
    const r = slotCornerRadius(width, depth);
    const quad = 12;
    const pts: THREE.Vector2[] = [];
    const corners: [number, number, number][] = [
      [x + r, y + r, Math.PI],
      [x + width - r, y + r, -Math.PI / 2],
      [x + width - r, y + depth - r, 0],
      [x + r, y + depth - r, Math.PI / 2],
    ];
    for (const [acx, acy, start] of corners) {
      for (let i = 0; i <= quad; i++) {
        const a = start + (Math.PI / 2) * (i / quad);
        pts.push(new THREE.Vector2(acx + r * Math.cos(a), acy + r * Math.sin(a)));
      }
    }
    if (pts.length > 0) pts.push(pts[0].clone());
    return pts;
  }

  return [
    new THREE.Vector2(x, y),
    new THREE.Vector2(x + width, y),
    new THREE.Vector2(x + width, y + depth),
    new THREE.Vector2(x, y + depth),
    new THREE.Vector2(x, y),
  ];
}

export function DrawingPreview3D({ x, y, width, depth, shape }: DrawingPreview3DProps) {
  const { lineObj, fillGeometry } = useMemo(() => {
    const pts2D = buildOutlinePoints2D(x, y, width, depth, shape);

    const pts3D = pts2D.map((p) => new THREE.Vector3(p.x, p.y, 0.04));
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(pts3D);
    const lineMaterial = new THREE.LineDashedMaterial({
      color: ACCENT_COLOR,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.DRAWING_PREVIEW;

    // Fill: closed shape without the repeated last point
    const fillPts = pts2D[pts2D.length - 1]?.equals(pts2D[0] ?? new THREE.Vector2())
      ? pts2D.slice(0, -1)
      : pts2D;
    const fill = new THREE.ShapeGeometry(new THREE.Shape(fillPts));

    return { lineObj: line, fillGeometry: fill };
  }, [x, y, width, depth, shape]);

  return (
    <group renderOrder={RENDER_ORDER.DRAWING_PREVIEW}>
      <mesh geometry={fillGeometry} position={[0, 0, 0.03]}>
        <meshBasicMaterial
          color={ACCENT_COLOR}
          transparent
          opacity={0.15}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <primitive object={lineObj} />
    </group>
  );
}
