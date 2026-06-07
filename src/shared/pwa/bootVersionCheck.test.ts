// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkBootVersionFreshness } from './bootVersionCheck';

const { recoverStaleBundle, isSmokeMode } = vi.hoisted(() => ({
  recoverStaleBundle: vi.fn(),
  isSmokeMode: vi.fn(() => false),
}));
vi.mock('./staleRecovery', () => ({ recoverStaleBundle }));
vi.mock('@/shared/utils/smokeMode', () => ({ isSmokeMode }));

// vitest.config defines __GIT_SHA__ === 'test-sha' as the running bundle's SHA.
function mockVersionFetch(payload: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(payload),
    })
  );
}

beforeEach(() => {
  recoverStaleBundle.mockClear();
  isSmokeMode.mockReturnValue(false);
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkBootVersionFreshness', () => {
  it('recovers when the deployed gitSha differs from the running bundle', async () => {
    mockVersionFetch({ version: '9.9.9', gitSha: 'newer-sha', buildTime: 'x' });
    await checkBootVersionFreshness();
    expect(recoverStaleBundle).toHaveBeenCalledWith('boot_version_mismatch');
  });

  it('does nothing when the deployed gitSha matches', async () => {
    mockVersionFetch({ version: '0.0.0-test', gitSha: 'test-sha', buildTime: 'x' });
    await checkBootVersionFreshness();
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });

  it('no-ops in smoke mode (never reload inside the gate iframe)', async () => {
    isSmokeMode.mockReturnValue(true);
    mockVersionFetch({ version: '9.9.9', gitSha: 'newer-sha', buildTime: 'x' });
    await checkBootVersionFreshness();
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });

  it('no-ops when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    mockVersionFetch({ version: '9.9.9', gitSha: 'newer-sha', buildTime: 'x' });
    await checkBootVersionFreshness();
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });

  it('no-ops when version.json is unreachable (dev / network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('404')));
    await checkBootVersionFreshness();
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });

  it('no-ops on a non-200 version.json response', async () => {
    mockVersionFetch({ version: '9.9.9', gitSha: 'newer-sha', buildTime: 'x' }, false);
    await checkBootVersionFreshness();
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });

  it('no-ops when the deployed gitSha is unknown', async () => {
    mockVersionFetch({ version: '9.9.9', gitSha: 'unknown', buildTime: 'x' });
    await checkBootVersionFreshness();
    expect(recoverStaleBundle).not.toHaveBeenCalled();
  });
});
