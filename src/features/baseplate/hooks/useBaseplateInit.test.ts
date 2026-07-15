import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { baseplateDesignId } from '@/core/types';
import { useBaseplateInit } from './useBaseplateInit';

const CUSTOM_PARAMS = { ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true };

interface MockLibraryState {
  list: Array<{ id: string; name: string; updatedAt: string }>;
  activeBaseplateId: string | null;
}

const mocks = vi.hoisted(() => {
  const libraryState: MockLibraryState = { list: [], activeBaseplateId: null };
  const storeParams: { value: unknown } = { value: undefined };
  return {
    saveCurrentAsNew: vi.fn(),
    setActiveBaseplate: vi.fn(),
    libraryState,
    storeParams,
  };
});

vi.mock('./useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => ({
    ...mocks.libraryState,
    saveCurrentAsNew: mocks.saveCurrentAsNew,
  }),
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: (selector: (s: unknown) => unknown) =>
    selector({ layout: { baseplateParams: mocks.storeParams.value } }),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ setActiveBaseplate: mocks.setActiveBaseplate }),
}));

describe('useBaseplateInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.libraryState.list = [];
    mocks.libraryState.activeBaseplateId = null;
    mocks.storeParams.value = undefined;
    mocks.saveCurrentAsNew.mockResolvedValue(
      ok({ id: baseplateDesignId('bp-new'), params: DEFAULT_BASEPLATE_PARAMS })
    );
  });

  it('creates a design when the layout has none, so nothing is ever unsaved', async () => {
    renderHook(() => useBaseplateInit());
    await waitFor(() => expect(mocks.saveCurrentAsNew).toHaveBeenCalledTimes(1));
    expect(mocks.saveCurrentAsNew.mock.calls[0][0]).toBe('Baseplate 1');
    await waitFor(() =>
      expect(mocks.setActiveBaseplate).toHaveBeenCalledWith(
        baseplateDesignId('bp-new'),
        DEFAULT_BASEPLATE_PARAMS
      )
    );
  });

  it('does nothing when a design is already active', async () => {
    mocks.libraryState.activeBaseplateId = baseplateDesignId('bp-1');
    renderHook(() => useBaseplateInit());
    await new Promise((r) => setTimeout(r, 20));
    expect(mocks.saveCurrentAsNew).not.toHaveBeenCalled();
  });

  // The whole reason this diverges from useDesignerInit: baseplateParams live
  // on the Layout, so adopting another design would silently overwrite settings
  // this layout already has. Create from them instead.
  it("preserves the layout's existing params instead of adopting another design", async () => {
    mocks.storeParams.value = CUSTOM_PARAMS;
    mocks.libraryState.list = [{ id: 'bp-other', name: 'Baseplate 1', updatedAt: '2024-01-01' }];

    renderHook(() => useBaseplateInit());

    await waitFor(() => expect(mocks.saveCurrentAsNew).toHaveBeenCalledTimes(1));
    expect(mocks.saveCurrentAsNew.mock.calls[0][1]).toEqual(CUSTOM_PARAMS);
  });

  it('names around existing entries rather than colliding', async () => {
    mocks.libraryState.list = [
      { id: 'a', name: 'Baseplate 1', updatedAt: '2024-01-01' },
      { id: 'b', name: 'Baseplate 2', updatedAt: '2024-01-02' },
    ];
    renderHook(() => useBaseplateInit());
    await waitFor(() => expect(mocks.saveCurrentAsNew).toHaveBeenCalledTimes(1));
    expect(mocks.saveCurrentAsNew.mock.calls[0][0]).toBe('Baseplate 3');
  });

  it('creates only once even when re-rendered while the save is in flight', async () => {
    const { rerender } = renderHook(() => useBaseplateInit());
    rerender();
    rerender();
    await waitFor(() => expect(mocks.saveCurrentAsNew).toHaveBeenCalledTimes(1));
  });
});
