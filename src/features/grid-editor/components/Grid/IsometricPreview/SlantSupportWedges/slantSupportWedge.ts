import * as THREE from 'three';
import type { SlantSupportRender } from '@/shared/hooks/useExplodedLayerView';

/**
 * The wedge in its own frame: X runs along the lean from the bin's leading
 * edge, Y across it. Its section climbs from the socket's top at the bin up to
 * the bin's top where the leaning top lands, then runs flat to the far end.
 */
export function slantSupportWedge(
  length: number,
  width: number,
  reach: number,
  pivot: number,
  top: number
): THREE.BufferGeometry {
  const landing = Math.min(reach, length);
  const section: [number, number][] = [
    [0, 0],
    [length, 0],
    [length, top],
    [landing, top],
    [0, Math.min(pivot, top)],
  ];
  const positions: number[] = [];
  const corner = (i: number, y: number): number[] => [section[i][0], y, section[i][1]];
  // Both caps fan from the first corner; the section is convex.
  for (let i = 1; i < section.length - 1; i++) {
    positions.push(...corner(0, 0), ...corner(i + 1, 0), ...corner(i, 0));
    positions.push(...corner(0, width), ...corner(i, width), ...corner(i + 1, width));
  }
  for (let i = 0; i < section.length; i++) {
    const j = (i + 1) % section.length;
    positions.push(...corner(i, 0), ...corner(j, 0), ...corner(j, width));
    positions.push(...corner(i, 0), ...corner(j, width), ...corner(i, width));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Where the wedge's frame sits on the grid, and its turn about Z, for the support's side. */
export function slantSupportPlacement(s: SlantSupportRender): {
  length: number;
  width: number;
  position: [number, number];
  turn: number;
} {
  switch (s.side) {
    case 'right':
      return { length: s.width, width: s.depth, position: [s.x, s.y], turn: 0 };
    case 'left':
      return {
        length: s.width,
        width: s.depth,
        position: [s.x + s.width, s.y + s.depth],
        turn: Math.PI,
      };
    case 'back':
      return { length: s.depth, width: s.width, position: [s.x + s.width, s.y], turn: Math.PI / 2 };
    case 'front':
      return {
        length: s.depth,
        width: s.width,
        position: [s.x, s.y + s.depth],
        turn: -Math.PI / 2,
      };
  }
}
