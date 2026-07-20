/**
 * Imported-mesh bin generator module. The stored GMA1 asset IS the geometry:
 * `prepare` decodes it (async) into a small content-keyed cache, `generate`
 * re-frames the cached arrays into the bin preview convention (XY centered at
 * the origin, Z=0 at the absolute bottom — the imported mesh is stored
 * origin-normalized with bbox min at 0,0,0), and `export` re-serializes the
 * decoded mesh as binary STL. STEP is structurally impossible (no BREP solid
 * exists), mirroring the mesh-imprint rule in `binExporter.ts`.
 */
import { isErr } from '@/core/result';
import { decodeMeshData } from '@/shared/generation/meshAsset';
import type { DecodedMeshData } from '@/shared/generation/meshAsset';
import { isItemKind } from '@/shared/types/item';
import type { GridfinityItem } from '@/shared/types/item';
import type { MeshData } from '../../bridge/types';
import type { ItemExportResult, ItemGeneratorModule } from './generatorRegistry';
import { buildSTLBufferFromIndexed } from '../../export/stlExporter';
// Direct descriptor import, NOT the registry: the worker bundle never runs
// registerDescriptors() (that's a main-thread module), so a registry lookup
// here would throw at export time.
import { importedMeshDescriptor } from '@/shared/items/importedMesh/descriptor';

/** Decoded assets kept per worker, content-keyed by the GMA1 payload string. */
const MAX_DECODED_ASSETS = 4;

const decodedAssets = new Map<string, DecodedMeshData>();

async function decodeCached(data: string): Promise<DecodedMeshData> {
  const hit = decodedAssets.get(data);
  if (hit) {
    // Refresh LRU position.
    decodedAssets.delete(data);
    decodedAssets.set(data, hit);
    return hit;
  }
  const decoded = await decodeMeshData(data);
  if (isErr(decoded)) {
    throw new Error(`Imported mesh asset failed to decode: ${decoded.error.message}`);
  }
  while (decodedAssets.size >= MAX_DECODED_ASSETS) {
    const oldest = decodedAssets.keys().next().value;
    if (oldest === undefined) break;
    decodedAssets.delete(oldest);
  }
  decodedAssets.set(data, decoded.value);
  return decoded.value;
}

/** Drop decoded assets (worker CLEANUP path). Plain arrays — no WASM handles. */
export function clearImportedMeshCache(): void {
  decodedAssets.clear();
}

/**
 * Re-frame the stored mesh into the preview convention: stored positions have
 * bbox min at (0,0,0); generated bins are XY-centered on the origin with Z=0
 * at the bottom. Returns a fresh array — cached arrays are never handed to
 * the postMessage path.
 */
function centerPositions(decoded: DecodedMeshData, sizeX: number, sizeY: number): Float32Array {
  const centered = new Float32Array(decoded.positions.length);
  const dx = sizeX / 2;
  const dy = sizeY / 2;
  for (let i = 0; i < decoded.positions.length; i += 3) {
    centered[i] = decoded.positions[i] - dx;
    centered[i + 1] = decoded.positions[i + 1] - dy;
    centered[i + 2] = decoded.positions[i + 2];
  }
  return centered;
}

export const importedMeshGeneratorModule: ItemGeneratorModule = {
  kind: 'importedMesh',

  prepare: async (item: GridfinityItem) => {
    if (!isItemKind(item, 'importedMesh')) return;
    await decodeCached(item.structure.asset.data);
  },

  generate: (item, onProgress, _isExport, _signal) => {
    if (!isItemKind(item, 'importedMesh')) {
      throw new Error('importedMesh generator received a non-importedMesh item');
    }
    const { asset } = item.structure;
    const decoded = decodedAssets.get(asset.data);
    if (!decoded) {
      throw new Error('Imported mesh asset not prepared — prepare() must run before generate()');
    }
    onProgress('merge', 0.9);
    const vertices = centerPositions(decoded, asset.sizeMm.x, asset.sizeMm.y);
    const meshData: MeshData = {
      vertices,
      // Empty normals/edges: useMeshGeometry computes vertex normals and
      // derives crease edges via its EdgesGeometry fallback.
      normals: new Float32Array(0),
      indices: new Uint32Array(decoded.indices),
      edgeVertices: new Float32Array(0),
      triangleCount: decoded.indices.length / 3,
    };
    return meshData;
  },

  export: async (item, format): Promise<ItemExportResult> => {
    if (!isItemKind(item, 'importedMesh')) {
      throw new Error('importedMesh export received a non-importedMesh item');
    }
    if (format === 'step') {
      throw new Error(
        'STEP export is not available for imported STL designs — the stored geometry is a mesh with no BREP solid. Use STL or 3MF.'
      );
    }
    const { asset } = item.structure;
    const decoded = await decodeCached(asset.data);
    const fileName = importedMeshDescriptor.exportFileName(item.envelope, item.structure);
    // Exported STL keeps the stored origin-normalized frame (bbox min at
    // 0,0,0 — bottom on the build plate), which is what slicers expect.
    const data = buildSTLBufferFromIndexed(
      decoded.positions,
      new Float32Array(0),
      decoded.indices,
      fileName
    );
    return { data, fileName: `${fileName}.stl` };
  },
};
