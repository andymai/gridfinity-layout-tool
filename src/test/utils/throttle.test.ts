import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { throttleRAF, cancelThrottledRAF, throttle } from '../../shared/utils';

describe('throttleRAF', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    let rafId = 0;
    const rafCallbacks = new Map<number, FrameRequestCallback>();

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafId++;
      rafCallbacks.set(rafId, callback);
      return rafId;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });

    // Helper to flush RAF
    vi.stubGlobal('__flushRAF__', () => {
      const callbacks = Array.from(rafCallbacks.entries());
      rafCallbacks.clear();
      callbacks.forEach(([_, cb]) => cb(performance.now()));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls function on first invocation', () => {
    const fn = vi.fn();
    const throttled = throttleRAF(fn);

    throttled(1, 2, 3);

    // Should be called immediately on first invocation
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });

  it('throttles subsequent calls to next animation frame', () => {
    const fn = vi.fn();
    const throttled = throttleRAF(fn);

    throttled('a');
    throttled('b');
    throttled('c');

    // Only first call should execute immediately
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    // Flush RAF to execute pending call
    (globalThis as unknown as { __flushRAF__: () => void }).__flushRAF__();

    // Should have called with latest args ('c'), not 'b'
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('uses latest arguments when throttled', () => {
    const fn = vi.fn();
    const throttled = throttleRAF(fn);

    throttled(1);
    throttled(2);
    throttled(3);
    throttled(4);
    throttled(5);

    expect(fn).toHaveBeenCalledTimes(1);

    (globalThis as unknown as { __flushRAF__: () => void }).__flushRAF__();

    // Should use the latest args (5)
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(5);
  });

  it('allows new calls after RAF completes', () => {
    const fn = vi.fn();
    const throttled = throttleRAF(fn);

    // First batch
    throttled(1);
    throttled(2);
    (globalThis as unknown as { __flushRAF__: () => void }).__flushRAF__();

    expect(fn).toHaveBeenCalledTimes(2);

    // Second batch - should execute immediately since RAF completed
    throttled(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it('can be cancelled', () => {
    const fn = vi.fn();
    const throttled = throttleRAF(fn);

    throttled(1);
    throttled(2);

    expect(fn).toHaveBeenCalledTimes(1);

    // Cancel pending RAF
    cancelThrottledRAF(throttled);

    (globalThis as unknown as { __flushRAF__: () => void }).__flushRAF__();

    // Should not have called with '2'
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('maintains this context', () => {
    const obj = {
      value: 42,
      fn: vi.fn(function(this: { value: number }) {
        return this.value;
      }),
    };

    const throttled = throttleRAF(obj.fn);
    throttled.call(obj);

    expect(obj.fn).toHaveBeenCalledTimes(1);
    expect(obj.fn.mock.instances[0]).toBe(obj);
  });
});

describe('cancelThrottledRAF', () => {
  beforeEach(() => {
    let rafId = 0;
    const rafCallbacks = new Map<number, FrameRequestCallback>();

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafId++;
      rafCallbacks.set(rafId, callback);
      return rafId;
    });

    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      rafCallbacks.delete(id);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls cancelAnimationFrame with correct id', () => {
    const fn = vi.fn();
    const throttled = throttleRAF(fn);

    throttled(1);
    throttled(2); // This schedules a RAF

    cancelThrottledRAF(throttled);

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('is safe to call multiple times', () => {
    const fn = vi.fn();
    const throttled = throttleRAF(fn);

    throttled(1);

    // Should not throw when called multiple times
    expect(() => {
      cancelThrottledRAF(throttled);
      cancelThrottledRAF(throttled);
      cancelThrottledRAF(throttled);
    }).not.toThrow();
  });

  it('is safe to call on non-throttled function', () => {
    const fn = vi.fn();

    // Should not throw when called on regular function
    expect(() => {
      cancelThrottledRAF(fn);
    }).not.toThrow();
  });
});

describe('throttle (time-based)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls function immediately on first invocation', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('throttles subsequent calls within delay period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');
    throttled('b');
    throttled('c');

    // Only first call executes immediately
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    // Advance time past the delay
    vi.advanceTimersByTime(100);

    // Trailing call should execute with latest args
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('allows immediate call after delay period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for delay to pass
    vi.advanceTimersByTime(100);

    // Next call should be immediate
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('schedules trailing call with remaining delay time', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);

    // Call again after 30ms (70ms remaining in throttle period)
    vi.advanceTimersByTime(30);
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance 70ms to complete the throttle period
    vi.advanceTimersByTime(70);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('uses latest arguments for trailing call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(1);
    throttled(2);
    throttled(3);
    throttled(4);
    throttled(5);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(5);
  });

  it('maintains this context', () => {
    const obj = {
      value: 42,
      fn: vi.fn(function(this: { value: number }) {
        return this.value;
      }),
    };

    const throttled = throttle(obj.fn, 100);
    throttled.call(obj);

    expect(obj.fn).toHaveBeenCalledTimes(1);
    expect(obj.fn.mock.instances[0]).toBe(obj);
  });

  it('maintains this context for trailing calls', () => {
    const obj = {
      value: 42,
      fn: vi.fn(function(this: { value: number }) {
        return this.value;
      }),
    };

    const throttled = throttle(obj.fn, 100);
    throttled.call(obj, 'first');
    throttled.call(obj, 'second');

    vi.advanceTimersByTime(100);

    expect(obj.fn).toHaveBeenCalledTimes(2);
    // Both calls should have correct context
    expect(obj.fn.mock.instances[0]).toBe(obj);
    expect(obj.fn.mock.instances[1]).toBe(obj);
  });

  it('does not schedule duplicate trailing calls', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');
    throttled('b');
    throttled('c');
    throttled('d');

    expect(fn).toHaveBeenCalledTimes(1);

    // Only one trailing call should be scheduled
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('d');
  });
});
