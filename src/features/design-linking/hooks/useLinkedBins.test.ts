import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLinkedBins } from './useLinkedBins';
import { useLayoutStore } from '@/core/store/layout';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';

// Helper to create test bins
function makeBin(overrides: Partial<Bin> = {}): Bin {
  return createTestBin({
    width: gridUnits(2),
    depth: gridUnits(3),
    height: heightUnits(4),
    ...overrides,
  });
}

function setupLayoutStore(bins: Bin[]) {
  useLayoutStore.setState({
    layout: createTestLayout({ bins }),
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
        makeBin({ id: binId('bin-1') }), // No linkedDesignId
        makeBin({ id: binId('bin-2'), linkedDesignId: designId('other-design') }),
      ]);
    });

    it('returns empty linkedBins array', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.linkedBins).toEqual([]);
    });

    it('returns count of 0', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.count).toBe(0);
    });

    it('returns hasLinkedBins as false', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.hasLinkedBins).toBe(false);
    });
  });

  describe('when bins are linked to design', () => {
    beforeEach(() => {
      setupLayoutStore([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
        makeBin({ id: binId('bin-2'), linkedDesignId: designId('design-1') }),
        makeBin({ id: binId('bin-3'), linkedDesignId: designId('design-2') }),
        makeBin({ id: binId('bin-4') }), // Not linked
      ]);
    });

    it('returns only bins linked to specified design', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.linkedBins).toHaveLength(2);
      expect(result.current.linkedBins.map((b) => b.id)).toEqual(['bin-1', 'bin-2']);
    });

    it('returns correct count', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.count).toBe(2);
    });

    it('returns hasLinkedBins as true', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.hasLinkedBins).toBe(true);
    });
  });

  describe('with single linked bin', () => {
    beforeEach(() => {
      setupLayoutStore([makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') })]);
    });

    it('returns single bin in array', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.linkedBins).toHaveLength(1);
      expect(result.current.linkedBins[0].id).toBe('bin-1');
    });

    it('returns count of 1', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.count).toBe(1);
    });
  });

  describe('reactivity to store changes', () => {
    it('updates when bins change in store', () => {
      setupLayoutStore([]);

      const { result, rerender } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.count).toBe(0);

      // Add a linked bin (wrap in act to avoid warning)
      act(() => {
        setupLayoutStore([makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') })]);
      });

      rerender();
      expect(result.current.count).toBe(1);
    });
  });

  describe('querying different designs', () => {
    beforeEach(() => {
      setupLayoutStore([
        makeBin({ id: binId('bin-1'), linkedDesignId: designId('design-1') }),
        makeBin({ id: binId('bin-2'), linkedDesignId: designId('design-2') }),
        makeBin({ id: binId('bin-3'), linkedDesignId: designId('design-2') }),
      ]);
    });

    it('returns correct bins for design-1', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-1')));
      expect(result.current.count).toBe(1);
    });

    it('returns correct bins for design-2', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-2')));
      expect(result.current.count).toBe(2);
    });

    it('returns empty for non-existent design', () => {
      const { result } = renderHook(() => useLinkedBins(designId('design-999')));
      expect(result.current.count).toBe(0);
    });
  });
});
