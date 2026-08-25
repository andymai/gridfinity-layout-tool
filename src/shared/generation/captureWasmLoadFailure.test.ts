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

  it('captures with surface, kernel, stale_asset=true, and a stable fingerprint for cache failures', () => {
    const err = new Error('Worker failed to initialize: script failed to load');
    captureWasmLoadFailure(err, 'bin_designer_preview');

    expect(captureException).toHaveBeenCalledWith(err, {
      surface: 'bin_designer_preview',
      kernel: 'occt-wasm',
      stale_asset: true,
      // Collapses every deploy's stale-bundle failure into one issue.
      $exception_fingerprint: 'wasm-load-stale-asset',
    });
  });

  it('flags genuine (non-stale) load errors with stale_asset=false and no pinned fingerprint', () => {
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
    // Drops the wasm cache: this caller is here because a wasm artifact failed,
    // so it is the suspect rather than a bystander.
    expect(recoverStaleBundle).toHaveBeenCalledWith('wasm_load_failure:bin_designer_preview', {
      dropWasmCache: true,
    });
  });

  it('captures but does not recover on a genuine (non-stale) error', () => {
    handleWasmLoadFailure(new Error('out of memory'), 'baseplate_preview');

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });
});
