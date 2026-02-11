import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazyWithRetry, namedExport } from '@/utils/lazyWithRetry';
import { render, screen, waitFor } from '@testing-library/react';
import { Suspense, Component, type ReactNode, type ComponentType } from 'react';

// Mock component for testing
const MockComponent: ComponentType = () => <div data-testid="mock-component">Loaded</div>;
MockComponent.displayName = 'MockComponent';

// Error boundary for catching lazy load errors
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

describe('lazyWithRetry', () => {
  let originalLocation: Location;
  let mockReload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    // Mock console.warn to prevent noise
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Save and mock window.location
    originalLocation = window.location;
    mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, { reload: mockReload }),
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('API contract', () => {
    it('returns a lazy component', () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });
      const LazyComponent = lazyWithRetry(importFn);

      // React.lazy returns an object with $$typeof for lazy components
      expect(LazyComponent).toBeDefined();
      expect(typeof LazyComponent).toBe('object');
      // Check it has the React lazy type symbol
      expect((LazyComponent as { $$typeof?: symbol }).$$typeof).toBeDefined();
    });

    it('accepts custom retry count', () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      // Should not throw with custom retry count
      expect(() => lazyWithRetry(importFn, 5)).not.toThrow();
      expect(() => lazyWithRetry(importFn, 0)).not.toThrow();
    });

    it('accepts reloadOnFinalFailure option', () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      // Should not throw with either option
      expect(() => lazyWithRetry(importFn, 2, true)).not.toThrow();
      expect(() => lazyWithRetry(importFn, 2, false)).not.toThrow();
    });
  });

  describe('successful import', () => {
    it('loads component on first attempt', async () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });
      const LazyComponent = lazyWithRetry(importFn);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      expect(importFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries on failure and succeeds', async () => {
      const importFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Chunk load failed'))
        .mockResolvedValueOnce({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn, 2);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      // Advance past the first retry backoff (100ms * 2^0 = 100ms)
      await vi.advanceTimersByTimeAsync(200);

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      // Should have retried
      expect(importFn).toHaveBeenCalledTimes(2);
    });

    it('retries multiple times before succeeding', async () => {
      const importFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValueOnce({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn, 2);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      // Advance past both retry backoffs (100ms + 200ms)
      await vi.advanceTimersByTimeAsync(400);

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      // 3 attempts: initial + 2 retries
      expect(importFn).toHaveBeenCalledTimes(3);
    });

    it('logs warning on each failed attempt', async () => {
      const importFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn, 2);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      // Advance past the first retry backoff
      await vi.advanceTimersByTimeAsync(200);

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Dynamic import failed \(attempt 1\/3\)/),
        expect.any(Error)
      );
    });
  });

  describe('final failure with reload', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reloads page when all retries exhausted', async () => {
      const importFn = vi.fn().mockRejectedValue(new Error('Chunk permanently unavailable'));

      const LazyComponent = lazyWithRetry(importFn, 1, true);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      // Advance past the retry backoff (100ms * 2^0 = 100ms)
      await vi.advanceTimersByTimeAsync(200);

      await waitFor(() => {
        // Should have tried initial + 1 retry = 2 attempts
        expect(importFn).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(mockReload).toHaveBeenCalled();
      });
    });

    it('sets sessionStorage flag before reload', async () => {
      const importFn = vi.fn().mockRejectedValue(new Error('Chunk permanently unavailable'));

      const LazyComponent = lazyWithRetry(importFn, 0, true);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        expect(mockReload).toHaveBeenCalled();
      });

      // Check that session flag was set
      const keys = Object.keys(sessionStorage);
      const chunkReloadKey = keys.find((k) => k.startsWith('chunk-reload-'));
      expect(chunkReloadKey).toBeDefined();
      expect(sessionStorage.getItem(chunkReloadKey!)).toBe('true');
    });

    it('does not reload if already reloaded (prevents infinite loop)', async () => {
      const importFn = vi.fn().mockRejectedValue(new Error('Still failing'));

      // Pre-set the session key to simulate previous reload
      const sessionKey = `chunk-reload-${importFn.toString().slice(0, 100)}`;
      sessionStorage.setItem(sessionKey, 'true');

      const LazyComponent = lazyWithRetry(importFn, 0, true);

      render(
        <ErrorBoundary fallback={<div data-testid="error">Error occurred</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </Suspense>
        </ErrorBoundary>
      );

      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      // Should NOT reload since session flag exists
      expect(mockReload).not.toHaveBeenCalled();
    });

    it('clears session flag when throwing instead of reloading', async () => {
      const importFn = vi.fn().mockRejectedValue(new Error('Failing'));

      const sessionKey = `chunk-reload-${importFn.toString().slice(0, 100)}`;
      sessionStorage.setItem(sessionKey, 'true');

      const LazyComponent = lazyWithRetry(importFn, 0, true);

      render(
        <ErrorBoundary fallback={<div data-testid="error">Error</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </Suspense>
        </ErrorBoundary>
      );

      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      // Session flag should be cleared for next time
      expect(sessionStorage.getItem(sessionKey)).toBeNull();
    });
  });

  describe('final failure without reload', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('throws error when reloadOnFinalFailure is false', async () => {
      const importFn = vi.fn().mockRejectedValue(new Error('Chunk unavailable'));

      const LazyComponent = lazyWithRetry(importFn, 0, false);

      render(
        <ErrorBoundary fallback={<div data-testid="error">Error occurred</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </Suspense>
        </ErrorBoundary>
      );

      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      // Reload should not have been called
      expect(mockReload).not.toHaveBeenCalled();
    });
  });
});

describe('namedExport', () => {
  it('extracts named export as default', () => {
    const module = {
      ComponentA: MockComponent,
      ComponentB: () => null,
    };

    const result = namedExport<typeof MockComponent>('ComponentA')(module);

    expect(result).toEqual({ default: MockComponent });
  });

  it('works with different component names', () => {
    const AnotherComponent: ComponentType = () => null;
    const module = {
      AnotherComponent,
    };

    const result = namedExport<typeof AnotherComponent>('AnotherComponent')(module);

    expect(result.default).toBe(AnotherComponent);
  });

  it('returns undefined for non-existent export', () => {
    const module = {
      ExistingComponent: MockComponent,
    };

    const result = namedExport('NonExistent')(module);

    expect(result.default).toBeUndefined();
  });

  it('can be chained with import().then()', async () => {
    // Simulate the actual usage pattern
    const mockImport = Promise.resolve({
      HelpModal: MockComponent,
      OtherComponent: () => null,
    });

    const result = await mockImport.then(namedExport('HelpModal'));

    expect(result.default).toBe(MockComponent);
  });
});
