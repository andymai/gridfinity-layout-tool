/**
 * Every handler that builds text for export must register its fonts first. Text
 * geometry skips a missing face with no error, and an export can land on a
 * worker that never previewed the design.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { ExportCombinedMessage, ExportSplitMessage } from '../../bridge/types';
import type * as WorkerContext from './workerContext';
import type * as MeshImprint from '../generators/meshImprint';

const order: string[] = [];

vi.mock('../wasmInstantiator', () => {
  const load = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 5));
    order.push('fonts');
  };
  return { ensureDesignFonts: vi.fn(load), ensureFontsLoaded: vi.fn(load) };
});

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

import { ensureDesignFonts, ensureFontsLoaded } from '../wasmInstantiator';
import {
  handleExport,
  handleExportCombined,
  handleExportFitTest,
  handleExportLabelPlates,
} from './exportHandler';
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
    [
      'EXPORT_FIT_TEST',
      () =>
        handleExportFitTest({
          type: 'EXPORT_FIT_TEST',
          payload: { params, requestId: 'r', format: 'stl' },
        }),
    ],
  ])('%s', async (_name, run) => {
    await run();
    expect(ensureDesignFonts).toHaveBeenCalledWith(params);
    expect(order).toEqual(['fonts', 'build']);
  });

  it('EXPORT_LABEL_PLATES loads the face the plates are written in', async () => {
    await handleExportLabelPlates({
      type: 'EXPORT_LABEL_PLATES',
      payload: {
        plates: [{ widthU: 1, text: 'M4X25' }],
        options: {
          textMode: 'deboss',
          textDepthMm: 0.4,
          textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, font: 'poppins' },
          v1Channels: true,
        },
        requestId: 'r',
        format: 'stl',
      },
    });
    expect(ensureFontsLoaded).toHaveBeenCalledWith(['poppins']);
    expect(order).toEqual(['fonts', 'build']);
  });
});
