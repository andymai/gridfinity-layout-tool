/**
 * Renders the boolean-op result of a non-union cutout group as a filled
 * polygon (with holes when present).
 *
 * Union groups keep the existing stencil-fill pipeline (member shapes merge
 * visually via stencil tests). For Subtract / Intersect / Exclude the
 * stencil trick can't express the right region, so we run the same
 * polygon-clipping pipeline used by the worker preview and render the
 * computed MultiPolygon via `THREE.Shape`, which supports holes natively.
 */

import { memo, useMemo } from 'react';
import * as THREE from 'three';
import type { Cutout } from '@/features/bin-designer/types';
import { applyGroupOp } from '../booleanGeometry';
import { RENDER_ORDER, ACCENT_COLOR_HEX } from './constants';

interface GroupResultMeshProps {
  readonly members: readonly Cutout[];
  readonly isSelected: boolean;
  readonly binColor: string;
}

export const GroupResultMesh = memo(function GroupResultMesh({
  members,
  isSelected,
  binColor,
}: GroupResultMeshProps) {
  const op = members[0]?.groupOp;

  // Skip union here — the stencil-fill render path in SceneContent already
  // handles unions and looks slightly nicer with the SDF anti-aliasing.
  const result = useMemo(() => {
    if (!op || op === 'union') return null;
    return applyGroupOp(members, op);
  }, [members, op]);

  const fillColor = useMemo(() => {
    // Match the SDF darken-by-0.7 the regular cutout meshes use so the
    // boolean result reads as the same kind of cavity, not a new shape.
    const base = new THREE.Color(binColor);
    return base.clone().multiplyScalar(0.7);
  }, [binColor]);

  const strokeColor = useMemo(
    () =>
      isSelected
        ? new THREE.Color(ACCENT_COLOR_HEX)
        : new THREE.Color(binColor).multiplyScalar(0.5),
    [isSelected, binColor]
  );

  const { shapes, strokes } = useMemo(() => {
    if (!result) return { shapes: [] as THREE.Shape[], strokes: [] as THREE.BufferGeometry[] };
    const builtShapes: THREE.Shape[] = [];
    const builtStrokes: THREE.BufferGeometry[] = [];
    for (const polygon of result) {
      if (polygon.length === 0) continue;
      const [outer, ...holes] = polygon;
      const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const hole of holes) {
        shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
      }
      builtShapes.push(shape);

      // Stroke all rings (outer + holes) so cavities read as cut edges.
      const strokeZ = 0.012;
      for (const ring of polygon) {
        const positions = new Float32Array(ring.length * 3);
        for (let i = 0; i < ring.length; i++) {
          const [x, y] = ring[i];
          positions[i * 3] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = strokeZ;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        builtStrokes.push(geo);
      }
    }
    return { shapes: builtShapes, strokes: builtStrokes };
  }, [result]);

  if (!result || shapes.length === 0) return null;

  return (
    <group renderOrder={RENDER_ORDER.GROUP_FILL}>
      {shapes.map((shape, i) => (
        <mesh key={`fill-${i}`} position={[0, 0, 0.01]} renderOrder={RENDER_ORDER.GROUP_FILL}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={fillColor} transparent opacity={0.95} depthWrite={false} />
        </mesh>
      ))}
      {strokes.map((geo, i) => (
        <lineLoop key={`stroke-${i}`} geometry={geo} renderOrder={RENDER_ORDER.GROUP_STROKE}>
          <lineBasicMaterial color={strokeColor} linewidth={1} />
        </lineLoop>
      ))}
    </group>
  );
});
