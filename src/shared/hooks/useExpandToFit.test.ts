import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpandToFit } from './useExpandToFit';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { createTestLayout, createTestBin, resetAllStores } from '@/test/testUtils';
import { binId } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

/** One row of three 2u bins in a 7u-wide, 2u-deep drawer — slack on X only. */
function seedRowOfThree(): void {
  const bins = [0, 2, 4].map((x, i) =>
    createTestBin({ id: binId(`b${i}`), x, y: 0, width: 2, depth: 2 })
  );
  useLayoutStore.setState({
    layout: createTestLayout({ drawer: { width: 7, depth: 2, height: 12 }, bins }),
  });
  useSelectionStore.setState({ selectedBinIds: bins.map((b) => b.id) });
}

describe('useExpandToFit', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('canExpand is false with nothing selected', () => {
    useLayoutStore.setState({ layout: createTestLayout({ bins: [createTestBin()] }) });
    const { result } = renderHook(() => useExpandToFit());
    expect(result.current.canExpand).toBe(false);
  });

  it('canExpand is false when the selection is only staged bins', () => {
    const staged = createTestBin({ id: binId('s'), layerId: STAGING_ID });
    useLayoutStore.setState({ layout: createTestLayout({ bins: [staged] }) });
    useSelectionStore.setState({ selectedBinIds: [staged.id] });

    const { result } = renderHook(() => useExpandToFit());
    expect(result.current.canExpand).toBe(false);
  });

  it('canExpand is true for a single placed bin', () => {
    const bin = createTestBin({ id: binId('a') });
    useLayoutStore.setState({ layout: createTestLayout({ bins: [bin] }) });
    useSelectionStore.setState({ selectedBinIds: [bin.id] });

    const { result } = renderHook(() => useExpandToFit());
    expect(result.current.canExpand).toBe(true);
  });

  it('repositions the selection and writes overhangs that close the gaps', () => {
    seedRowOfThree();
    const { result } = renderHook(() => useExpandToFit());

    act(() => {
      result.current.expandToFit();
    });

    const bins = useLayoutStore.getState().layout.bins;
    const byId = new Map(bins.map((b) => [b.id, b]));
    expect(byId.get(binId('b0'))?.x).toBeCloseTo(0);
    expect(byId.get(binId('b1'))?.x).toBeCloseTo(2.5);
    expect(byId.get(binId('b2'))?.x).toBeCloseTo(5);

    for (const b of bins) {
      expect(b.overhang?.enabled).toBe(true);
      expect((b.overhang?.left ?? 0) + (b.overhang?.right ?? 0)).toBeCloseTo(14);
    }

    const toasts = useToastStore.getState().toasts;
    expect(toasts.at(-1)?.type).toBe('success');
  });

  it('applies as a single undo step', async () => {
    const { useHistoryStore } = await import('@/core/cqrs/undo/historyStore');
    useHistoryStore.getState().clear();
    seedRowOfThree();
    const before = useHistoryStore.getState().past.length;

    const { result } = renderHook(() => useExpandToFit());
    act(() => {
      result.current.expandToFit();
    });

    expect(useHistoryStore.getState().past.length).toBe(before + 1);
  });

  it('leaves the layout alone and explains why when there is no slack', () => {
    const bin = createTestBin({ id: binId('a'), width: 2, depth: 2 });
    useLayoutStore.setState({
      layout: createTestLayout({ drawer: { width: 2, depth: 2, height: 12 }, bins: [bin] }),
    });
    useSelectionStore.setState({ selectedBinIds: [bin.id] });

    const { result } = renderHook(() => useExpandToFit());
    act(() => {
      result.current.expandToFit();
    });

    const after = useLayoutStore.getState().layout.bins[0];
    expect(after.x).toBe(0);
    expect(after.overhang).toBeUndefined();

    const toasts = useToastStore.getState().toasts;
    expect(toasts.at(-1)?.type).toBe('info');
  });

  it('ignores staged bins mixed into the selection', () => {
    const placed = createTestBin({ id: binId('p'), x: 0, y: 0, width: 1, depth: 1 });
    const staged = createTestBin({ id: binId('s'), layerId: STAGING_ID });
    useLayoutStore.setState({
      layout: createTestLayout({
        drawer: { width: 2, depth: 2, height: 12 },
        bins: [placed, staged],
      }),
    });
    useSelectionStore.setState({ selectedBinIds: [placed.id, staged.id] });

    const { result } = renderHook(() => useExpandToFit());
    act(() => {
      result.current.expandToFit();
    });

    const bins = useLayoutStore.getState().layout.bins;
    expect(bins.find((b) => b.id === binId('p'))?.overhang?.enabled).toBe(true);
    expect(bins.find((b) => b.id === binId('s'))?.overhang).toBeUndefined();
  });
});
