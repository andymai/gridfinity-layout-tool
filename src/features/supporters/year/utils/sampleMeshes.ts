import { BufferGeometry, LineSegments, Mesh, type Object3D } from 'three';
import { DRACOLoader, GLTFLoader } from 'three-stdlib';
import type { MeshData } from '@/shared/types/generation';
import type { YearMesh } from '../hooks/useYearMeshes';

function positions(geometry: BufferGeometry): Float32Array {
  const { array } = geometry.getAttribute('position');
  return array instanceof Float32Array ? array : Float32Array.from(array);
}

function geometryOf(object: Object3D): BufferGeometry | null {
  if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return null;
  const geometry: unknown = object.geometry;
  return geometry instanceof BufferGeometry ? geometry : null;
}

/** A baked node (body triangles plus BREP edge lines) as the generator's mesh shape. */
export function meshDataFrom(node: Object3D): MeshData | null {
  const bodies: BufferGeometry[] = [];
  const lines: BufferGeometry[] = [];
  node.traverse((child) => {
    const geometry = geometryOf(child);
    if (!geometry) return;
    if (child instanceof LineSegments) lines.push(geometry);
    else bodies.push(geometry);
  });
  const body = bodies.at(0);
  if (!body) return null;
  if (!body.hasAttribute('normal')) body.computeVertexNormals();
  const vertices = positions(body);
  const indices = body.index
    ? Uint32Array.from(body.index.array)
    : Uint32Array.from({ length: vertices.length / 3 }, (_, index) => index);
  const normals = body.getAttribute('normal').array;
  const edges = lines.at(0);
  return {
    vertices,
    normals: normals instanceof Float32Array ? normals : Float32Array.from(normals),
    indices,
    edgeVertices: edges ? positions(edges) : new Float32Array(0),
    triangleCount: indices.length / 3,
  };
}

/**
 * The sample's baked meshes, keyed by design id, with the triangle counts the
 * bake measured on the full meshes (the GLB holds only each body).
 */
export async function loadSampleMeshes(
  url: string,
  triangles: ReadonlyMap<string, number>
): Promise<Map<string, YearMesh>> {
  const draco = new DRACOLoader();
  // Self-hosted decoder (public/draco/): CSP forbids the default CDN.
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  try {
    const gltf = await loader.loadAsync(url);
    const meshes = new Map<string, YearMesh>();
    for (const node of gltf.scene.children) {
      const mesh = meshDataFrom(node);
      const count = triangles.get(node.name);
      if (mesh && count !== undefined) meshes.set(node.name, { mesh, triangles: count });
    }
    gltf.scene.traverse((child) => geometryOf(child)?.dispose());
    return meshes;
  } finally {
    draco.dispose();
  }
}
