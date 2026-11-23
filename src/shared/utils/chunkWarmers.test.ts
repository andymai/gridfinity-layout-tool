import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetChunkWarmersForTests, registerChunkWarmers, warmChunk } from './chunkWarmers';
import { prefetchOnIntent } from '@/shared/hooks/useIntentPrefetch';

afterEach(() => __resetChunkWarmersForTests());

function warmers() {
  return {
    designer: vi.fn(() => Promise.resolve('designer chunk')),
    baseplate: vi.fn(() => Promise.resolve('baseplate chunk')),
    designGallery: vi.fn(() => Promise.resolve('gallery chunk')),
  };
}

describe('warmChunk', () => {
  it('starts only the registered import for the destination', async () => {
    const registered = warmers();
    registerChunkWarmers(registered);

    await expect(warmChunk('baseplate')).resolves.toBe('baseplate chunk');
    expect(registered.baseplate).toHaveBeenCalledTimes(1);
    expect(registered.designer).not.toHaveBeenCalled();
    expect(registered.designGallery).not.toHaveBeenCalled();
  });

  it('throws before the shell registers', () => {
    expect(() => warmChunk('designer')).toThrow(/No chunk warmers registered/);
  });

  it('leaves an intent free to retry when it came before registration', () => {
    prefetchOnIntent('test:early-designer', () => warmChunk('designer'));

    const registered = warmers();
    registerChunkWarmers(registered);
    prefetchOnIntent('test:early-designer', () => warmChunk('designer'));

    expect(registered.designer).toHaveBeenCalledTimes(1);
  });

  it('leaves an intent free to retry after a failed fetch', async () => {
    const registered = warmers();
    registered.designGallery.mockRejectedValueOnce(new Error('offline'));
    registerChunkWarmers(registered);

    prefetchOnIntent('test:gallery', () => warmChunk('designGallery'));
    await Promise.resolve();
    await Promise.resolve();
    prefetchOnIntent('test:gallery', () => warmChunk('designGallery'));

    expect(registered.designGallery).toHaveBeenCalledTimes(2);
  });
});
