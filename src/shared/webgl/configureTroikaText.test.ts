import { describe, expect, it, vi } from 'vitest';

describe('configureTroikaText', () => {
  it('disables the troika-three-text worker on import', async () => {
    const configureTextBuilder = vi.fn();
    vi.doMock('troika-three-text', () => ({ configureTextBuilder }));
    vi.resetModules();

    await import('./configureTroikaText');

    expect(configureTextBuilder).toHaveBeenCalledWith({ useWorker: false });

    vi.doUnmock('troika-three-text');
  });
});
