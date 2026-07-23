/**
 * Category CRUD + selection state shared by the desktop CategoriesPanel and
 * the mobile MobileCategoriesPanel.
 *
 * Selecting a category always sets it active for new bins; when bins are
 * selected it also reassigns them — skipping bins already in the category and
 * aborting the batch on the first mutation error. `onSelectionApplied` fires
 * only when bins actually changed (desktop hangs ML tracking off it);
 * `onAfterSelect` always fires after a selection (mobile closes its panel).
 */

import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useMutations } from '@/shared/contexts';
import { useToastStore } from '@/core/store/toast';
import { useResultToast } from '@/shared/hooks';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { isOk, isErr } from '@/core/result';
import { categoryId as toCategoryId } from '@/core/types';
import type { Bin, Category, CategoryId } from '@/core/types';
import { useTranslation } from '@/i18n';
import { batch } from '@/core/cqrs';

export interface CategoryManager {
  categories: Category[];
  binCounts: Map<string, number>;
  activeCategoryId: CategoryId;
  selectedBinIds: string[];
  canAddCategory: boolean;
  editingId: CategoryId | null;
  setEditingId: (id: CategoryId | null) => void;
  /** Sets the category active and reassigns any selected bins to it. */
  selectCategory: (id: string, name: string) => void;
  /** Adds a category, activates it, and opens it for editing. */
  addCategory: () => void;
  updateCategoryField: (id: string, field: 'name' | 'color', value: string) => void;
  deleteConfirm: { id: CategoryId; name: string } | null;
  /** Opens the delete confirm; toasts instead when in use or last category. */
  requestDelete: (id: string, name: string) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
}

export function useCategoryManager(options?: {
  onSelectionApplied?: (firstBin: Bin, categoryName: string, count: number) => void;
  onAfterSelect?: () => void;
}): CategoryManager {
  const t = useTranslation();
  const onSelectionApplied = options?.onSelectionApplied;
  const onAfterSelect = options?.onAfterSelect;
  const [editingId, setEditingId] = useState<CategoryId | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: CategoryId; name: string } | null>(null);

  const { categories, bins } = useLayoutStore(
    useShallow((state) => ({
      categories: state.layout.categories,
      bins: state.layout.bins,
    }))
  );
  const {
    addCategory: addCategoryMutation,
    updateCategory,
    deleteCategory,
    updateBin,
  } = useMutations();

  const { activeCategoryId, setActiveCategory, selectedBinIds } = useSelectionStore(
    useShallow((state) => ({
      activeCategoryId: state.activeCategoryId,
      setActiveCategory: state.setActiveCategory,
      selectedBinIds: state.selectedBinIds,
    }))
  );

  const addToast = useToastStore((state) => state.addToast);
  const { showErrorToast } = useResultToast();

  const binCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bin of bins) {
      counts.set(bin.category, (counts.get(bin.category) || 0) + 1);
    }
    return counts;
  }, [bins]);

  const selectCategory = (rawCategoryId: string, categoryName: string) => {
    const catId: CategoryId = toCategoryId(rawCategoryId);
    // Always set active category for new bins
    setActiveCategory(catId);

    // If bins are selected, update their categories
    if (selectedBinIds.length > 0) {
      const binsToUpdate = selectedBinIds
        .map((id) => bins.find((b) => b.id === id))
        .filter((bin): bin is (typeof bins)[number] => !!bin && bin.category !== catId);
      if (binsToUpdate.length > 0) {
        const binCount = binsToUpdate.length;
        batch(() => {
          for (const bin of binsToUpdate) {
            if (isErr(updateBin(bin.id, { category: catId }))) break;
          }
        });

        onSelectionApplied?.(binsToUpdate[0], categoryName, binCount);
        addToast(t('toast.categoryChanged', { count: binCount, name: categoryName }), 'success');
      }
    }

    onAfterSelect?.();
  };

  const addCategory = () => {
    batch(() => {
      const result = addCategoryMutation({ name: 'New Category', color: DEFAULT_CATEGORY_COLOR });
      if (isOk(result)) {
        setActiveCategory(result.value);
        setEditingId(result.value);
      }
    });
  };

  const updateCategoryField = (id: string, field: 'name' | 'color', value: string) => {
    const updates = {
      [field]: field === 'name' ? value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) : value,
    };
    const result = batch(() => updateCategory(toCategoryId(id), updates));
    if (isErr(result)) {
      showErrorToast(result.error);
    }
  };

  const requestDelete = (id: string, name: string) => {
    const binCount = binCounts.get(id) || 0;

    // Show helpful message if category is in use
    if (binCount > 0) {
      addToast(t('categories.deleteInUse', { count: binCount, name }), 'error');
      return;
    }

    // Show message if it's the last category
    if (categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
      addToast(t('categories.cannotDeleteLast'), 'error');
      return;
    }

    setDeleteConfirm({ id: toCategoryId(id), name });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    const result = batch(() => {
      const deleteResult = deleteCategory(toCategoryId(id));
      if (isOk(deleteResult)) {
        // Access fresh state to avoid stale closure issues
        const currentCategories = useLayoutStore.getState().layout.categories;
        const currentActiveCategoryId = useSelectionStore.getState().activeCategoryId;
        if (currentActiveCategoryId === id && currentCategories.length > 0) {
          setActiveCategory(currentCategories[0].id);
        }
      }
      return deleteResult;
    });
    if (isErr(result)) {
      showErrorToast(result.error);
    }
    setEditingId(null);
    setDeleteConfirm(null);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const canAddCategory = categories.length < CONSTRAINTS.CATEGORIES_MAX;

  return {
    categories,
    binCounts,
    activeCategoryId,
    selectedBinIds,
    canAddCategory,
    editingId,
    setEditingId,
    selectCategory,
    addCategory,
    updateCategoryField,
    deleteConfirm,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
