import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@/shared/analytics/posthog', () => ({ captureException }));
vi.mock('@/shared/generation/bridge', () => ({ getActiveKernel: () => 'occt-wasm' }));

import { captureWasmLoadFailure } from './captureWasmLoadFailure';

describe('captureWasmLoadFailure', () => {
  beforeEach(() => captureException.mockClear());

  it('captures with surface, kernel, and a stale_asset=true flag for cache failures', () => {
    const err = new Error('Worker failed to initialize: script failed to load');
    captureWasmLoadFailure(err, 'bin_designer_preview');

    expect(captureException).toHaveBeenCalledWith(err, {
      surface: 'bin_designer_preview',
      kernel: 'occt-wasm',
      stale_asset: true,
    });
  });

  it('flags genuine (non-stale) load errors with stale_asset=false', () => {
    captureWasmLoadFailure(new Error('out of memory'), 'baseplate_preview');

    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'baseplate_preview',
      kernel: 'occt-wasm',
      stale_asset: false,
    });
  });

  it('wraps non-Error throwables', () => {
    captureWasmLoadFailure('boom', 'bin_designer_preview');

    const [arg] = captureException.mock.calls[0];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe('boom');
  });
});
