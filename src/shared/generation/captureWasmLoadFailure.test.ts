import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureException, recoverStaleBundle } = vi.hoisted(() => ({
  captureException: vi.fn(),
  recoverStaleBundle: vi.fn(),
}));
vi.mock('@/shared/analytics/posthog', () => ({ captureException }));
vi.mock('@/shared/generation/bridge', () => ({ getActiveKernel: () => 'occt-wasm' }));
vi.mock('@/shared/pwa/staleRecovery', () => ({ recoverStaleBundle }));

import { captureWasmLoadFailure, handleWasmLoadFailure } from './captureWasmLoadFailure';

describe('captureWasmLoadFailure', () => {
  beforeEach(() => {
    captureException.mockClear();
    recoverStaleBundle.mockClear();
  });

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

describe('handleWasmLoadFailure', () => {
  beforeEach(() => {
    captureException.mockClear();
    recoverStaleBundle.mockClear();
  });

  it('captures and self-heals on a stale-bundle error', () => {
    handleWasmLoadFailure(
      new Error('CompileError: relaxed simd instructions not supported'),
      'bin_designer_preview'
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(recoverStaleBundle).toHaveBeenCalledWith('wasm_load_failure:bin_designer_preview');
  });

  it('captures but does not recover on a genuine (non-stale) error', () => {
    handleWasmLoadFailure(new Error('out of memory'), 'baseplate_preview');

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });
});
