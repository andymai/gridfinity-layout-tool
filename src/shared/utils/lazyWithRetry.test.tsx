import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { recoverStaleBundle } from '@/shared/pwa/staleRecovery';
import { render, screen, waitFor } from '@testing-library/react';
import { Suspense, Component, type ReactNode, type ComponentType } from 'react';

vi.mock('@/shared/pwa/staleRecovery', () => ({ recoverStaleBundle: vi.fn() }));
const mockRecover = vi.mocked(recoverStaleBundle);

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
  beforeEach(() => {
    sessionStorage.clear();
    // Mock console.warn to prevent noise
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Default: recovery is available and takes over (the page is reloading).
    mockRecover.mockReset();
    mockRecover.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    it('accepts recoverOnFinalFailure option', () => {
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

  describe('final failure with recovery', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('recovers the stale bundle when all retries are exhausted', async () => {
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
        expect(mockRecover).toHaveBeenCalledWith('chunk_load_failure');
      });
    });

    it('does not drop the wasm cache, which a chunk miss does not implicate', async () => {
      const importFn = vi.fn().mockRejectedValue(new Error('Chunk permanently unavailable'));

      const LazyComponent = lazyWithRetry(importFn, 0, true);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        expect(mockRecover).toHaveBeenCalled();
      });
      expect(mockRecover.mock.calls[0]?.[1]?.dropWasmCache).toBeUndefined();
    });

    it('stays suspended while the recovery reload takes over', async () => {
      const importFn = vi.fn().mockRejectedValue(new Error('Chunk permanently unavailable'));

      const LazyComponent = lazyWithRetry(importFn, 0, true);

      render(
        <ErrorBoundary fallback={<div data-testid="error">Error occurred</div>}>
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            <LazyComponent />
          </Suspense>
        </ErrorBoundary>
      );

      await vi.advanceTimersByTimeAsync(100);

      await waitFor(() => {
        expect(mockRecover).toHaveBeenCalled();
      });
      // Never surfaces an error boundary: the page is on its way to reloading.
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('throws when recovery declines, so the boundary can report it', async () => {
      // Declined because one already ran this tab session, or the client is offline.
      mockRecover.mockResolvedValue(false);
      const importFn = vi.fn().mockRejectedValue(new Error('Still failing'));

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
    });
  });

  describe('final failure without recovery', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('throws error when recoverOnFinalFailure is false', async () => {
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

      expect(mockRecover).not.toHaveBeenCalled();
    });
  });
});

describe('namedExport', () => {
  it('extracts named export as default', () => {
    const module = {
      ComponentA: MockComponent,
      ComponentB: () => null,
    };

    const result = namedExport('ComponentA')(module);

    expect(result).toEqual({ default: MockComponent });
  });

  it('works with different component names', () => {
    const AnotherComponent: ComponentType = () => null;
    const module = {
      AnotherComponent,
    };

    const result = namedExport('AnotherComponent')(module);

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
