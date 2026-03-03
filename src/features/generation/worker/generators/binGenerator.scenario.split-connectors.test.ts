// @vitest-environment node
/**
 * Scenario tests for split connector geometry in preview meshes.
 *
 * Validates that alignment connectors (pins, tongue-and-groove, lip steps)
 * are actually present in the tessellated mesh data returned by
 * generateSplitPreview.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';

interface SplitPreviewResult {
  readonly pieces: Array<{
    readonly vertices: Float32Array;
    readonly normals: Float32Array;
    readonly indices: Uint32Array;
    readonly edgeVertices: Float32Array;
    readonly label: string;
    readonly col: number;
    readonly row: number;
    readonly widthUnits: number;
    readonly depthUnits: number;
    readonly offsetX: number;
    readonly offsetY: number;
  }>;
}

type GenerateSplitPreviewFn = (
  params: BinParams,
  cutPlanesX: readonly number[],
  cutPlanesY: readonly number[],
  splitConnectorConfig?: SplitConnectorConfig
) => SplitPreviewResult;

let generateSplitPreview: GenerateSplitPreviewFn;

beforeAll(async () => {
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

  const mod = await import('@/features/generation/worker/generators/binGenerator');
  generateSplitPreview = mod.generateSplitPreview as GenerateSplitPreviewFn;
}, 30000);

/** 8×2×3 bin with default 1.2mm walls. At this wall thickness, only
 *  floor tongue and lip step are generated (wall tongues need ≥1.4mm). */
const OVERSIZED_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 8,
  depth: 2,
  height: 3,
};

const CUT_PLANES_X = [0];
const CUT_PLANES_Y: number[] = [];
const DISABLED_CONFIG: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

function totalTriangles(result: SplitPreviewResult): number {
  return result.pieces.reduce((sum, p) => sum + p.indices.length / 3, 0);
}

function totalVertices(result: SplitPreviewResult): number {
  return result.pieces.reduce((sum, p) => sum + p.vertices.length / 3, 0);
}

function maxVertexX(vertices: Float32Array): number {
  let max = -Infinity;
  for (let j = 0; j < vertices.length; j += 3) {
    max = Math.max(max, vertices[j]);
  }
  return max;
}

describe('split connector geometry in preview meshes', () => {
  it('generates 2 pieces for an 8-wide bin', () => {
    const result = generateSplitPreview(OVERSIZED_PARAMS, CUT_PLANES_X, CUT_PLANES_Y);
    expect(result.pieces).toHaveLength(2);
    for (const piece of result.pieces) {
      expect(piece.vertices.length).toBeGreaterThan(0);
      expect(piece.indices.length).toBeGreaterThan(0);
    }
  }, 60000);

  it('undefined splitConnectorConfig skips connectors (callers must provide fallback)', () => {
    const withUndefined = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      undefined
    );
    const withDisabled = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    expect(totalTriangles(withUndefined)).toBe(totalTriangles(withDisabled));
  }, 60000);

  it('enabled connectors produce more geometry than disabled', () => {
    const withConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DEFAULT_SPLIT_CONNECTOR_CONFIG
    );
    const withoutConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    expect(totalTriangles(withConnectors) - totalTriangles(withoutConnectors)).toBeGreaterThan(5);
    expect(totalVertices(withConnectors) - totalVertices(withoutConnectors)).toBeGreaterThan(0);

    // Male piece (col=1) — tongue features should extend the piece boundary
    const maleWith = withConnectors.pieces.find((p) => p.col === 1);
    const maleWithout = withoutConnectors.pieces.find((p) => p.col === 1);
    expect(maleWith).toBeDefined();
    expect(maleWithout).toBeDefined();
    if (maleWith && maleWithout) {
      const maxXWith = maxVertexX(maleWith.vertices);
      const maxXWithout = maxVertexX(maleWithout.vertices);
      // Lip step protrudes 0.5mm, floor tongue 3mm (if wall allows)
      expect(maxXWith).toBeGreaterThan(maxXWithout);
    }
  }, 60000);

  it('falls back to params.splitConnectors when config arg is undefined', () => {
    const paramsWithConnectors: BinParams = {
      ...OVERSIZED_PARAMS,
      splitConnectors: DEFAULT_SPLIT_CONNECTOR_CONFIG,
    };
    const result = generateSplitPreview(paramsWithConnectors, CUT_PLANES_X, CUT_PLANES_Y);
    const withoutConnectors = generateSplitPreview(
      OVERSIZED_PARAMS,
      CUT_PLANES_X,
      CUT_PLANES_Y,
      DISABLED_CONFIG
    );

    expect(totalTriangles(result) - totalTriangles(withoutConnectors)).toBeGreaterThan(5);
  }, 60000);
});
