// @vitest-environment node
/**
 * Split export in STEP format.
 *
 * STEP writes each piece's exact BREP solid instead of a tessellation, so the
 * failure modes are different from the STL path's. The one that matters is
 * silent: a piece that ships the WHOLE bin (the cut never reached the exported
 * solid) is a perfectly valid STEP file of the right format and a plausible
 * size — nothing about the bytes gives it away. So every geometric claim here
 * is made by importing the file back and measuring the solid it describes,
 * never by inspecting the buffer.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { importSTEP, mesh, getBounds, isOk as isBrepOk } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { initBrepjs, getExportSplitBin } from './__kernel-tests__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const GRID_UNIT = GRIDFINITY.GRID_SIZE; // 42mm
const CLEARANCE = GRIDFINITY.TOLERANCE; // 0.5mm — outer footprint is N × 42 − 0.5
const NO_CONNECTORS = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

/** A 6-wide bin needs two pieces on any bed under 252mm; cut at the centre. */
const SPLIT_WIDTH = 6;
const CENTER_CUT = [0];

/**
 * Stand-in for an imported mesh. `hasMeshImprints` only asks whether the
 * cutout resolves to an asset, so the payload is never read — see the guard
 * test below for why that is the assertion, not a shortcut.
 */
const UNDECODED_MESH_ASSET: MeshAsset = {
  name: 'tool',
  data: '',
  triangleCount: 12,
  sizeMm: { x: 20, y: 10, z: 5 },
  outlines: [],
};

function meshImprintCutout(): Cutout {
  return {
    id: 'mesh-1',
    shape: 'mesh',
    meshId: 'asset-1',
    x: 10,
    y: 10,
    width: 20,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

interface ImportedPiece {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly triangleCount: number;
}

/**
 * Read an exported STEP buffer back into a solid and measure it.
 *
 * The bounds come from tessellating the imported shape rather than from
 * `getBounds`: a bounding box can be reported off cached or approximate
 * topology, while triangles only exist where the importer actually recovered
 * surface — which is the thing under test.
 */
async function importAndMeasure(data: ArrayBuffer, label: string): Promise<ImportedPiece> {
  const decoded = new TextDecoder().decode(new Uint8Array(data, 0, Math.min(64, data.byteLength)));
  expect(decoded.trimStart().startsWith('ISO-10303-21'), `${label}: not a STEP file`).toBe(true);

  const result = await importSTEP(new Blob([data]));
  expect(isBrepOk(result), `${label}: STEP re-import failed`).toBe(true);
  if (!isBrepOk(result)) throw new Error('unreachable');

  const shape = result.value as Shape3D;
  try {
    // Non-null bounds are the importer's own sanity check; the measurements
    // below come from the mesh.
    expect(getBounds(shape), `${label}: imported shape has no bounds`).not.toBeNull();
    const m = mesh(shape, { tolerance: 0.05, angularTolerance: 10 });
    const vertices = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
    expect(hasNoNaNOrInfinity(vertices), `${label}: imported vertices have NaN/Infinity`).toBe(
      true
    );
    return { ...boundingBox(vertices), triangleCount: vertices.length / 9 };
  } finally {
    shape.delete();
  }
}

describe('split export: STEP pieces', () => {
  it('writes one STEP solid per piece, each covering only its own half', async () => {
    const exportSplitBin = getExportSplitBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
    };

    const exported = await exportSplitBin(params, CENTER_CUT, [], 0.01, 5, NO_CONNECTORS, 'step');
    expect(exported.pieces).toHaveLength(2);

    const outerW = params.width * GRID_UNIT - CLEARANCE;
    const halfW = outerW / 2;
    const wallTopZ = params.height * GRIDFINITY.HEIGHT_UNIT;

    const measured = [
      await importAndMeasure(exported.pieces[0].data, 'piece 0'),
      await importAndMeasure(exported.pieces[1].data, 'piece 1'),
    ];

    // Sorted so the assertions read left-then-right regardless of the order
    // the cut happened to emit them in.
    measured.sort((a, b) => a.minX - b.minX);
    const [left, right] = measured;

    // The load-bearing assertion: a piece that quietly kept the whole bin spans
    // the full width here, and every other check in this file still passes.
    for (const [label, piece] of [
      ['left', left],
      ['right', right],
    ] as const) {
      const width = piece.maxX - piece.minX;
      expect(
        width,
        `${label} piece spans ${width.toFixed(1)}mm — the whole bin is ${outerW.toFixed(1)}mm, ` +
          `so this piece was never cut`
      ).toBeLessThan(halfW + 2);
      expect(width, `${label} piece is too narrow to be half a bin`).toBeGreaterThan(halfW - 2);
      // A piece that lost its walls and kept only the socket would stop ~5mm up.
      expect(piece.maxZ - piece.minZ, `${label} piece is missing its walls`).toBeGreaterThan(
        wallTopZ * 0.9
      );
      // Full depth: the cut was on X only, so neither piece may lose Y extent.
      const depth = piece.maxY - piece.minY;
      expect(depth, `${label} piece lost depth`).toBeGreaterThan(
        params.depth * GRID_UNIT - CLEARANCE - 2
      );
      expect(piece.triangleCount, `${label} piece re-imported nearly empty`).toBeGreaterThan(50);
    }

    // Together the two pieces reconstruct the bin, and they meet at the cut
    // rather than overlapping it.
    expect(left.minX).toBeLessThan(-halfW + 2);
    expect(right.maxX).toBeGreaterThan(halfW - 2);
    expect(Math.abs(left.maxX)).toBeLessThan(2);
    expect(Math.abs(right.minX)).toBeLessThan(2);
  }, 120000);

  it('cuts on the depth axis too, and keeps the stacking lip', async () => {
    const exportSplitBin = getExportSplitBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: SPLIT_WIDTH,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };

    const exported = await exportSplitBin(params, [], CENTER_CUT, 0.01, 5, NO_CONNECTORS, 'step');
    expect(exported.pieces).toHaveLength(2);

    const outerD = params.depth * GRID_UNIT - CLEARANCE;
    const wallTopZ = params.height * GRIDFINITY.HEIGHT_UNIT;

    for (let i = 0; i < exported.pieces.length; i++) {
      const piece = await importAndMeasure(exported.pieces[i].data, `piece ${i}`);
      const depth = piece.maxY - piece.minY;
      expect(depth, `piece ${i} was never cut on Y`).toBeLessThan(outerD / 2 + 2);
      // The lip sits above the wall top; without it the piece stops at wallTopZ.
      expect(piece.maxZ, `piece ${i} lost its stacking lip`).toBeGreaterThan(wallTopZ + 1);
    }
  }, 120000);

  it('carries split connectors into the STEP solid', async () => {
    const exportSplitBin = getExportSplitBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
    };

    const withConnectors = await exportSplitBin(
      params,
      CENTER_CUT,
      [],
      0.01,
      5,
      DEFAULT_SPLIT_CONNECTOR_CONFIG,
      'step'
    );
    const without = await exportSplitBin(params, CENTER_CUT, [], 0.01, 5, NO_CONNECTORS, 'step');

    // Connectors add a pin on one face and a socket on the other, so the solid
    // gains surface. Equal byte counts would mean the config was dropped before
    // it reached the boolean.
    expect(withConnectors.pieces[0].data.byteLength).not.toBe(without.pieces[0].data.byteLength);

    const measured = await importAndMeasure(withConnectors.pieces[0].data, 'connector piece');
    expect(measured.triangleCount).toBeGreaterThan(50);
  }, 180000);

  it('refuses STEP for a design whose pockets only exist in the mesh', async () => {
    const exportSplitBin = getExportSplitBin();
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: SPLIT_WIDTH,
      depth: 2,
      height: 3,
      // A mesh-imprint cutout is subtracted after tessellation, so no solid
      // describes it — the same guard `exportBin` applies to a whole bin. The
      // asset never gets decoded: the guard fires before any geometry work,
      // which is the point (an oversized design must not pay for the split
      // first and fail after).
      cutouts: [meshImprintCutout()],
      meshAssets: { 'asset-1': UNDECODED_MESH_ASSET },
    };

    await expect(
      exportSplitBin(params, CENTER_CUT, [], 0.01, 5, NO_CONNECTORS, 'step')
    ).rejects.toThrow(/mesh imprint/i);
  }, 60000);
});
