import meshMeta from './meshMeta.json';

// Resolve baked meshes to bundled, hashed URLs (same pattern as the
// bin-designer example gallery): only assets Vite sees via import.meta.glob
// get emitted; `?url` keeps just the URL string in the bundle and the GLB
// bytes are fetched on demand.
const modules: Record<string, string> = import.meta.glob('./meshes/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
});

function urlFor(file: string): string {
  const url = modules[`./meshes/${file}`];
  if (!url) throw new Error(`Missing baked supporters mesh: ${file}`);
  return url;
}

/** Draco GLB of the real generated 1×1×3 label-tab bin (scene units, Y-up). */
export const BIN_MESH_URL = urlFor('bin.glb');

/** Draco GLB of the real generated 1×1 baseplate tile (scene units, Y-up). */
export const PLATE_CELL_MESH_URL = urlFor('plate-cell.glb');

interface LabelTabRect {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y: number;
}

/** Measurements baked alongside the meshes by scripts/gen-supporters-meshes.ts. */
export const MESH_META: {
  readonly binHeight: number;
  readonly labelTab: LabelTabRect;
  readonly plateHeight: number;
} = meshMeta;
