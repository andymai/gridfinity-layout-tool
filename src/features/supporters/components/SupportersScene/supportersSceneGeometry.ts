import type { BufferGeometry, Group, LineSegments, Mesh } from 'three';
import { MESH_META } from '../../data/meshes';

export interface BakedGeometry {
  solid: BufferGeometry;
  /** BREP edge overlay (LINES primitive); null on assets baked without one. */
  edges: BufferGeometry | null;
}

/** Depth a seated bin's foot sinks into the plate socket (scene units). */
export const SEAT_DEPTH = MESH_META.plateHeight * 0.82;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Triangle mesh + optional edge-line geometry from a baked GLB scene. */
export function extractGeometry(scene: Group): BakedGeometry {
  const solids: BufferGeometry[] = [];
  const lines: BufferGeometry[] = [];
  scene.traverse((obj) => {
    // three's own type discriminators: instanceof narrows generics to `any`.
    if ((obj as Partial<LineSegments>).isLineSegments) {
      lines.push((obj as LineSegments).geometry);
    } else if ((obj as Partial<Mesh>).isMesh) {
      solids.push((obj as Mesh).geometry);
    }
  });
  const solid = solids.at(0);
  if (!solid) throw new Error('Baked supporters GLB contains no mesh');
  return { solid, edges: lines.at(0) ?? null };
}
