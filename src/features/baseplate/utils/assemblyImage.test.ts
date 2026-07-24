// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAssemblyMapImage } from './assemblyImage';
import { computeBaseplateTiling } from './splitPlanner';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { BaseplateTiling } from '../types/tiling';

function makeParams(overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams {
  return {
    width: 6,
    depth: 4,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

/** Minimal recording 2D context so we can assert what got drawn. */
interface RecordingCtx {
  ctx: CanvasRenderingContext2D;
  fills: string[];
}

function makeRecordingCtx(): RecordingCtx {
  const fills: string[] = [];
  const ctx = {
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn((text: string) => {
      fills.push(text);
    }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

describe('generateAssemblyMapImage', () => {
  let recording: ReturnType<typeof makeRecordingCtx>;

  beforeEach(() => {
    recording = makeRecordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      contextId: string
    ) {
      return contextId === '2d' ? recording.ctx : null;
    } as typeof HTMLCanvasElement.prototype.getContext);

    // Deterministic PNG encoder: hand back a tiny PNG-signed blob.
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
      cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }));
    } as typeof HTMLCanvasElement.prototype.toBlob);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for an un-split tiling (nothing to assemble)', async () => {
    const tiling = computeBaseplateTiling(makeParams(), 256);
    expect(tiling.isSplit).toBe(false);
    expect(await generateAssemblyMapImage(tiling)).toBeNull();
  });

  it('draws one labeled cell per piece and encodes a PNG', async () => {
    // Large plate forces a split across the 256mm bed.
    const tiling = computeBaseplateTiling(makeParams({ width: 18, depth: 18 }), 256);
    expect(tiling.isSplit).toBe(true);

    const png = await generateAssemblyMapImage(tiling);
    expect(png).not.toBeNull();

    // PNG signature bytes survive the round-trip.
    const head = new Uint8Array(png as ArrayBuffer).slice(0, 4);
    expect(Array.from(head)).toEqual([0x89, 0x50, 0x4e, 0x47]);

    // Every piece label is drawn as prominent text, plus the front indicator.
    for (const piece of tiling.pieces) {
      expect(recording.fills).toContain(piece.label);
    }
    expect(recording.fills.join(' ')).toContain('Front of drawer');
  });

  it('returns null when a 2D context is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      null as unknown as CanvasRenderingContext2D
    );
    const tiling = computeBaseplateTiling(makeParams({ width: 18, depth: 18 }), 256);
    expect(await generateAssemblyMapImage(tiling)).toBeNull();
  });

  it('falls back to toDataURL when toBlob yields no blob', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
      cb(null);
    } as typeof HTMLCanvasElement.prototype.toBlob);
    // Base64 of the four PNG-signature bytes.
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      `data:image/png;base64,${btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47))}`
    );
    const tiling = computeBaseplateTiling(makeParams({ width: 18, depth: 18 }), 256);
    const png = await generateAssemblyMapImage(tiling);
    expect(png).not.toBeNull();
    expect(Array.from(new Uint8Array(png as ArrayBuffer))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('returns null for an empty-piece tiling', async () => {
    const empty: BaseplateTiling = {
      isSplit: true,
      pieces: [],
      margins: [],
      cols: 0,
      rows: 0,
      totalWidthUnits: 0,
      totalDepthUnits: 0,
      bedLoads: 0,
      stackCount: 1,
      stackSeparatorThickness: 0,
      paddingReductionHint: null,
    };
    expect(await generateAssemblyMapImage(empty)).toBeNull();
  });
});
