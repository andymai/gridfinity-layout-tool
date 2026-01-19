import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { lazyWithRetry, namedExport } from '@/utils/lazyWithRetry';
import type { ComponentType } from 'react';

// Mock component for testing
const MockComponent: ComponentType = () => <div data-testid="mock-component">Mock Content</div>;
MockComponent.displayName = 'MockComponent';

describe('namedExport', () => {
  it('converts named export to default export format', () => {
    const module = {
      MyComponent: MockComponent,
      OtherComponent: () => null,
    };

    const result = namedExport<typeof MockComponent>('MyComponent')(module);

    expect(result).toEqual({ default: MockComponent });
  });

  it('works with any component name', () => {
    const AnotherComponent: ComponentType = () => null;
    const module = { AnotherComponent };

    const result = namedExport<typeof AnotherComponent>('AnotherComponent')(module);

    expect(result).toEqual({ default: AnotherComponent });
  });

  it('can be chained with import promises', async () => {
    const fakeModule = { TestComponent: MockComponent };
    const importPromise = Promise.resolve(fakeModule);

    const result = await importPromise.then(namedExport('TestComponent'));

    expect(result).toEqual({ default: MockComponent });
  });
});

describe('lazyWithRetry', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful imports', () => {
    it('renders component on successful import', async () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      });

      expect(importFn).toHaveBeenCalled();
    });
  });

  describe('retry behavior', () => {
    it('logs warning on import failure', async () => {
      // Create an import that fails once then succeeds
      const importFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn, 2, false);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should have logged the first failure
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dynamic import failed'),
        expect.any(Error)
      );
    });

    it('retries multiple times before succeeding', async () => {
      const importFn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({ default: MockComponent });

      const LazyComponent = lazyWithRetry(importFn, 2, false);

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should have called import multiple times
      expect(importFn.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('configuration', () => {
    it('accepts custom retry count', () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      // Should not throw with valid configuration
      expect(() => lazyWithRetry(importFn, 5)).not.toThrow();
      expect(() => lazyWithRetry(importFn, 0)).not.toThrow();
    });

    it('accepts reloadOnFinalFailure flag', () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      expect(() => lazyWithRetry(importFn, 2, true)).not.toThrow();
      expect(() => lazyWithRetry(importFn, 2, false)).not.toThrow();
    });

    it('uses default parameters when not specified', () => {
      const importFn = vi.fn().mockResolvedValue({ default: MockComponent });

      // Should work with just the import function
      expect(() => lazyWithRetry(importFn)).not.toThrow();
    });
  });
});
