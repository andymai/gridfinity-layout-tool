/* eslint-disable no-console -- Build script uses console for status output */
/**
 * Bakes the real Gridfinity meshes the /supporters scene instances at runtime.
 *
 * Runs the production OCCT generators headless (same init path as the
 * generator scenario tests), then writes Draco-compressed GLBs:
 *
 *   - `bin.glb`        — 1×1×3 bin with a front label tab (every supporter)
 *   - `plate-cell.glb` — 1×1 baseplate tile (instanced per socket)
 *
 * Geometry is baked into scene space: Y-up, 1 unit = 42mm socket pitch,
 * bottom at Y=0, XY-centered. `meshMeta.json` records the label-tab
 * rectangle (measured from the LABEL_TAB face group, not re-derived from
 * spec constants) so the scene can place name textures exactly on the shelf.
 *
 * Usage: pnpm run gen:supporters-meshes  (re-run after generator changes)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
// gltf-pipeline ships no types; processGlb takes a glb Buffer and resolves { glb }.
import gltfPipeline from 'gltf-pipeline';
import { initOcctWasmKernel } from '../src/features/generation/worker/generators/__kernel-tests__/kernelInit';
import { FeatureTag } from '../src/features/generation/worker/generators/featureTags';
import { DEFAULT_BIN_PARAMS } from '../src/shared/constants/bin';
import type { MeshData } from '../src/features/generation/bridge/types';
import type { ResolvedBaseplateParams } from '../src/shared/types/bin';

interface GltfPipeline {
  processGlb: (
    glb: Buffer,
    options: { dracoOptions: { compressionLevel: number } }
  ) => Promise<{ glb: Buffer }>;
}

const { processGlb } = gltfPipeline as unknown as GltfPipeline;

const OUT = resolve(process.cwd(), 'src/features/supporters/data/meshes');
const GRID_UNIT_MM = 42;

/**
 * mm Z-up (generator frame) → scene units Y-up, then a 180° spin about the
 * vertical axis: (x, y, z) → (-x, z, y) / 42.
 *
 * The spin moves the (front-edge) label tab to the scene's back edge. We bake
 * with `edges: 'front'` and rotate instead of using the generator's
 * `edges: 'back'`, because the mirrored back-tab solid tessellates with
 * inverted vertex normals on the shelf top (renders black on single-sided
 * materials); the rigid rotation of the front-tab bin keeps normals valid.
 */
function toSceneSpace(mesh: MeshData): {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
} {
  const n = mesh.vertices.length / 3;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = mesh.vertices[i * 3];
    const y = mesh.vertices[i * 3 + 1];
    const z = mesh.vertices[i * 3 + 2];
    positions[i * 3] = -x / GRID_UNIT_MM;
    positions[i * 3 + 1] = z / GRID_UNIT_MM;
    positions[i * 3 + 2] = y / GRID_UNIT_MM;
    const nx = mesh.normals[i * 3];
    const ny = mesh.normals[i * 3 + 1];
    const nz = mesh.normals[i * 3 + 2];
    normals[i * 3] = -nx;
    normals[i * 3 + 1] = nz;
    normals[i * 3 + 2] = ny;
  }
  return { positions, normals, indices: new Uint32Array(mesh.indices) };
}

function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  return { min, max };
}

function pad4(buf: Buffer, fill: number): Buffer {
  const rem = buf.length % 4;
  return rem === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rem, fill)]);
}

/** Minimal single-primitive glTF 2.0 binary (positions + normals + indices). */
function buildGlb(positions: Float32Array, normals: Float32Array, indices: Uint32Array): Buffer {
  const posBuf = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
  const normBuf = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);
  const idxBuf = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);
  const bin = pad4(Buffer.concat([posBuf, normBuf, idxBuf]), 0);
  const { min, max } = bounds(positions);

  const json = {
    asset: { version: '2.0', generator: 'gen-supporters-meshes' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5125, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length },
      { buffer: 0, byteOffset: posBuf.length, byteLength: normBuf.length },
      { buffer: 0, byteOffset: posBuf.length + normBuf.length, byteLength: idxBuf.length },
    ],
    buffers: [{ byteLength: bin.length }],
  };

  const jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(bin.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN'
  return Buffer.concat([header, jsonChunkHeader, jsonBuf, binChunkHeader, bin]);
}

/**
 * Measure the up-facing label-shelf rectangle from LABEL_TAB-tagged triangles
 * (in scene space). The tag survives the boolean pipeline, so this stays
 * correct if shelf spec constants ever move.
 */
function measureLabelTab(
  mesh: MeshData,
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint32Array
): { x0: number; x1: number; z0: number; z1: number; y: number } {
  const groups = mesh.faceGroups?.filter((g) => g.tag === FeatureTag.LABEL_TAB) ?? [];
  if (groups.length === 0) throw new Error('No LABEL_TAB face group in bin mesh');
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  let topY = -Infinity;
  const upVerts: number[] = [];
  for (const g of groups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = indices[i];
      if (normals[v * 3 + 1] > 0.9) {
        upVerts.push(v);
        if (positions[v * 3 + 1] > topY) topY = positions[v * 3 + 1];
      }
    }
  }
  if (upVerts.length === 0) throw new Error('LABEL_TAB group has no up-facing vertices');
  for (const v of upVerts) {
    // Only the shelf-top plane (skip gusset tops sitting lower).
    if (positions[v * 3 + 1] < topY - 0.002) continue;
    x0 = Math.min(x0, positions[v * 3]);
    x1 = Math.max(x1, positions[v * 3]);
    z0 = Math.min(z0, positions[v * 3 + 2]);
    z1 = Math.max(z1, positions[v * 3 + 2]);
  }
  return { x0, x1, z0, z1, y: topY };
}

async function writeAsset(
  name: string,
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint32Array
): Promise<void> {
  const raw = buildGlb(positions, normals, indices);
  const { glb } = await processGlb(raw, { dracoOptions: { compressionLevel: 7 } });
  writeFileSync(resolve(OUT, name), glb);
  console.error(
    `wrote ${name}: ${indices.length / 3} tris, ${raw.length} -> ${glb.length} bytes (draco)`
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.error('initializing occt-wasm kernel...');
  await initOcctWasmKernel();
  const { generateBin } = await import('../src/features/generation/worker/generators/binGenerator');
  const { generateBaseplate } =
    await import('../src/features/generation/worker/generators/baseplateGenerator');

  console.error('generating 1×1×3 label-tab bin...');
  const binMesh = generateBin(
    {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      // Front edge here; toSceneSpace spins the bin 180° so the tab ends up on
      // the scene's back edge (see that function for why not `edges: 'back'`).
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'center',
        edges: 'front',
      },
    },
    undefined,
    true
  );
  const bin = toSceneSpace(binMesh);
  const tab = measureLabelTab(binMesh, bin.positions, bin.normals, bin.indices);
  const binBounds = bounds(bin.positions);
  await writeAsset('bin.glb', bin.positions, bin.normals, bin.indices);

  console.error('generating 1×1 baseplate cell...');
  const plateParams: ResolvedBaseplateParams = {
    width: 1,
    depth: 1,
    gridUnitMm: GRID_UNIT_MM,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    lightweight: false,
  };
  const plateMesh = generateBaseplate(plateParams, () => undefined, true);
  const plate = toSceneSpace(plateMesh);
  const plateBounds = bounds(plate.positions);
  await writeAsset('plate-cell.glb', plate.positions, plate.normals, plate.indices);

  const meta = {
    _comment: 'Generated by scripts/gen-supporters-meshes.ts — do not edit by hand.',
    binHeight: binBounds.max[1],
    labelTab: tab,
    plateHeight: plateBounds.max[1],
  };
  writeFileSync(
    resolve(process.cwd(), 'src/features/supporters/data/meshMeta.json'),
    `${JSON.stringify(meta, null, 2)}\n`
  );
  console.error('wrote meshMeta.json:', JSON.stringify(meta));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
