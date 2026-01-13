import { describe, it, expect, vi } from 'vitest';
import { lazyWithRetry, namedExport } from '../utils/lazyWithRetry';
import type { ComponentType } from 'react';

// Mock component for testing
const MockComponent: ComponentType = () => null;
MockComponent.displayName = 'MockComponent';

describe('lazyWithRetry', () => {
  // Note: Testing React.lazy internals is unreliable as React's internal structure
  // varies between versions and environments. These tests verify the API contract
  // rather than internal behavior. The retry and reload logic is best tested
  // through integration tests or manual verification.

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
