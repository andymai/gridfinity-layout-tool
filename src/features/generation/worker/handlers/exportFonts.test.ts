/**
 * Every handler that builds a bin for export must register the design's fonts
 * first. A whole-layout export runs in pool workers that never previewed the
 * design; text whose face the preview alone would have fetched (the default
 * `atkinson-bold`) silently dropped out of the exported mesh.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { ExportCombinedMessage, ExportSplitMessage } from '../../bridge/types';
import type * as WorkerContext from './workerContext';
import type * as MeshImprint from '../generators/meshImprint';

const order: string[] = [];

vi.mock('../wasmInstantiator', () => ({
  ensureDesignFonts: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 5));
    order.push('fonts');
  }),
  ensureFontsLoaded: vi.fn(async () => undefined),
}));

vi.mock('./workerContext', async (importOriginal) => ({
  ...(await importOriginal<typeof WorkerContext>()),
  runExport: vi.fn(async () => {
    order.push('build');
  }),
}));

vi.mock('../generators/meshImprint', async (importOriginal) => ({
  ...(await importOriginal<typeof MeshImprint>()),
  prepareMeshImprints: vi.fn(async () => undefined),
}));

import { ensureDesignFonts } from '../wasmInstantiator';
import { handleExport, handleExportCombined } from './exportHandler';
import { handleSplitExport } from './splitHandler';

const params = { ...DEFAULT_BIN_PARAMS, surfaceText: { floorText: 'HELLO' } };

describe('export handlers register the design fonts before building', () => {
  beforeEach(() => {
    order.length = 0;
    vi.clearAllMocks();
  });

  it.each([
    [
      'EXPORT',
      () =>
        handleExport({
          type: 'EXPORT',
          payload: { params, requestId: 'r', format: 'stl' },
        }),
    ],
    [
      'EXPORT_COMBINED',
      () =>
        handleExportCombined({
          type: 'EXPORT_COMBINED',
          payload: { params, requestId: 'r', format: 'stl' },
        } as unknown as ExportCombinedMessage),
    ],
    [
      'EXPORT_SPLIT',
      () =>
        handleSplitExport({
          type: 'EXPORT_SPLIT',
          payload: { params, requestId: 'r', format: 'stl', cutPlanesX: [], cutPlanesY: [] },
        } as unknown as ExportSplitMessage),
    ],
  ])('%s', async (_name, run) => {
    await run();
    expect(ensureDesignFonts).toHaveBeenCalledWith(params);
    expect(order).toEqual(['fonts', 'build']);
  });
});
