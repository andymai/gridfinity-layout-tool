import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLinkedDesign } from './useLinkedDesign';
import type { CustomBinRef } from '@/features/bin-designer/store/customBinRegistry';

// Mock useCustomBins
const mockRegistry: CustomBinRef[] = [];

vi.mock('@/features/bin-designer/hooks/useCustomBins', () => ({
  useCustomBins: () => mockRegistry,
}));

function makeDesignRef(overrides: Partial<CustomBinRef> = {}): CustomBinRef {
  return {
    id: 'design-1',
    name: 'Test Design',
    width: 2,
    depth: 3,
    height: 4,
    thumbnail: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useLinkedDesign', () => {
  beforeEach(() => {
    // Clear mock registry
    mockRegistry.length = 0;
  });

  describe('when linkedDesignId is undefined', () => {
    it('returns null linkedDesign', () => {
      const { result } = renderHook(() => useLinkedDesign(undefined));
      expect(result.current.linkedDesign).toBeNull();
    });

    it('returns hasLink as false', () => {
      const { result } = renderHook(() => useLinkedDesign(undefined));
      expect(result.current.hasLink).toBe(false);
    });

    it('returns isStale as false', () => {
      const { result } = renderHook(() => useLinkedDesign(undefined));
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('when linked design exists in registry', () => {
    beforeEach(() => {
      mockRegistry.push(makeDesignRef({ id: 'design-1', name: 'My Design' }));
    });

    it('returns the linked design', () => {
      const { result } = renderHook(() => useLinkedDesign('design-1'));
      expect(result.current.linkedDesign).not.toBeNull();
      expect(result.current.linkedDesign?.name).toBe('My Design');
    });

    it('returns hasLink as true', () => {
      const { result } = renderHook(() => useLinkedDesign('design-1'));
      expect(result.current.hasLink).toBe(true);
    });

    it('returns isStale as false', () => {
      const { result } = renderHook(() => useLinkedDesign('design-1'));
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('when linked design does not exist (stale link)', () => {
    beforeEach(() => {
      // Registry has design-2 but not design-1
      mockRegistry.push(makeDesignRef({ id: 'design-2' }));
    });

    it('returns null linkedDesign', () => {
      const { result } = renderHook(() => useLinkedDesign('design-1'));
      expect(result.current.linkedDesign).toBeNull();
    });

    it('returns hasLink as true', () => {
      const { result } = renderHook(() => useLinkedDesign('design-1'));
      expect(result.current.hasLink).toBe(true);
    });

    it('returns isStale as true', () => {
      const { result } = renderHook(() => useLinkedDesign('design-1'));
      expect(result.current.isStale).toBe(true);
    });
  });

  describe('with multiple designs in registry', () => {
    beforeEach(() => {
      mockRegistry.push(
        makeDesignRef({ id: 'design-1', name: 'Design One' }),
        makeDesignRef({ id: 'design-2', name: 'Design Two' }),
        makeDesignRef({ id: 'design-3', name: 'Design Three' })
      );
    });

    it('returns correct design when multiple exist', () => {
      const { result } = renderHook(() => useLinkedDesign('design-2'));
      expect(result.current.linkedDesign?.name).toBe('Design Two');
    });
  });

  describe('memoization', () => {
    beforeEach(() => {
      mockRegistry.push(makeDesignRef({ id: 'design-1' }));
    });

    it('returns stable reference when inputs unchanged', () => {
      const { result, rerender } = renderHook(() => useLinkedDesign('design-1'));
      const firstResult = result.current;

      rerender();
      expect(result.current).toBe(firstResult);
    });
  });
});
