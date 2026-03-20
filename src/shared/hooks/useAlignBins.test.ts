import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAlignBins } from './useAlignBins';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { createTestLayout, createTestBin, resetAllStores } from '@/test/testUtils';
import { binId } from '@/core/types';

describe('useAlignBins', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('canAlign is false with fewer than 2 selected bins', () => {
    useSelectionStore.setState({ selectedBinIds: [binId('a')] });
    const { result } = renderHook(() => useAlignBins());
    expect(result.current.canAlign).toBe(false);
  });

  it('canAlign is true with 2+ selected bins', () => {
    useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });
    const { result } = renderHook(() => useAlignBins());
    expect(result.current.canAlign).toBe(true);
  });

  it('aligns bins and shows success toast', () => {
    const bins = [
      createTestBin({ id: binId('a'), x: 0, y: 0, width: 2, depth: 2 }),
      createTestBin({ id: binId('b'), x: 5, y: 3, width: 2, depth: 2 }),
    ];
    useLayoutStore.setState({
      layout: createTestLayout({ bins }),
    });
    useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

    const { result } = renderHook(() => useAlignBins());

    act(() => {
      result.current.alignBins('left');
    });

    // Verify bin 'b' moved to x=0
    const updatedBins = useLayoutStore.getState().layout.bins;
    const binB = updatedBins.find((b) => b.id === binId('b'));
    expect(binB?.x).toBe(0);

    // Verify toast was shown
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
  });

  it('does nothing when all bins are already aligned', () => {
    const bins = [
      createTestBin({ id: binId('a'), x: 0, y: 0, width: 2, depth: 2 }),
      createTestBin({ id: binId('b'), x: 0, y: 3, width: 3, depth: 2 }),
    ];
    useLayoutStore.setState({
      layout: createTestLayout({ bins }),
    });
    useSelectionStore.setState({ selectedBinIds: [binId('a'), binId('b')] });

    const { result } = renderHook(() => useAlignBins());

    act(() => {
      result.current.alignBins('left');
    });

    // Bins unchanged
    const updatedBins = useLayoutStore.getState().layout.bins;
    expect(updatedBins[0].x).toBe(0);
    expect(updatedBins[1].x).toBe(0);
  });
});
