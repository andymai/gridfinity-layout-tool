import * as THREE from 'three';
import { triangulatePath } from '../pathGeometry';

type Pt = { readonly x: number; readonly y: number };

/**
 * Triangles filling `outline` around its `holes`, as indices into the outline
 * followed by each hole in turn. An island stays open, so it is neither drawn
 * as pocket nor hit by a click.
 */
export function pathFillIndices(
  outline: readonly Pt[],
  holes: readonly (readonly Pt[])[]
): number[] {
  if (holes.length === 0) return triangulatePath(outline);
  const toVectors = (ring: readonly Pt[]) => ring.map((p) => new THREE.Vector2(p.x, p.y));
  return THREE.ShapeUtils.triangulateShape(toVectors(outline), holes.map(toVectors)).flat();
}
