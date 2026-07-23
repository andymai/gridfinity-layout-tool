// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCategoryManager } from './useCategoryManager';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { resetAllStores, createTestBin } from '@/test/testUtils';
import { ok } from '@/core/result';
import { categoryId } from '@/core/types';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const mutations = vi.hoisted(() => ({
  addCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  updateBin: vi.fn(),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => mutations,
}));

describe('useCategoryManager', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    mutations.addCategory.mockReturnValue(ok(categoryId('new-cat')));
    mutations.updateCategory.mockReturnValue(ok(undefined));
    mutations.deleteCategory.mockReturnValue(ok(undefined));
    mutations.updateBin.mockReturnValue(ok(undefined));
  });

  function firstCategoryId(): string {
    return useLayoutStore.getState().layout.categories[0].id;
  }

  it('selecting with no bins selected only activates the category', () => {
    const onAfterSelect = vi.fn();
    const { result } = renderHook(() => useCategoryManager({ onAfterSelect }));
    const catId = firstCategoryId();
    act(() => {
      result.current.selectCategory(catId, 'Tools');
    });
    expect(useSelectionStore.getState().activeCategoryId).toBe(catId);
    expect(mutations.updateBin).not.toHaveBeenCalled();
    expect(onAfterSelect).toHaveBeenCalledTimes(1);
  });

  it('reassigns only bins not already in the category and reports the changed count', () => {
    const catId = firstCategoryId();
    const inCategory = createTestBin({ id: 'bin-1', category: catId });
    const other = createTestBin({ id: 'bin-2' });
    const state = useLayoutStore.getState();
    useLayoutStore.setState({ layout: { ...state.layout, bins: [inCategory, other] } });
    useSelectionStore.getState().setSelectedBins(['bin-1', 'bin-2']);

    const onSelectionApplied = vi.fn();
    const { result } = renderHook(() => useCategoryManager({ onSelectionApplied }));
    act(() => {
      result.current.selectCategory(catId, 'Tools');
    });

    expect(mutations.updateBin).toHaveBeenCalledTimes(1);
    expect(mutations.updateBin).toHaveBeenCalledWith('bin-2', { category: catId });
    expect(onSelectionApplied).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bin-2' }),
      'Tools',
      1
    );
  });

  it('does not fire onSelectionApplied when every selected bin already matches', () => {
    const catId = firstCategoryId();
    const bin = createTestBin({ id: 'bin-1', category: catId });
    const state = useLayoutStore.getState();
    useLayoutStore.setState({ layout: { ...state.layout, bins: [bin] } });
    useSelectionStore.getState().setSelectedBins(['bin-1']);

    const onSelectionApplied = vi.fn();
    const { result } = renderHook(() => useCategoryManager({ onSelectionApplied }));
    act(() => {
      result.current.selectCategory(catId, 'Tools');
    });
    expect(mutations.updateBin).not.toHaveBeenCalled();
    expect(onSelectionApplied).not.toHaveBeenCalled();
  });

  it('addCategory activates the new category and opens it for editing', () => {
    const { result } = renderHook(() => useCategoryManager());
    act(() => {
      result.current.addCategory();
    });
    expect(useSelectionStore.getState().activeCategoryId).toBe(categoryId('new-cat'));
    expect(result.current.editingId).toBe(categoryId('new-cat'));
  });

  it('requestDelete toasts instead of opening the dialog when the category is in use', () => {
    const catId = firstCategoryId();
    const state = useLayoutStore.getState();
    useLayoutStore.setState({
      layout: { ...state.layout, bins: [createTestBin({ category: catId })] },
    });
    const { result } = renderHook(() => useCategoryManager());
    act(() => {
      result.current.requestDelete(catId, 'Tools');
    });
    expect(result.current.deleteConfirm).toBeNull();
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((toast) => toast.message.startsWith('categories.deleteInUse'))).toBe(true);
  });

  it('confirmDelete deletes and reassigns the active category', () => {
    const categories = useLayoutStore.getState().layout.categories;
    if (categories.length < 2) {
      const state = useLayoutStore.getState();
      useLayoutStore.setState({
        layout: {
          ...state.layout,
          categories: [
            ...state.layout.categories,
            { id: categoryId('cat-b'), name: 'B', color: '#fff' },
          ],
        },
      });
    }
    const target = useLayoutStore.getState().layout.categories[1].id;
    useSelectionStore.getState().setActiveCategory(target);

    const { result } = renderHook(() => useCategoryManager());
    act(() => {
      result.current.requestDelete(target, 'B');
    });
    expect(result.current.deleteConfirm?.id).toBe(target);
    act(() => {
      result.current.confirmDelete();
    });
    expect(mutations.deleteCategory).toHaveBeenCalledWith(target);
    expect(result.current.deleteConfirm).toBeNull();
  });
});
