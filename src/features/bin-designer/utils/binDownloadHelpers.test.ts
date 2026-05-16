import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSinglePiece3MF, buildMultiObject3MF } from './binDownloadHelpers';
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

    it('includes colorConfig only on the first piece when featureColors.enabled is true', () => {
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
      // Ancillary pieces (dividers, lid) always ship solid-color.
      expect(objects[1].colorConfig).toBeUndefined();
    });
  });
});
