/**
 * Bakes the sample year that `/your-2026?demo` plays, so a visitor with no
 * work of their own (or a link from a post) sees real bins without the kernel.
 *
 * Takes bin designer examples, builds each one with the production OCCT
 * generator (headless, the same init path as the generator scenario tests),
 * and writes into src/features/supporters/year/data/sample/:
 *
 *   - `meshes.glb`   the longest print and the most complicated design, one
 *                    node each, named by example id, in the generator frame
 *                    (mm, Z-up) that the live 3D cards also receive
 *   - `<id>.webp`    each design's gallery thumbnail, trimmed and shrunk
 *   - `sample.json`  names, print minutes, triangle counts and feature scores
 *
 * Usage: pnpm run gen:your-2026-sample  (re-run after generator changes)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
// gltf-pipeline ships no types; processGlb takes a glb Buffer and resolves { glb }.
import gltfPipeline from 'gltf-pipeline';
import { EXAMPLE_DESIGNS } from '../src/features/bin-designer/data/examples';
import { initOcctWasmKernel } from '../src/features/generation/worker/generators/__kernel-tests__/kernelInit';
import type { MeshData } from '../src/features/generation/bridge/types';
import { featureScore } from '../src/features/supporters/year/utils/designFeatures';
import { meshTriangles } from '../src/features/supporters/year/utils/meshTriangles';
import { withSocketNozzle } from '../src/shared/generation/socketNozzle';
import { DEFAULT_PRINT_SETTINGS } from '../src/shared/printSettings';
import { estimateCommunityPrint } from '../src/shared/utils/communityPrintCost';
import { knifeRestMatedOffset, planKnifeRest } from '../src/shared/utils/knifeRestPlan';
import { TEXT_FONT_FILES, loadTestFonts } from '../src/test/loadTestFonts';
import { bounds, pad4, simplifyEdgeLines } from './lib/meshBake';

interface GltfPipeline {
  processGlb: (
    glb: Buffer,
    options: { dracoOptions: { compressionLevel: number } }
  ) => Promise<{ glb: Buffer }>;
}

const { processGlb } = gltfPipeline as unknown as GltfPipeline;

const OUT = resolve(process.cwd(), 'src/features/supporters/year/data/sample');
const THUMBNAILS = resolve(process.cwd(), 'src/features/bin-designer/data/examples/thumbnails');
const THUMBNAIL_PX = 320;

/** The longest print by far: a big knife block is a believable night shift. */
const LONGEST_PRINT = 'knife-block-chef-trio';
/** The rest of the year's designs. The one with the most triangles is the most complicated. */
const OTHER_DESIGNS = [
  'hero-engraved-tray',
  'hero-honeycomb-caddy',
  'hero-multicolor-organizer',
  'hero-u-shape',
  'corner-index-block',
  'hero-handled-tote',
];

/** About the chordal tolerance the supporters bake uses: invisible on a card. */
const EDGE_TOLERANCE_MM = 0.08;

interface BakedMesh {
  readonly id: string;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edges: Float32Array;
}

/**
 * glTF 2.0 binary with one node per design. Each mesh carries a triangle
 * primitive and a non-indexed LINES primitive for the BREP edge overlay.
 * Draco compresses the triangles; the lines ride raw.
 */
function buildGlb(meshes: readonly BakedMesh[]): Buffer {
  const chunks: Buffer[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  let offset = 0;
  const view = (data: Buffer): number => {
    const padded = pad4(data, 0);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
    chunks.push(padded);
    offset += padded.length;
    return bufferViews.length - 1;
  };
  const bytes = (array: Float32Array | Uint32Array): Buffer =>
    Buffer.from(array.buffer, array.byteOffset, array.byteLength);

  const gltfMeshes = meshes.map((mesh) => {
    if (mesh.indices.length === 0 || mesh.edges.length === 0) {
      throw new Error(`${mesh.id}: no triangles or no edge lines`);
    }
    const position = accessors.length;
    accessors.push(
      {
        bufferView: view(bytes(mesh.positions)),
        componentType: 5126,
        count: mesh.positions.length / 3,
        type: 'VEC3',
        ...bounds(mesh.positions),
      },
      {
        bufferView: view(bytes(mesh.normals)),
        componentType: 5126,
        count: mesh.normals.length / 3,
        type: 'VEC3',
      },
      {
        bufferView: view(bytes(mesh.indices)),
        componentType: 5125,
        count: mesh.indices.length,
        type: 'SCALAR',
      },
      {
        bufferView: view(bytes(mesh.edges)),
        componentType: 5126,
        count: mesh.edges.length / 3,
        type: 'VEC3',
        ...bounds(mesh.edges),
      }
    );
    return {
      name: mesh.id,
      primitives: [
        { attributes: { POSITION: position, NORMAL: position + 1 }, indices: position + 2 },
        { attributes: { POSITION: position + 3 }, mode: 1 },
      ],
    };
  });

  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0', generator: 'gen-your-2026-sample' },
    scene: 0,
    scenes: [{ nodes: meshes.map((_, index) => index) }],
    nodes: meshes.map((mesh, index) => ({ name: mesh.id, mesh: index })),
    meshes: gltfMeshes,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  const jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN'
  return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, bin]);
}

function shifted(values: ArrayLike<number>, dx: number, dy: number): Float32Array {
  const out = Float32Array.from(values);
  for (let i = 0; i < out.length; i += 3) {
    out[i] += dx;
    out[i + 1] += dy;
  }
  return out;
}

/** One mesh of the block and its companion rest, placed as the spinner places them. */
function withRest(body: MeshData, rest: MeshData, dx: number, dy: number): MeshData {
  const base = body.vertices.length / 3;
  const indices = new Uint32Array(body.indices.length + rest.indices.length);
  indices.set(body.indices);
  rest.indices.forEach((index, i) => {
    indices[body.indices.length + i] = index + base;
  });
  const join = (a: ArrayLike<number>, b: Float32Array): Float32Array => {
    const out = new Float32Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
  };
  return {
    ...body,
    vertices: join(body.vertices, shifted(rest.vertices, dx, dy)),
    normals: join(body.normals, Float32Array.from(rest.normals)),
    indices,
    edgeVertices: join(body.edgeVertices, shifted(rest.edgeVertices, dx, dy)),
    triangleCount: body.triangleCount + rest.triangleCount,
  };
}

function bake(id: string, mesh: MeshData): BakedMesh {
  return {
    id,
    positions: new Float32Array(mesh.vertices),
    normals: new Float32Array(mesh.normals),
    indices: new Uint32Array(mesh.indices),
    edges: simplifyEdgeLines(new Float32Array(mesh.edgeVertices), EDGE_TOLERANCE_MM),
  };
}

/** The gallery thumbnail, trimmed to the bin and shrunk, as WebP. */
async function thumbnails(ids: readonly string[]): Promise<Map<string, Buffer>> {
  const browser = await chromium.launch();
  const out = new Map<string, Buffer>();
  try {
    const page = await browser.newPage();
    for (const id of ids) {
      const png = readFileSync(resolve(THUMBNAILS, `${id}.png`)).toString('base64');
      const webp = await page.evaluate(
        async ({ src, size }) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          const full = document.createElement('canvas');
          full.width = image.width;
          full.height = image.height;
          const fullCtx = full.getContext('2d');
          if (!fullCtx) throw new Error('no 2d context');
          fullCtx.drawImage(image, 0, 0);
          // The gallery renders on an opaque near-black; key it out so the bin
          // sits on the card's own background, and trim to the bin.
          const pixels = fullCtx.getImageData(0, 0, full.width, full.height);
          const { data } = pixels;
          const [br, bg, bb] = [data[0], data[1], data[2]];
          let x0 = full.width;
          let y0 = full.height;
          let x1 = 0;
          let y1 = 0;
          for (let y = 0; y < full.height; y++) {
            for (let x = 0; x < full.width; x++) {
              const i = (y * full.width + x) * 4;
              const d = Math.max(
                Math.abs(data[i] - br),
                Math.abs(data[i + 1] - bg),
                Math.abs(data[i + 2] - bb)
              );
              data[i + 3] = Math.round(Math.min(1, Math.max(0, (d - 4) / 24)) * 255);
              if (d <= 12) continue;
              x0 = Math.min(x0, x);
              y0 = Math.min(y0, y);
              x1 = Math.max(x1, x);
              y1 = Math.max(y1, y);
            }
          }
          fullCtx.putImageData(pixels, 0, 0);
          const side = Math.max(x1 - x0, y1 - y0) * 1.12;
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;
          const out = document.createElement('canvas');
          out.width = size;
          out.height = size;
          const ctx = out.getContext('2d');
          if (!ctx) throw new Error('no 2d context');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(full, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
          return out.toDataURL('image/webp', 0.86);
        },
        { src: `data:image/png;base64,${png}`, size: THUMBNAIL_PX }
      );
      out.set(id, Buffer.from(webp.replace(/^data:image\/webp;base64,/, ''), 'base64'));
    }
  } finally {
    await browser.close();
  }
  return out;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  console.error('initializing occt-wasm kernel...');
  await initOcctWasmKernel();
  // Without the bundled faces, text silently drops out and an engraved design bakes bare.
  await loadTestFonts(Object.keys(TEXT_FONT_FILES));
  const { generateBin } = await import('../src/features/generation/worker/generators/binGenerator');
  const { generateKnifeRest } =
    await import('../src/features/generation/worker/generators/knifeRestBuilder');

  const ids = [LONGEST_PRINT, ...OTHER_DESIGNS];
  const designs = ids.map((id) => {
    const example = EXAMPLE_DESIGNS.find((entry) => entry.id === id);
    if (!example) throw new Error(`No bin designer example "${id}"`);
    console.error(`generating ${id}...`);
    // The key the designer caches under: nozzle-adjusted params, preview tolerances.
    const params = withSocketNozzle(example.params, DEFAULT_PRINT_SETTINGS.nozzleSizeMm);
    let mesh = generateBin(params, undefined, false);
    // The worker builds a companion knife rest apart from the block; the demo
    // has one mesh per design, so it carries the rest at its mated offset.
    const plan = planKnifeRest(params);
    if (plan) {
      const offset = knifeRestMatedOffset(params, plan);
      mesh = withRest(mesh, generateKnifeRest(params, undefined, false), offset.x, offset.y);
    }
    return {
      id,
      nameKey: example.nameKey,
      minutes: Math.round(estimateCommunityPrint(example.params).minutes),
      score: featureScore(example.params),
      triangles: meshTriangles(mesh),
      mesh,
    };
  });

  const longest = designs[0];
  const others = designs.slice(1);
  if (others.some((design) => design.minutes >= longest.minutes)) {
    throw new Error(`${LONGEST_PRINT} is no longer the longest print`);
  }
  const complicated = others.reduce((best, design) =>
    design.triangles > best.triangles ? design : best
  );

  const raw = buildGlb([bake(longest.id, longest.mesh), bake(complicated.id, complicated.mesh)]);
  const { glb } = await processGlb(raw, { dracoOptions: { compressionLevel: 7 } });
  writeFileSync(resolve(OUT, 'meshes.glb'), glb);
  console.error(`wrote meshes.glb: ${raw.length} -> ${glb.length} bytes (draco)`);

  for (const [id, webp] of await thumbnails(ids)) {
    writeFileSync(resolve(OUT, `${id}.webp`), webp);
    console.error(`wrote ${id}.webp: ${webp.length} bytes`);
  }

  const sample = {
    _comment: 'Generated by scripts/gen-your-2026-sample.ts. Do not edit by hand.',
    longestPrint: longest.id,
    mostComplicated: complicated.id,
    designs: designs.map(({ id, nameKey, minutes, score, triangles }) => ({
      id,
      nameKey,
      minutes,
      score,
      triangles,
    })),
  };
  writeFileSync(resolve(OUT, 'sample.json'), `${JSON.stringify(sample, null, 2)}\n`);
  console.error('wrote sample.json:', JSON.stringify(sample.designs));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
