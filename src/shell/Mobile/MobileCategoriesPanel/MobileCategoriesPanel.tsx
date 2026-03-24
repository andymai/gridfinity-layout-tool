import { useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore, useMobileStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { useToastStore } from '@/core/store/toast';
import type { CategoryId } from '@/core/types';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR, CATEGORY_COLOR_PALETTE } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { batch } from '@/core/cqrs';

/**
 * Mobile-optimized categories panel with large touch targets.
 */
export function MobileCategoriesPanel() {
  const t = useTranslation();
  const [editingId, setEditingId] = useState<CategoryId | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: CategoryId; name: string } | null>(null);

  const { categories, bins } = useLayoutStore(
    useShallow((state) => ({
      categories: state.layout.categories,
      bins: state.layout.bins,
    }))
  );
  const { addCategory, updateCategory, deleteCategory, updateBin } = useMutations();

  const { activeCategoryId, setActiveCategory, selectedBinIds } = useSelectionStore(
    useShallow((state) => ({
      activeCategoryId: state.activeCategoryId,
      setActiveCategory: state.setActiveCategory,
      selectedBinIds: state.selectedBinIds,
    }))
  );
  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);

  const addToast = useToastStore((state) => state.addToast);

  // Calculate bin counts per category
  const binCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bin of bins) {
      counts.set(bin.category, (counts.get(bin.category) || 0) + 1);
    }
    return counts;
  }, [bins]);

  const handleSelectCategory = (id: CategoryId, name: string) => {
    // Always set active category for new bins
    setActiveCategory(id);

    // If bins are selected, update their categories
    if (selectedBinIds.length > 0) {
      batch(() => {
        for (const binId of selectedBinIds) {
          updateBin(binId, { category: id });
        }
      });
      const binCount = selectedBinIds.length;
      addToast(t('toast.categoryChanged', { count: binCount, name }), 'success');
    }

    closeMobilePanel();
  };

  const handleAddCategory = () => {
    batch(() => {
      const result = addCategory({ name: 'New Category', color: DEFAULT_CATEGORY_COLOR });
      if (isOk(result)) {
        setActiveCategory(result.value);
        setEditingId(result.value);
      }
    });
  };

  const handleUpdateColor = (id: CategoryId, color: string) => {
    batch(() => {
      updateCategory(id, { color });
    });
  };

  const handleUpdateName = (id: CategoryId, name: string) => {
    batch(() => {
      updateCategory(id, { name: name.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) });
    });
  };

  const handleDelete = (id: CategoryId, name: string) => {
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

    setDeleteConfirm({ id, name });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    batch(() => {
      deleteCategory(id);
      // Access fresh state to avoid stale closure issues
      const currentCategories = useLayoutStore.getState().layout.categories;
      const currentActiveCategoryId = useSelectionStore.getState().activeCategoryId;
      if (currentActiveCategoryId === id && currentCategories.length > 0) {
        setActiveCategory(currentCategories[0].id);
      }
    });
    setEditingId(null);
    setDeleteConfirm(null);
  };

  const canAddCategory = categories.length < CONSTRAINTS.CATEGORIES_MAX;

  return (
    <div className="pb-4">
      <p className="text-sm mb-4 text-content-tertiary">
        {selectedBinIds.length > 0
          ? t('mobile.categories.tapToApply', { count: selectedBinIds.length })
          : t('mobile.categories.selectDefault')}
      </p>

      <div className="space-y-2">
        {categories.map((category) => {
          const isActive = category.id === activeCategoryId;
          const isEditing = editingId === category.id;
          const binCount = binCounts.get(category.id) || 0;
          const canDelete = binCount === 0 && categories.length > CONSTRAINTS.CATEGORIES_MIN;

          return (
            <div
              key={category.id}
              className={`rounded-lg overflow-hidden ${isActive ? 'bg-surface-hover border-2 border-accent' : 'bg-surface-elevated border-2 border-transparent'}`}
            >
              {isEditing ? (
                <div className="p-4 space-y-3">
                  {/* Name input */}
                  <input
                    type="text"
                    value={category.name}
                    onChange={(e) => handleUpdateName(category.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                    className="input w-full"
                    placeholder={t('categories.categoryNamePlaceholder')}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
                    autoFocus
                  />

                  {/* Color grid */}
                  <div className="grid grid-cols-6 gap-2">
                    {CATEGORY_COLOR_PALETTE.map(({ color, name }) => (
                      <button
                        key={color}
                        onClick={() => handleUpdateColor(category.id, color)}
                        className="w-10 h-10 rounded-lg transition-transform active:scale-95"
                        style={{
                          backgroundColor: color,
                          boxShadow:
                            category.color === color
                              ? '0 0 0 3px var(--color-primary)'
                              : 'var(--shadow-sm)',
                        }}
                        aria-label={name}
                      />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleDelete(category.id, category.name)}
                      className={`btn flex-1 ${canDelete ? 'btn-danger' : 'btn-secondary opacity-50'}`}
                    >
                      {t('common.delete')}
                      {binCount > 0 ? ` (${binCount} bins)` : ''}
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn btn-secondary flex-1">
                      {t('common.done')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full p-4 flex items-center gap-3"
                  onClick={() => handleSelectCategory(category.id, category.name)}
                  aria-label={
                    selectedBinIds.length > 0
                      ? t('mobile.categories.applyToSelected', {
                          count: selectedBinIds.length,
                          name: category.name,
                        })
                      : t('mobile.categories.selectForNew', { name: category.name })
                  }
                >
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: category.color, boxShadow: 'var(--shadow-sm)' }}
                  />
                  <span className="flex-1 text-left font-medium truncate text-content">
                    {category.name}
                  </span>
                  {binCount > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-surface text-content-tertiary">
                      {binCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-accent text-black">
                      {t('layouts.active')}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(category.id);
                    }}
                    className="btn btn-ghost w-10 h-10 p-0"
                    aria-label={t('categories.editCategory')}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add category button */}
      <button
        onClick={handleAddCategory}
        disabled={!canAddCategory}
        className="btn btn-primary w-full mt-4"
      >
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('categories.addCategory')}
      </button>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={t('categories.confirmDelete.title')}
        message={t('categories.confirmDelete.message', { name: deleteConfirm?.name || '' })}
        confirmText={t('categories.confirmDelete.confirm')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
