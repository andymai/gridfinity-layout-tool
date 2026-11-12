import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSplitBinExport } from './binDownloadHelpers';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_SPLIT_CONNECTOR_CONFIG,
} from '@/features/bin-designer/constants/defaults';

const poolExportSplitBin = vi.fn();
const bridgeExportSplitBin = vi.fn();
const releaseMock = vi.fn();

vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => ({ exportSplitBin: bridgeExportSplitBin }),
  getActiveKernel: () => 'occt-wasm',
  workerPoolManager: {
    acquire: () => Promise.resolve({ size: 2, exportSplitBin: poolExportSplitBin }),
    release: () => releaseMock(),
  },
}));

vi.mock('@/shared/analytics/posthog', () => ({ captureException: vi.fn() }));

function workerError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function run(): Promise<unknown> {
  return runSplitBinExport(DEFAULT_BIN_PARAMS, [168], [], 2, DEFAULT_SPLIT_CONNECTOR_CONFIG, 'stl');
}

describe('runSplitBinExport pool fallback', () => {
  beforeEach(() => {
    poolExportSplitBin.mockReset();
    bridgeExportSplitBin.mockReset().mockResolvedValue({ pieces: [] });
    releaseMock.mockReset();
  });

  it('does not rerun an export that ran out of memory on the single bridge', async () => {
    const oom = workerError(
      'OUT_OF_MEMORY',
      'Split export failed: Geometry kernel ran out of memory'
    );
    poolExportSplitBin.mockRejectedValue(oom);

    await expect(run()).rejects.toBe(oom);
    expect(poolExportSplitBin).toHaveBeenCalledTimes(1);
    expect(bridgeExportSplitBin).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('still falls back to the single bridge after a kernel crash', async () => {
    poolExportSplitBin.mockRejectedValue(
      workerError('KERNEL_CRASHED', 'Split export failed: Geometry kernel crashed')
    );

    await expect(run()).resolves.toEqual({ pieces: [] });
    expect(bridgeExportSplitBin).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
