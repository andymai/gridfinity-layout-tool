import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLinkedBins } from '../../hooks/useLinkedBins';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin } from '@/core/types';

// Helper to create test bins
function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 2,
    depth: 3,
    height: 4,
    layerId: 'layer-1',
    category: 'cat-1',
    label: '',
    notes: '',
    ...overrides,
  };
}

// Helper to set up the layout store with bins
function setupLayoutStore(bins: Bin[]) {
  useLayoutStore.setState({
    layout: {
      id: 'layout-1',
      name: 'Test Layout',
      drawer: { width: 10, depth: 10, height: 5 },
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true }],
      categories: [{ id: 'cat-1', name: 'Category 1', color: '#ff0000' }],
      bins,
      gridUnitMm: 42,
      heightUnitMm: 7,
      printBedSize: 256,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  });
}

describe('useLinkedBins', () => {
  beforeEach(() => {
    // Reset layout store to empty bins
    setupLayoutStore([]);
  });

  describe('when no bins are linked to design', () => {
    beforeEach(() => {
      setupLayoutStore([
        makeBin({ id: 'bin-1' }), // No linkedDesignId
        makeBin({ id: 'bin-2', linkedDesignId: 'other-design' }),
      ]);
    });

    it('returns empty linkedBins array', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.linkedBins).toEqual([]);
    });

    it('returns count of 0', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.count).toBe(0);
    });

    it('returns hasLinkedBins as false', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.hasLinkedBins).toBe(false);
    });
  });

  describe('when bins are linked to design', () => {
    beforeEach(() => {
      setupLayoutStore([
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-2' }),
        makeBin({ id: 'bin-4' }), // Not linked
      ]);
    });

    it('returns only bins linked to specified design', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.linkedBins).toHaveLength(2);
      expect(result.current.linkedBins.map((b) => b.id)).toEqual(['bin-1', 'bin-2']);
    });

    it('returns correct count', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.count).toBe(2);
    });

    it('returns hasLinkedBins as true', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.hasLinkedBins).toBe(true);
    });
  });

  describe('with single linked bin', () => {
    beforeEach(() => {
      setupLayoutStore([makeBin({ id: 'bin-1', linkedDesignId: 'design-1' })]);
    });

    it('returns single bin in array', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.linkedBins).toHaveLength(1);
      expect(result.current.linkedBins[0].id).toBe('bin-1');
    });

    it('returns count of 1', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.count).toBe(1);
    });
  });

  describe('reactivity to store changes', () => {
    it('updates when bins change in store', () => {
      setupLayoutStore([]);

      const { result, rerender } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.count).toBe(0);

      // Add a linked bin (wrap in act to avoid warning)
      act(() => {
        setupLayoutStore([makeBin({ id: 'bin-1', linkedDesignId: 'design-1' })]);
      });

      rerender();
      expect(result.current.count).toBe(1);
    });
  });

  describe('querying different designs', () => {
    beforeEach(() => {
      setupLayoutStore([
        makeBin({ id: 'bin-1', linkedDesignId: 'design-1' }),
        makeBin({ id: 'bin-2', linkedDesignId: 'design-2' }),
        makeBin({ id: 'bin-3', linkedDesignId: 'design-2' }),
      ]);
    });

    it('returns correct bins for design-1', () => {
      const { result } = renderHook(() => useLinkedBins('design-1'));
      expect(result.current.count).toBe(1);
    });

    it('returns correct bins for design-2', () => {
      const { result } = renderHook(() => useLinkedBins('design-2'));
      expect(result.current.count).toBe(2);
    });

    it('returns empty for non-existent design', () => {
      const { result } = renderHook(() => useLinkedBins('design-999'));
      expect(result.current.count).toBe(0);
    });
  });
});
