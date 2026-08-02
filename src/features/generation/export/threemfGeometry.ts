import type { IndexedMesh, BBox } from './threemfTypes';

/**
 * Vertices within 1e-6 (key precision = 6 decimal places) are considered
 * identical — the hash key uses `toFixed` so floating-point jitter from
 * boolean operations doesn't fragment otherwise-shared vertices.
 */
export function deduplicateVertices(vertices: Float32Array): IndexedMesh {
  const PRECISION = 6;
  const uniqueVertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];
  const vertexMap = new Map<string, number>();

  const triangleCount = vertices.length / 9;

  for (let tri = 0; tri < triangleCount; tri++) {
    const indices: [number, number, number] = [0, 0, 0];

    for (let v = 0; v < 3; v++) {
      const base = tri * 9 + v * 3;
      const x = vertices[base];
      const y = vertices[base + 1];
      const z = vertices[base + 2];
      const key = `${x.toFixed(PRECISION)},${y.toFixed(PRECISION)},${z.toFixed(PRECISION)}`;

      let index = vertexMap.get(key);
      if (index === undefined) {
        index = uniqueVertices.length;
        uniqueVertices.push([x, y, z]);
        vertexMap.set(key, index);
      }
      indices[v] = index;
    }

    triangles.push(indices);
  }

  return { vertices: uniqueVertices, triangles };
}

/**
 * Plate-center coordinates we translate the bin's bbox centroid to so the
 * file opens centered on the bed. Chosen for the 256×256 mm beds that
 * BambuStudio A1/X1/P1, Prusa MK4S, and similar most commonly target.
 * A1 mini (180×180) will see the bin offset 38mm past center — still on
 * the bed. Pre-#1893 we shipped no Application metadata so OrcaSlicer
 * classified our file as `From_Other` and auto-arranged on import;
 * claiming BambuStudio identity flips `need_arrange = false` in the BBS
 * loader, so we now have to provide the plate position ourselves.
 */
const PLATE_CENTER_MM = { x: 128, y: 128 } as const;

export function computeBBox(vertices: readonly (readonly [number, number, number])[]): BBox | null {
  if (vertices.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const [x, y, z] of vertices) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

/**
 * Translation that places the bbox centroid at PLATE_CENTER_MM (XY) and
 * the bottom of the bbox at z=0 (sits on bed). Returns zero for an empty
 * bbox — let the slicer do whatever it does with an empty mesh.
 */
export function centeringTranslation(bbox: BBox | null): { x: number; y: number; z: number } {
  if (!bbox) return { x: 0, y: 0, z: 0 };
  return {
    x: PLATE_CENTER_MM.x - (bbox.min.x + bbox.max.x) / 2,
    y: PLATE_CENTER_MM.y - (bbox.min.y + bbox.max.y) / 2,
    z: -bbox.min.z,
  };
}

export function mergeBBoxes(boxes: readonly (BBox | null)[]): BBox | null {
  let merged: BBox | null = null;
  for (const b of boxes) {
    if (!b) continue;
    if (!merged) {
      merged = b;
      continue;
    }
    merged = {
      min: {
        x: Math.min(merged.min.x, b.min.x),
        y: Math.min(merged.min.y, b.min.y),
        z: Math.min(merged.min.z, b.min.z),
      },
      max: {
        x: Math.max(merged.max.x, b.max.x),
        y: Math.max(merged.max.y, b.max.y),
        z: Math.max(merged.max.z, b.max.z),
      },
    };
  }
  return merged;
}
