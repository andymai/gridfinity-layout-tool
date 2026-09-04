// @vitest-environment node
/**
 * `exportBin` retries a failed attempt once on a fresh solid. A WASM trap is
 * the one failure that retry cannot help: the instance is corrupted, so the
 * second attempt would rerun the whole pipeline on it. No kernel is loaded
 * here on purpose; the generator is mocked so the retry policy is the only
 * thing under test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

const generateBinMock = vi.fn();

vi.mock('./binOrchestrator', () => ({
  generateBin: (...args: unknown[]) => generateBinMock(...args),
}));

vi.mock('./meshImprint', () => ({
  hasMeshImprints: () => false,
  prepareMeshImprints: vi.fn(),
}));

const { exportBin } = await import('./binExporter');
const { clearAllCaches } = await import('./shapeCache');

describe('exportBin retry policy', () => {
  beforeEach(() => {
    clearAllCaches();
    generateBinMock.mockReset();
  });

  it('does not regenerate after a WASM trap', async () => {
    generateBinMock.mockImplementation(() => {
      throw new WebAssembly.RuntimeError('memory access out of bounds');
    });

    await expect(exportBin(DEFAULT_BIN_PARAMS, 'stl')).rejects.toThrow(
      'memory access out of bounds'
    );
    expect(generateBinMock).toHaveBeenCalledTimes(1);
  });

  it('still regenerates once after an ordinary kernel failure', async () => {
    generateBinMock.mockImplementation(() => {
      throw new Error('BRep boolean operation failed');
    });

    await expect(exportBin(DEFAULT_BIN_PARAMS, 'stl')).rejects.toThrow('boolean');
    expect(generateBinMock).toHaveBeenCalledTimes(2);
  });
});
