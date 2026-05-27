import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSinglePiece3MF,
  buildMultiObject3MF,
  buildReportIssueUrl,
} from './binDownloadHelpers';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';
import type { CombinedExportResult } from '@/shared/generation/bridge';
import type { ThreeMFPrintSettings } from '@/shared/generation/export';
import { ok } from '@/core/result';

const export3MFSpy = vi.fn(() => new Blob([], { type: 'model/3mf' }));
const export3MFMultiObjectSpy = vi.fn(() => new Blob([], { type: 'model/3mf' }));

vi.mock('@/shared/generation/export', () => ({
  export3MF: (...args: unknown[]) => export3MFSpy(...args),
  export3MFMultiObject: (...args: unknown[]) => export3MFMultiObjectSpy(...args),
}));

vi.mock('@/features/bin-designer/utils/stlParser', () => ({
  parseSTLBinary: () =>
    ok({
      vertices: new Float32Array(9), // 1 triangle = 3 vertices × 3 components
      normals: new Float32Array(9),
    }),
}));

vi.mock('@/features/bin-designer/utils/materialMapping', () => ({
  buildTriangleMaterialIndices: () => ({
    materials: [{ id: 0, color: '#ffffff' }],
    triangleMaterialIds: new Uint8Array([0]),
  }),
}));

const PRINT_SETTINGS: ThreeMFPrintSettings = {
  layerHeight: 0.2,
  infillPercent: 20,
  material: 'PLA',
  supportRequired: false,
  estimatedMinutes: 30,
  estimatedGrams: 15,
};

const FAKE_FACE_GROUPS: CombinedExportResult['faceGroups'] = [{ feature: 0, start: 0, count: 1 }];

function paramsWithMultiColor(enabled: boolean): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    featureColors: {
      ...DEFAULT_BIN_PARAMS.featureColors,
      enabled,
      // Diverged zone colors so divergence isn't what gates the export.
      body: '#3b82f6',
      labelTab: '#22c55e',
    },
  };
}

describe('binDownloadHelpers — multi-color export gate', () => {
  beforeEach(() => {
    export3MFSpy.mockClear();
    export3MFMultiObjectSpy.mockClear();
  });

  describe('buildSinglePiece3MF', () => {
    it('omits colorConfig when featureColors.enabled is false', () => {
      buildSinglePiece3MF(
        new ArrayBuffer(0),
        FAKE_FACE_GROUPS,
        paramsWithMultiColor(false),
        'bin',
        PRINT_SETTINGS,
        true // applyMultiColor — caller asks for it, but the per-design gate overrides
      );
      const opts = export3MFSpy.mock.calls[0][2] as { colorConfig?: unknown };
      expect(opts.colorConfig).toBeUndefined();
    });

    it('includes colorConfig when featureColors.enabled is true', () => {
      buildSinglePiece3MF(
        new ArrayBuffer(0),
        FAKE_FACE_GROUPS,
        paramsWithMultiColor(true),
        'bin',
        PRINT_SETTINGS,
        true
      );
      const opts = export3MFSpy.mock.calls[0][2] as { colorConfig?: unknown };
      expect(opts.colorConfig).toBeDefined();
    });

    it('omits colorConfig when applyMultiColor is false (e.g. ancillary piece)', () => {
      // applyMultiColor=false simulates calling for a divider or lid where
      // multi-color material indices should always be skipped.
      buildSinglePiece3MF(
        new ArrayBuffer(0),
        FAKE_FACE_GROUPS,
        paramsWithMultiColor(true),
        'divider',
        PRINT_SETTINGS,
        false
      );
      const opts = export3MFSpy.mock.calls[0][2] as { colorConfig?: unknown };
      expect(opts.colorConfig).toBeUndefined();
    });
  });

  describe('buildMultiObject3MF', () => {
    const pieces: CombinedExportResult['pieces'] = [
      { label: 'bin', data: new ArrayBuffer(0) },
      { label: 'lid', data: new ArrayBuffer(0) },
    ];

    it('omits colorConfig on the bin piece when featureColors.enabled is false', () => {
      buildMultiObject3MF(
        pieces,
        FAKE_FACE_GROUPS,
        paramsWithMultiColor(false),
        'assembly',
        PRINT_SETTINGS
      );
      const objects = export3MFMultiObjectSpy.mock.calls[0][0] as Array<{
        colorConfig?: unknown;
      }>;
      expect(objects[0].colorConfig).toBeUndefined();
      expect(objects[1].colorConfig).toBeUndefined();
    });

    it('includes colorConfig on bin (per-triangle) and lid (uniform) when featureColors.enabled is true', () => {
      buildMultiObject3MF(
        pieces,
        FAKE_FACE_GROUPS,
        paramsWithMultiColor(true),
        'assembly',
        PRINT_SETTINGS
      );
      const objects = export3MFMultiObjectSpy.mock.calls[0][0] as Array<{
        colorConfig?: unknown;
      }>;
      expect(objects[0].colorConfig).toBeDefined();
      // Lid carries a uniform colorConfig referencing featureColors.lid so a
      // multi-color print actually swaps filaments between body and lid.
      expect(objects[1].colorConfig).toBeDefined();
    });
  });
});

describe('buildReportIssueUrl', () => {
  function extractBody(url: string): string {
    return new URL(url).searchParams.get('body') ?? '';
  }

  function extractParams(url: string): Record<string, unknown> {
    const body = extractBody(url);
    const match = body.match(/```json\n([\s\S]*?)\n```/);
    if (!match) throw new Error('no JSON block in body');
    return JSON.parse(match[1]) as Record<string, unknown>;
  }

  it('includes scoop config when scoop is enabled (issue #1757 — scoop was previously omitted)', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 3.5,
      depth: 11,
      height: 9,
      scoop: { enabled: true, radius: 'auto' },
    };
    const url = buildReportIssueUrl(params, new Error('test'), 'stl');
    const json = extractParams(url);
    expect(json.scoop).toEqual({ enabled: true, radius: 'auto' });
  });

  it('marks scoop as `false` when disabled (so its state is unambiguous)', () => {
    const url = buildReportIssueUrl(DEFAULT_BIN_PARAMS, new Error('test'), 'stl');
    const json = extractParams(url);
    expect(json.scoop).toBe(false);
  });

  it('captures compartments + walls + label + lid + featureColors flags', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 0, 1, 1] }, // merged cells
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    };
    const url = buildReportIssueUrl(params, new Error('test'), 'stl');
    const json = extractParams(url);
    expect(json.compartments).toEqual({ cols: 2, rows: 2, merged: true });
    expect(json.label).toMatchObject({ enabled: true, support: 'bracket', depth: 12 });
    expect(json).toHaveProperty('lid');
    expect(json).toHaveProperty('featureColors');
    expect(json).toHaveProperty('wallThickness', params.wallThickness);
  });

  it('does not flag renumbered-but-unmerged compartments as merged', () => {
    // Each cell has a unique ID — these are 4 distinct compartments, not
    // merged, even though the IDs aren't in `0..N-1` order. A positional
    // `id !== i` check would false-positive here.
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [3, 2, 1, 0] },
    };
    const url = buildReportIssueUrl(params, new Error('test'), 'stl');
    const json = extractParams(url);
    expect((json.compartments as { merged: boolean }).merged).toBe(false);
  });
});
