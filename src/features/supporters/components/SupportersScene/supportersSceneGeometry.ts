import type { BufferGeometry, Group, LineSegments, Mesh, Object3D } from 'three';
import { MESH_META } from '../../data/meshes';

export interface BakedGeometry {
  solid: BufferGeometry;
  /** BREP edge overlay (LINES primitive); null on assets baked without one. */
  edges: BufferGeometry | null;
}

/** Depth a seated bin's foot sinks into the plate socket (scene units). */
export const SEAT_DEPTH = MESH_META.plateHeight * 0.82;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Triangle mesh + optional edge-line geometry from a baked GLB scene. */
export function extractGeometry(scene: Group): BakedGeometry {
  const solids: BufferGeometry[] = [];
  const lines: BufferGeometry[] = [];
  scene.traverse((obj: Object3D & Partial<Pick<Mesh, 'geometry'>>) => {
    // three's own type discriminators: instanceof narrows generics to `any`.
    if (!obj.geometry) return;
    if ((obj as Partial<LineSegments>).isLineSegments) {
      lines.push(obj.geometry);
    } else if ((obj as Partial<Mesh>).isMesh) {
      solids.push(obj.geometry);
    }
  });
  const solid = solids.at(0);
  if (!solid) throw new Error('Baked supporters GLB contains no mesh');
  return { solid, edges: lines.at(0) ?? null };
}
