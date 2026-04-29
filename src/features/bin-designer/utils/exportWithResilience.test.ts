import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportWithResilience } from './exportWithResilience';

const refreshMock = vi.fn();
const acquireMock = vi.fn().mockResolvedValue(undefined);
const releaseMock = vi.fn();

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: {
    refresh: () => refreshMock(),
    acquire: () => acquireMock(),
    release: () => releaseMock(),
  },
}));

describe('exportWithResilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
    acquireMock.mockReset().mockResolvedValue(undefined);
    releaseMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves on first try without retries or restarts', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    const result = await exportWithResilience(op);

    expect(op).toHaveBeenCalledTimes(1);
    expect(result.result).toBe('ok');
    expect(result.retryCount).toBe(0);
    expect(result.restartCount).toBe(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('retries twice on transient errors then succeeds', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('boolean failure'))
      .mockRejectedValueOnce(new Error('tessellation failure'))
      .mockResolvedValue('ok');

    const promise = exportWithResilience(op);
    // Run all timer-driven retries to completion.
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(op).toHaveBeenCalledTimes(3);
    expect(result.result).toBe('ok');
    expect(result.retryCount).toBe(2);
    expect(result.restartCount).toBe(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('refreshes the bridge after retry exhaustion and retries once more', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('boolean failure'))
      .mockRejectedValueOnce(new Error('boolean failure'))
      .mockRejectedValueOnce(new Error('boolean failure'))
      .mockResolvedValue('ok');

    const promise = exportWithResilience(op);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(op).toHaveBeenCalledTimes(4);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(acquireMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
    expect(result.retryCount).toBe(2);
    expect(result.restartCount).toBe(1);
  });

  it('re-acquires the bridge after refresh so the fresh worker initializes before the final attempt', async () => {
    // Regression test for the Phase-2 bug where refresh() nulled the bridge
    // and the immediate next operation() saw getActiveBridge() === null.
    const callOrder: string[] = [];
    refreshMock.mockImplementation(() => callOrder.push('refresh'));
    acquireMock.mockImplementation(() => {
      callOrder.push('acquire');
      return Promise.resolve();
    });
    releaseMock.mockImplementation(() => callOrder.push('release'));

    const op = vi
      .fn()
      .mockImplementation(() => {
        callOrder.push('op');
        return Promise.reject(new Error('boolean failure'));
      })
      .mockImplementationOnce(() => {
        callOrder.push('op');
        return Promise.reject(new Error('boolean failure'));
      })
      .mockImplementationOnce(() => {
        callOrder.push('op');
        return Promise.reject(new Error('boolean failure'));
      })
      .mockImplementationOnce(() => {
        callOrder.push('op');
        return Promise.reject(new Error('boolean failure'));
      })
      .mockImplementationOnce(() => {
        callOrder.push('op');
        return Promise.resolve('ok');
      });

    const promise = exportWithResilience(op);
    await vi.runAllTimersAsync();
    const result = await promise;

    // Acquire MUST come between refresh and the final op so the fresh bridge
    // is initialized before the operation runs. Release fires after the op
    // settles regardless of outcome.
    expect(callOrder).toEqual(['op', 'op', 'op', 'refresh', 'acquire', 'op', 'release']);
    expect(result.result).toBe('ok');
    expect(result.restartCount).toBe(1);
  });

  it('releases the bridge even if the final attempt also fails', async () => {
    const op = vi.fn().mockRejectedValue(new Error('persistent boolean failure'));

    const promise = exportWithResilience(op).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    await promise;

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(acquireMock).toHaveBeenCalledTimes(1);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('rejects with the final error after refresh fails again', async () => {
    const op = vi.fn().mockRejectedValue(new Error('persistent boolean failure'));

    const promise = exportWithResilience(op);
    // Vitest doesn't suppress unhandled rejections inside fake timers; attach
    // a no-op catch handler before running timers so the rejection is observed.
    const settled = promise.catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const settledResult = await settled;

    expect(op).toHaveBeenCalledTimes(4);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(settledResult).toBeInstanceOf(Error);
    expect((settledResult as Error).message).toContain('persistent boolean failure');
  });

  it('surfaces non-retryable errors immediately without restarting', async () => {
    const op = vi.fn().mockRejectedValue(new Error('Invalid param: width <= 0'));

    await expect(exportWithResilience(op)).rejects.toThrow('Invalid param');
    expect(op).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('honors a custom isRetryable predicate', async () => {
    const stop = new Error('halt');
    const op = vi.fn().mockRejectedValue(stop);

    await expect(exportWithResilience(op, { isRetryable: () => false })).rejects.toBe(stop);
    expect(op).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
