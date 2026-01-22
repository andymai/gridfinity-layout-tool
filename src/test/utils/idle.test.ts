import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils';

describe('scheduleIdleCallback', () => {
  const originalRIC = globalThis.requestIdleCallback;
  const originalCIC = globalThis.cancelIdleCallback;

  afterEach(() => {
    // Restore original functions
    if (originalRIC) {
      globalThis.requestIdleCallback = originalRIC;
    } else {
      delete (globalThis as Record<string, unknown>).requestIdleCallback;
    }
    if (originalCIC) {
      globalThis.cancelIdleCallback = originalCIC;
    } else {
      delete (globalThis as Record<string, unknown>).cancelIdleCallback;
    }
    vi.useRealTimers();
  });

  describe('with native requestIdleCallback', () => {
    beforeEach(() => {
      // Mock requestIdleCallback
      const mockRIC = vi.fn((callback: IdleRequestCallback, options?: IdleRequestOptions) => {
        const id = setTimeout(() => {
          callback({
            didTimeout: false,
            timeRemaining: () => 50,
          });
        }, options?.timeout ?? 0);
        return id as unknown as number;
      });

      const mockCIC = vi.fn((id: number) => {
        clearTimeout(id);
      });

      globalThis.requestIdleCallback = mockRIC;
      globalThis.cancelIdleCallback = mockCIC;
    });

    it('calls requestIdleCallback when available', () => {
      const callback = vi.fn();
      scheduleIdleCallback(callback);

      expect(requestIdleCallback).toHaveBeenCalled();
    });

    it('passes options to requestIdleCallback', () => {
      const callback = vi.fn();
      scheduleIdleCallback(callback, { timeout: 500 });

      expect(requestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 500 });
    });

    it('returns a handle that can be cancelled', () => {
      const callback = vi.fn();
      const handle = scheduleIdleCallback(callback);

      cancelIdleCallback(handle);

      // Verify the global cancelIdleCallback was called
      expect(globalThis.cancelIdleCallback).toHaveBeenCalledWith(handle);
    });
  });

  describe('fallback without requestIdleCallback', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Remove requestIdleCallback to test fallback
      delete (globalThis as Record<string, unknown>).requestIdleCallback;
      delete (globalThis as Record<string, unknown>).cancelIdleCallback;
    });

    it('falls back to setTimeout when requestIdleCallback is not available', () => {
      const callback = vi.fn();
      scheduleIdleCallback(callback);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('uses provided timeout in fallback', () => {
      const callback = vi.fn();
      scheduleIdleCallback(callback, { timeout: 100 });

      vi.advanceTimersByTime(50);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('provides deadline object in fallback', () => {
      const callback = vi.fn();
      scheduleIdleCallback(callback);

      vi.advanceTimersByTime(50);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          didTimeout: true,
          timeRemaining: expect.any(Function),
        })
      );

      // timeRemaining should return 0 in fallback
      const deadline = callback.mock.calls[0][0];
      expect(deadline.timeRemaining()).toBe(0);
    });

    it('can be cancelled in fallback', () => {
      const callback = vi.fn();
      const handle = scheduleIdleCallback(callback);

      cancelIdleCallback(handle);

      vi.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

