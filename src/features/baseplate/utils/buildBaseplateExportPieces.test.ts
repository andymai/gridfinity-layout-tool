import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import type { GenerationBridge } from '@/shared/generation/bridge';
import { buildBaseplateExportPieces } from './buildBaseplateExportPieces';
import type { BuildBaseplateExportInput } from './buildBaseplateExportPieces';

function buf(byte: number, length = 8): ArrayBuffer {
  const b = new ArrayBuffer(length);
  new Uint8Array(b).fill(byte);
  return b;
}

/** One-triangle binary STL — enough for the stack path's parse + re-encode. */
function stlBuf(): ArrayBuffer {
  const b = new ArrayBuffer(84 + 50);
  const dv = new DataView(b);
  dv.setUint32(80, 1, true);
  const floats = [0, 0, 1, 0, 0, 0, 10, 0, 0, 0, 10, 0];
  floats.forEach((v, i) => dv.setFloat32(84 + i * 4, v, true));
  return b;
}

/** Minimal bridge stub — only the methods the tested branches touch. */
function makeBridge(): {
  bridge: GenerationBridge;
  exportBaseplate: ReturnType<typeof vi.fn>;
  exportMargin: ReturnType<typeof vi.fn>;
} {
  const exportBaseplate = vi.fn((_, format: string) =>
    Promise.resolve({
      data: format === 'stl' ? stlBuf() : buf(0xa1, 12),
      fileName: `plate.${format}`,
      format,
    })
  );
  const exportMargin = vi.fn((_params, _margin, format: string) =>
    Promise.resolve({ data: stlBuf(), fileName: `margin.${format}`, format })
  );
  const bridge = { exportBaseplate, exportMargin } as unknown as GenerationBridge;
  return { bridge, exportBaseplate, exportMargin };
}

const PRINT_SETTINGS = {
  nozzleSizeMm: 0.4,
  layerHeightMm: 0.2,
  infillPercent: 15,
  maxPrintHeightMm: 250,
};

function input(overrides: Partial<BuildBaseplateExportInput> = {}): BuildBaseplateExportInput {
  return {
    baseplateParams: DEFAULT_BASEPLATE_PARAMS,
    drawerWidth: 4,
    drawerDepth: 4,
    gridUnitMm: 42,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    // Bed far larger than the 4×4u (168mm) plate → single piece, no split.
    printBedWidthMm: 1000,
    printBedDepthMm: 1000,
    format: 'stl',
    fileNameConfig: { style: 'descriptive', customName: '', format: 'stl' },
    printSettings: PRINT_SETTINGS,
    ...overrides,
  };
}

describe('buildBaseplateExportPieces', () => {
  it('returns a single un-split plate as one labelless piece with no guide', async () => {
    const { bridge, exportBaseplate } = makeBridge();
    const result = await buildBaseplateExportPieces(bridge, null, input());

    expect(result.pieces).toHaveLength(1);
    expect(result.pieces[0].label).toBe('');
    expect(result.guideText).toBe('');
    expect(result.extension).toBe('.stl');
    expect(result.baseNameNoExt.length).toBeGreaterThan(0);
    expect(result.splitStats).toBeUndefined();
    expect(exportBaseplate).toHaveBeenCalledWith(expect.anything(), 'stl');
  });

  it('uses the STEP format and extension for a single STEP plate', async () => {
    const { bridge, exportBaseplate } = makeBridge();
    const result = await buildBaseplateExportPieces(
      bridge,
      null,
      input({
        format: 'step',
        fileNameConfig: { style: 'descriptive', customName: '', format: 'step' },
      })
    );

    expect(result.extension).toBe('.step');
    expect(result.pieces).toHaveLength(1);
    expect(exportBaseplate).toHaveBeenCalledWith(expect.anything(), 'step');
  });

  it('splits a large plate into one labelled piece per slot with a print guide', async () => {
    const { bridge } = makeBridge();
    // 8×8u (336mm) plate on a 256mm bed forces a 2×2 split.
    const result = await buildBaseplateExportPieces(
      bridge,
      null,
      input({ drawerWidth: 8, drawerDepth: 8, printBedWidthMm: 256, printBedDepthMm: 256 })
    );

    expect(result.splitStats).toBeDefined();
    expect(result.pieces.length).toBe(result.splitStats?.totalPieces);
    expect(result.pieces.length).toBeGreaterThan(1);
    expect(result.pieces.every((p) => p.label.length > 0)).toBe(true);
    expect(result.guideText).toContain('Gridfinity Baseplate Print Guide');
  });

  it('ships rail pieces and a combined guide alongside a stacked tower (#2641)', async () => {
    const { bridge, exportMargin } = makeBridge();
    const result = await buildBaseplateExportPieces(
      bridge,
      null,
      input({
        baseplateParams: {
          ...DEFAULT_BASEPLATE_PARAMS,
          paddingLeft: 10,
          paddingRight: 10,
          detachMargins: true,
          stackPrint: { enabled: true, gapMm: 0.2 as never, copies: 3 },
        },
      })
    );

    expect(exportMargin).toHaveBeenCalled();
    const labels = result.pieces.map((p) => p.label);
    expect(labels).toContain('body');
    const railLabels = labels.filter((l) => l.startsWith('margin-'));
    // One file per rail; the guide (not file duplication) carries the ×copies
    // instruction, so each rail id must appear exactly once.
    expect(railLabels.length).toBeGreaterThan(0);
    expect(new Set(railLabels).size).toBe(railLabels.length);
    expect(result.guideText).toContain('Stack printing');
    expect(result.guideText).toContain('Detached margins');
    expect(result.guideText).toContain('Print each rail file 3 times');
  });

  it('keeps the stacked single-file export labelless when nothing detaches', async () => {
    const { bridge, exportMargin } = makeBridge();
    const result = await buildBaseplateExportPieces(
      bridge,
      null,
      input({
        baseplateParams: {
          ...DEFAULT_BASEPLATE_PARAMS,
          stackPrint: { enabled: true, gapMm: 0.2 as never, copies: 3 },
        },
      })
    );

    expect(exportMargin).not.toHaveBeenCalled();
    expect(result.pieces).toHaveLength(1);
    expect(result.pieces[0].label).toBe('');
    expect(result.guideText).toBe('');
  });

  it('reports progress during a split export', async () => {
    const { bridge } = makeBridge();
    const onProgress = vi.fn();
    await buildBaseplateExportPieces(
      bridge,
      null,
      input({
        drawerWidth: 8,
        drawerDepth: 8,
        printBedWidthMm: 256,
        printBedDepthMm: 256,
        onProgress,
      })
    );
    expect(onProgress).toHaveBeenCalled();
    const lastCall = onProgress.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ total: expect.any(Number) });
  });
});
