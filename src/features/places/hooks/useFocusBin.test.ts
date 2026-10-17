import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { STAGING_ID } from '@/core/constants';
import { err, layoutInvalidOperation, OK } from '@/core/result';
import { useLayoutStore, useSelectionStore } from '@/core/store';
import type { Layout, LayoutId } from '@/core/types';
import { binId, layerId, layoutId } from '@/core/types';
import { onRevealBin } from '@/shared/events/revealBin';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import type * as SharedHooks from '@/shared/hooks';

const switchLayout = vi.fn();
vi.mock('@/shared/hooks', async (orig) => ({
  ...(await orig<typeof SharedHooks>()),
  useLayoutSwitcher: () => ({ switchLayout }),
}));

import { useFocusBin } from './useFocusBin';

const LOWER = layerId('lower');
const UPPER = layerId('upper');

function drawer(): Layout {
  const layout = createTestLayout();
  layout.layers = [
    { ...layout.layers[0], id: LOWER },
    { ...layout.layers[0], id: UPPER },
  ];
  layout.bins = [
    createTestBin({ id: binId('up'), layerId: UPPER, label: 'M3 screws' }),
    createTestBin({ id: binId('stashed'), layerId: STAGING_ID, label: 'Spare' }),
  ];
  return layout;
}

function open(id: LayoutId, layout: Layout): void {
  useLayoutStore.setState({ activeLayoutId: id, layout });
}

describe('useFocusBin', () => {
  beforeEach(() => {
    resetAllStores();
    switchLayout.mockReset();
  });

  it('selects a bin in the open layout on its own layer, without switching', async () => {
    open(layoutId('here'), drawer());
    useSelectionStore.getState().setActiveLayer(LOWER);
    const { result } = renderHook(() => useFocusBin());
    await act(() => result.current(layoutId('here'), binId('up')));
    expect(switchLayout).not.toHaveBeenCalled();
    expect(useSelectionStore.getState()).toMatchObject({
      activeLayerId: UPPER,
      selectedBinIds: ['up'],
    });
  });

  it('opens the bin’s layout first', async () => {
    open(layoutId('here'), createTestLayout());
    switchLayout.mockImplementation(() => {
      open(layoutId('there'), drawer());
      return Promise.resolve(OK);
    });
    const { result } = renderHook(() => useFocusBin());
    await act(() => result.current(layoutId('there'), binId('up')));
    expect(switchLayout).toHaveBeenCalledWith('there');
    expect(useSelectionStore.getState().selectedBinIds).toEqual(['up']);
  });

  it('selects a stashed bin without touching the active layer', async () => {
    open(layoutId('here'), drawer());
    useSelectionStore.getState().setActiveLayer(LOWER);
    const { result } = renderHook(() => useFocusBin());
    await act(() => result.current(layoutId('here'), binId('stashed')));
    expect(useSelectionStore.getState()).toMatchObject({
      activeLayerId: LOWER,
      selectedBinIds: ['stashed'],
    });
  });

  it('reveals the bin after selecting it, every time it is chosen', async () => {
    open(layoutId('here'), drawer());
    const revealed: string[] = [];
    const stop = onRevealBin((id) => {
      revealed.push(`${id}:${useSelectionStore.getState().selectedBinIds.join()}`);
    });
    const { result } = renderHook(() => useFocusBin());
    await act(() => result.current(layoutId('here'), binId('stashed')));
    await act(() => result.current(layoutId('here'), binId('stashed')));
    stop();
    expect(revealed).toEqual(['stashed:stashed', 'stashed:stashed']);
  });

  it('selects nothing when the layout fails to open', async () => {
    open(layoutId('here'), createTestLayout());
    switchLayout.mockResolvedValue(err(layoutInvalidOperation('switchLayout', 'nope')));
    const { result } = renderHook(() => useFocusBin());
    await act(() => result.current(layoutId('there'), binId('up')));
    expect(useSelectionStore.getState().selectedBinIds).toEqual([]);
  });
});
