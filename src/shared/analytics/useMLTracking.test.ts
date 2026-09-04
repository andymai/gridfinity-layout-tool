import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ factoryRuns: 0 }));

// Simulate a stale bundle: the lazy chunk's hash no longer exists, so every
// import attempt rejects.
vi.mock('./mlTelemetry', () => {
  state.factoryRuns += 1;
  throw new TypeError('Failed to fetch dynamically imported module: ./mlTelemetry');
});

import { getMlTelemetry, mlTracking } from './useMLTracking';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('getMlTelemetry on a self-hosted build', () => {
  it('resolves null without ever importing the module', async () => {
    vi.stubEnv('VITE_SELF_HOSTED', '1');
    vi.resetModules();
    const runsBefore = state.factoryRuns;
    const { getMlTelemetry: fresh } = await import('./useMLTracking');
    await expect(fresh()).resolves.toBeNull();
    expect(state.factoryRuns).toBe(runsBefore);
  });
});

describe('getMlTelemetry', () => {
  it('resolves null on a failed load and latches off instead of retrying', async () => {
    await expect(getMlTelemetry()).resolves.toBeNull();
    await expect(getMlTelemetry()).resolves.toBeNull();
    expect(state.factoryRuns).toBe(1);
  });

  it('tracking calls no-op quietly once the module is unavailable', async () => {
    expect(() => {
      mlTracking.recordAction();
    }).not.toThrow();
    // Flush the fire-and-forget chain; a leaked rejection would fail the run.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(state.factoryRuns).toBe(1);
  });
});
