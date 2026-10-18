// @vitest-environment node
/**
 * The slanted bin's end support as an export piece. A companion pass that
 * re-emits the bin, or a STEP compound that never moved the support off the
 * bin's footprint, both produce valid files of plausible size, so every claim
 * here reads the exported buffer back and measures it.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { importSTEP, mesh, isOk as isBrepOk } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import type { BinParams } from '@/shared/types/bin';
import { planSlantSupport } from '@/shared/utils/slantPlan';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExportFormat } from '../../bridge/types';
import { handleExportCombined } from '../handlers/exportHandler';
import { setKernelInitialized } from '../handlers/workerContext';
import { initBrepjs, getKernelName } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import type { BoundingBox } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
  setKernelInitialized(getKernelName(), false, 1);
}, 60000);

afterEach(() => {
  vi.unstubAllGlobals();
});

interface Piece {
  readonly data: ArrayBuffer;
  readonly label: string;
}

function asPost(value: unknown): { type?: unknown; error?: unknown; pieces?: unknown } {
  return typeof value === 'object' && value !== null ? value : {};
}

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
      requestId: 'slant-support-combined',
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
  if (!piece) throw new Error(`no piece '${label}' (got ${pieces.map((p) => p.label).join(', ')})`);
  return piece;
}

function stlBox(data: ArrayBuffer): BoundingBox {
  const parsed = parseSTLBinary(data);
  if (!isOk(parsed)) throw new Error('exported STL did not parse');
  return boundingBox(parsed.value.vertices);
}

async function stepBox(data: ArrayBuffer): Promise<BoundingBox> {
  const result = await importSTEP(new Blob([data]));
  if (!isBrepOk(result)) throw new Error('STEP re-import failed');
  const shape = result.value as Shape3D;
  try {
    const m = mesh(shape, { tolerance: 0.05, angularTolerance: 10 });
    return boundingBox(
      m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices)
    );
  } finally {
    shape.delete();
  }
}

const supported: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 1,
  depth: 2,
  height: 6,
  slant: { angleDeg: 45, side: 'right', endSupport: true },
};

describe('combined export: slant end support', () => {
  it('ships the support as its own STL piece in its own print frame', async () => {
    const plan = planSlantSupport(supported);
    if (!plan) throw new Error('expected a support plan');
    const pieces = await exportCombined(supported, 'stl');
    expect(pieces.map((p) => p.label)).toEqual(['bin', 'slant-support']);

    const support = stlBox(pieceLabeled(pieces, 'slant-support').data);
    expect(support.maxX - support.minX).toBeCloseTo(plan.lengthU * supported.gridUnitMm - 0.5, 0);
    expect(support.maxY - support.minY).toBeCloseTo(plan.widthU * supported.gridUnitMm - 0.5, 0);
    expect(support.minZ).toBeCloseTo(0, 1);
    expect(support.maxZ).toBeCloseTo(plan.topZ, 1);
    expect((support.minX + support.maxX) / 2).toBeCloseTo(0, 1);
  }, 180000);

  it('stands the support past the leaning wall in the STEP compound', async () => {
    const plan = planSlantSupport(supported);
    if (!plan) throw new Error('expected a support plan');
    const pieces = await exportCombined(supported, 'step');
    expect(pieces.map((p) => p.label)).toEqual(['assembly']);
    const assembly = await stepBox(pieces[0].data);
    const binHalf = (supported.width * supported.gridUnitMm - 0.5) / 2;
    // The support's far edge sets the assembly's +X extent; an unmoved support
    // would leave it at the bin's own leaning top.
    expect(assembly.maxX).toBeCloseTo(binHalf + plan.lengthU * supported.gridUnitMm, 0);
    expect(assembly.minX).toBeCloseTo(-binHalf, 1);
  }, 180000);

  it('ships no support piece without the end support', async () => {
    const pieces = await exportCombined(
      { ...supported, slant: { angleDeg: 45, side: 'right' } },
      'stl'
    );
    expect(pieces.map((p) => p.label)).toEqual(['bin']);
  }, 180000);
});
