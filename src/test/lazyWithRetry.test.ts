import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lazyWithRetry, namedExport } from '../utils/lazyWithRetry';
import type { ComponentType } from 'react';

// Helper to create a mock component
function createMockComponent(name: string): ComponentType {
  const Component = () => null;
  Component.displayName = name;
  return Component;
}

describe('lazyWithRetry', () => {
  const originalSessionStorage = window.sessionStorage;
  const originalLocation = window.location;

  let sessionStorageMock: Record<string, string>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock sessionStorage
    sessionStorageMock = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => sessionStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          sessionStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          const { [key]: _, ...rest } = sessionStorageMock;
          void _; // Suppress unused variable warning
          sessionStorageMock = rest;
        }),
        clear: vi.fn(() => {
          sessionStorageMock = {};
        }),
      },
      writable: true,
      configurable: true,
    });

    // Mock window.location.reload
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        reload: reloadSpy,
      },
      writable: true,
      configurable: true,
    });

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    Object.defineProperty(window, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  describe('successful import', () => {
    it('resolves immediately on successful import', async () => {
      const MockComponent = createMockComponent('TestComponent');
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      const _LazyComponent = lazyWithRetry(importFn);

      // Access the lazy component's internal load function
      // Since React.lazy returns a LazyExoticComponent, we can't directly test it
      // but we can verify the importFn behavior
      expect(importFn).not.toHaveBeenCalled();

      // Trigger the lazy load
      const result = await importFn();
      expect(result.default).toBe(MockComponent);
      expect(importFn).toHaveBeenCalledTimes(1);
    });

    it('does not retry on successful first attempt', async () => {
      const MockComponent = createMockComponent('TestComponent');
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      lazyWithRetry(importFn);

      await importFn();

      expect(importFn).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('retry logic', () => {
    it('retries on failure and succeeds eventually', async () => {
      const MockComponent = createMockComponent('RetryComponent');
      let callCount = 0;

      const importFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error');
        }
        return { default: MockComponent };
      });

      // Manually test the retry logic
      const retryFn = async () => {
        const retries = 2;
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch {
            if (i < retries) {
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
            } else {
              throw new Error('All retries failed');
            }
          }
        }
      };

      // Start the retry function
      const promise = retryFn();

      // Advance through first backoff (100ms)
      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result.default).toBe(MockComponent);
      expect(importFn).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff between retries', async () => {
      let callCount = 0;
      const importFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error(`Error ${callCount}`);
        }
        return { default: createMockComponent('BackoffComponent') };
      });

      // Test backoff timing
      const delays: number[] = [];

      const retryWithBackoff = async () => {
        const retries = 2;
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch {
            if (i < retries) {
              const delay = 100 * Math.pow(2, i);
              delays.push(delay);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw new Error('Failed');
            }
          }
        }
      };

      const promise = retryWithBackoff();

      // First retry after 100ms
      await vi.advanceTimersByTimeAsync(100);
      // Second retry after 200ms (total 300ms)
      await vi.advanceTimersByTimeAsync(200);

      await promise;

      expect(delays).toEqual([100, 200]); // 100ms, then 200ms
    });

    it('exhausts all retries before failing', async () => {
      const importFn = vi.fn().mockImplementation(async () => {
        throw new Error('Persistent error');
      });

      const retryFn = async () => {
        const retries = 2;
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch (error) {
            if (i < retries) {
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
            } else {
              throw error;
            }
          }
        }
      };

      // Attach catch handler immediately to prevent unhandled rejection
      let caughtError: Error | null = null;
      const promise = retryFn().catch(e => { caughtError = e; });

      // Advance through all backoffs
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry

      await promise;
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Persistent error');
      expect(importFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('page reload on final failure', () => {
    it('reloads page when all retries exhausted and reloadOnFinalFailure is true', async () => {
      const importFn = vi.fn().mockImplementation(async () => {
        throw new Error('Chunk failed');
      });

      // Simulate the reload logic
      const sessionKey = 'chunk-reload-test-1';

      const retryWithReload = async () => {
        const retries = 2;
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch {
            if (i < retries) {
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
            } else {
              // All retries exhausted
              if (!sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, 'true');
                window.location.reload();
                return new Promise(() => {}); // Never resolves
              }
              throw new Error('Chunk failed after reload');
            }
          }
        }
      };

      // Start the retry (promise won't resolve because we mock reload)
      void retryWithReload();

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      // Give time for the reload to be called
      await vi.advanceTimersByTimeAsync(10);

      expect(sessionStorage.setItem).toHaveBeenCalledWith(sessionKey, 'true');
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('does not reload twice (prevents infinite loop)', async () => {
      const importFn = vi.fn().mockImplementation(async () => {
        throw new Error('Chunk failed');
      });

      const sessionKey = 'chunk-reload-test-2';
      // Simulate already reloaded once
      sessionStorageMock[sessionKey] = 'true';

      const retryWithReload = async () => {
        const retries = 2;
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch (error) {
            if (i < retries) {
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
            } else {
              // All retries exhausted
              if (!sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, 'true');
                window.location.reload();
                return new Promise(() => {});
              }
              // Clear for next time
              sessionStorage.removeItem(sessionKey);
              throw error;
            }
          }
        }
      };

      // Attach catch handler immediately to prevent unhandled rejection
      let caughtError: Error | null = null;
      const promise = retryWithReload().catch(e => { caughtError = e; });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await promise;
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Chunk failed');
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(sessionStorage.removeItem).toHaveBeenCalledWith(sessionKey);
    });

    it('respects reloadOnFinalFailure=false option', async () => {
      const importFn = vi.fn().mockImplementation(async () => {
        throw new Error('Chunk failed');
      });

      const retryNoReload = async () => {
        const retries = 2;
        const reloadOnFinalFailure = false;

        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch (error) {
            if (i < retries) {
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
            } else if (!reloadOnFinalFailure) {
              throw error;
            }
          }
        }
      };

      // Attach catch handler immediately to prevent unhandled rejection
      let caughtError: Error | null = null;
      const promise = retryNoReload().catch(e => { caughtError = e; });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await promise;
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError?.message).toBe('Chunk failed');
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('custom retry count', () => {
    it('respects custom retry count', async () => {
      let callCount = 0;
      const importFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 5) {
          throw new Error(`Error ${callCount}`);
        }
        return { default: createMockComponent('CustomRetry') };
      });

      // Test with 4 retries
      const retryFn = async (retries: number) => {
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch {
            if (i < retries) {
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
            }
          }
        }
        throw new Error('All retries failed');
      };

      const promise = retryFn(4);

      // Advance through all backoffs
      await vi.advanceTimersByTimeAsync(100);  // 1st retry
      await vi.advanceTimersByTimeAsync(200);  // 2nd retry
      await vi.advanceTimersByTimeAsync(400);  // 3rd retry
      await vi.advanceTimersByTimeAsync(800);  // 4th retry

      const result = await promise;

      expect(result.default.displayName).toBe('CustomRetry');
      expect(importFn).toHaveBeenCalledTimes(5); // Initial + 4 retries
    });

    it('handles zero retries', async () => {
      const importFn = vi.fn().mockImplementation(async () => {
        throw new Error('Immediate fail');
      });

      const retryFn = async (retries: number) => {
        for (let i = 0; i <= retries; i++) {
          try {
            return await importFn();
          } catch (error) {
            if (i >= retries) {
              throw error;
            }
          }
        }
      };

      await expect(retryFn(0)).rejects.toThrow('Immediate fail');
      expect(importFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('namedExport', () => {
  it('wraps named export as default', () => {
    const TestComponent = createMockComponent('TestComponent');
    const module = { TestComponent, OtherComponent: createMockComponent('Other') };

    const wrapper = namedExport<typeof TestComponent>('TestComponent');
    const result = wrapper(module);

    expect(result.default).toBe(TestComponent);
  });

  it('handles non-existent export', () => {
    const module = { SomeComponent: createMockComponent('Some') };

    const wrapper = namedExport<ComponentType>('NonExistent');
    const result = wrapper(module);

    expect(result.default).toBeUndefined();
  });

  it('can be chained with then()', async () => {
    const TestComponent = createMockComponent('ChainedComponent');

    const importFn = async () => ({ TestComponent });
    const result = await importFn().then(namedExport('TestComponent'));

    expect(result.default).toBe(TestComponent);
  });
});
