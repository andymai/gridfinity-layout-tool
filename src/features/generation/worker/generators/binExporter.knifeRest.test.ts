// @vitest-environment node
/**
 * The knife block's handle rest as an export piece.
 *
 * The rest is a second printed part, so the failure modes are the ones gotcha
 * 20 describes and none of them show up in a byte length or a piece count: a
 * companion pass that quietly re-emits the whole bin is a valid file of a
 * plausible size, and a compound that never translated the rest is a valid
 * assembly with two solids occupying the same space. So every geometric claim
 * here is made by reading the exported buffer back and measuring the shape it
 * describes.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { importSTEP, mesh, isOk as isBrepOk } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { knifeRestMatedOffset, planKnifeRest } from '@/shared/utils/knifeRestPlan';
import type { ExportFormat } from '../../bridge/types';
import { handleExportCombined } from '../handlers/exportHandler';
import { setKernelInitialized } from '../handlers/workerContext';
import { initBrepjs, getKernelName } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { knifeBlock } from './scenarios/knifeBlock';

beforeAll(async () => {
  await initBrepjs();
  // The handler refuses every request until the worker reports a live kernel.
  setKernelInitialized(getKernelName(), false, 1);
}, 60000);

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 6x1x8 solid block whose chef slot breaches the +X wall — the rest's host. */
const CHEF_BLOCK = knifeBlock[1].params;

interface Piece {
  readonly data: ArrayBuffer;
  readonly label: string;
}

interface Post {
  readonly type?: unknown;
  readonly error?: unknown;
  readonly pieces?: unknown;
}

function asPost(value: unknown): Post {
  return typeof value === 'object' && value !== null ? value : {};
}

/**
 * Run the combined export handler against a stubbed worker scope and return
 * its pieces. An ERROR response is re-thrown with the worker's own message —
 * otherwise a failed export reads as "the piece is missing".
 */
async function exportCombined(
  params: BinParams,
  format: ExportFormat,
  separatePieces?: boolean
): Promise<readonly Piece[]> {
  const posts: unknown[] = [];
  vi.stubGlobal('self', {
    postMessage: (response: unknown): void => {
      posts.push(response);
    },
  });
  await handleExportCombined({
    type: 'EXPORT_COMBINED',
    payload: {
      requestId: 'knife-rest-combined',
      params,
      format,
      ...(separatePieces === true ? { separatePieces: true } : {}),
    },
  });

  const failure = posts.map(asPost).find((p) => p.type === 'ERROR');
  if (failure) throw new Error(String(failure.error));
  const result = posts.map(asPost).find((p) => p.type === 'COMBINED_EXPORT_RESULT');
  if (!result) throw new Error('handler posted no COMBINED_EXPORT_RESULT');
  return result.pieces as readonly Piece[];
}

function pieceLabeled(pieces: readonly Piece[], label: string): Piece {
  const piece = pieces.find((p) => p.label === label);
  if (!piece) {
    throw new Error(`no piece labeled '${label}' (got ${pieces.map((p) => p.label).join(', ')})`);
  }
  return piece;
}

interface Measured {
  readonly spanX: number;
  readonly spanY: number;
  readonly spanZ: number;
  readonly minZ: number;
  readonly minX: number;
  readonly maxX: number;
}

function measure(vertices: Float32Array): Measured {
  const bb = boundingBox(vertices);
  return {
    spanX: bb.maxX - bb.minX,
    spanY: bb.maxY - bb.minY,
    spanZ: bb.maxZ - bb.minZ,
    minZ: bb.minZ,
    minX: bb.minX,
    maxX: bb.maxX,
  };
}

function measureStl(data: ArrayBuffer, label: string): Measured {
  const parsed = parseSTLBinary(data);
  if (!isOk(parsed)) throw new Error(`${label}: exported STL did not parse`);
  return measure(parsed.value.vertices);
}

/** Read an exported STEP buffer back and measure the solid(s) it describes. */
async function measureStep(data: ArrayBuffer, label: string): Promise<Measured> {
  const header = new TextDecoder().decode(new Uint8Array(data, 0, Math.min(64, data.byteLength)));
  expect(header.trimStart().startsWith('ISO-10303-21'), `${label}: not a STEP file`).toBe(true);

  const result = await importSTEP(new Blob([data]));
  expect(isBrepOk(result), `${label}: STEP re-import failed`).toBe(true);
  if (!isBrepOk(result)) throw new Error('unreachable');

  const shape = result.value as Shape3D;
  try {
    const m = mesh(shape, { tolerance: 0.05, angularTolerance: 10 });
    const vertices = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
    expect(vertices.length, `${label}: re-imported empty`).toBeGreaterThan(0);
    return measure(vertices);
  } finally {
    shape.delete();
  }
}

const withRest = buildParams({ ...CHEF_BLOCK, knifeRest: { enabled: true } });
const withoutRest = buildParams(CHEF_BLOCK);

/** Outer footprint of an N-unit run of cells (mm), the frame both parts print in. */
function outerMm(units: number, unitMm: number): number {
  return units * unitMm - GRIDFINITY_SPEC.TOLERANCE;
}

describe('combined export: knife handle rest', () => {
  it('ships the rest as its own STL piece beside the bin', async () => {
    const plan = planKnifeRest(withRest);
    expect(plan).not.toBeNull();
    if (!plan) return;

    const pieces = await exportCombined(withRest, 'stl');
    expect(pieces.map((p) => p.label)).toEqual(expect.arrayContaining(['bin', 'knife-rest']));

    const rest = measureStl(pieceLabeled(pieces, 'knife-rest').data, 'knife-rest');
    const restOuter = outerMm(plan.alongU, withRest.gridUnitMm);
    // The load-bearing assertion: a companion pass that shipped the bin again
    // spans the block's 251.5mm here, and every other check still passes.
    expect(rest.spanX, 'rest piece is not the rest').toBeCloseTo(restOuter, 0);
    expect(rest.spanY).toBeCloseTo(outerMm(plan.crossU, withRest.gridUnitMm), 0);
    // Print frame: socket bottom on Z=0, top at the plan's body top.
    expect(rest.minZ).toBeCloseTo(0, 1);
    expect(rest.spanZ).toBeCloseTo(plan.bodyTopZMm, 1);

    const bin = measureStl(pieceLabeled(pieces, 'bin').data, 'bin');
    expect(bin.spanX).toBeCloseTo(outerMm(withRest.width, withRest.gridUnitMm), 0);
  }, 180000);

  it('ships the rest as its own STEP solid under separatePieces', async () => {
    const plan = planKnifeRest(withRest);
    expect(plan).not.toBeNull();
    if (!plan) return;

    const pieces = await exportCombined(withRest, 'step', true);
    expect(pieces.map((p) => p.label)).toEqual(expect.arrayContaining(['bin', 'knife-rest']));

    const rest = await measureStep(pieceLabeled(pieces, 'knife-rest').data, 'knife-rest');
    expect(rest.spanX).toBeCloseTo(outerMm(plan.alongU, withRest.gridUnitMm), 0);
    expect(rest.spanZ).toBeCloseTo(plan.bodyTopZMm, 0);
  }, 180000);

  it('seats the rest beside the block in the STEP compound', async () => {
    const plan = planKnifeRest(withRest);
    expect(plan).not.toBeNull();
    if (!plan) return;

    const pieces = await exportCombined(withRest, 'step');
    expect(pieces.map((p) => p.label)).toEqual(['assembly']);

    const assembly = await measureStep(pieces[0].data, 'assembly');
    const blockOuter = outerMm(withRest.width, withRest.gridUnitMm);
    const restOuter = outerMm(plan.alongU, withRest.gridUnitMm);
    // An untranslated rest sits inside the block, so the assembly would span
    // the block alone. Seated, it reaches the far side of the gap.
    expect(assembly.spanX).toBeCloseTo(blockOuter + plan.gapMm + restOuter, 0);
    expect(assembly.minX).toBeCloseTo(-blockOuter / 2, 0);
    expect(assembly.maxX).toBeCloseTo(knifeRestMatedOffset(withRest, plan).x + restOuter / 2, 0);
  }, 180000);

  it('emits no rest piece for a knife block without one', async () => {
    expect(planKnifeRest(withoutRest)).toBeNull();

    const pieces = await exportCombined(withoutRest, 'stl');
    expect(pieces.map((p) => p.label)).toEqual(['bin']);
  }, 180000);
});
