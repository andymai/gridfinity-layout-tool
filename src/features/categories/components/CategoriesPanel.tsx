import { useState, useMemo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useToastStore } from '@/core/store/toast';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { isOk, isErr, getUserMessage } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useTranslation } from '@/i18n';

// Curated color palette optimized for dark UI backgrounds
// Colors chosen for: visual distinction, balanced saturation, good contrast
const COLOR_PALETTE = [
  { color: '#f87171', name: 'Coral' }, // Warm red, softer than pure red
  { color: '#fb923c', name: 'Orange' }, // Vibrant orange
  { color: '#fbbf24', name: 'Amber' }, // Golden yellow
  { color: '#a3e635', name: 'Lime' }, // Yellow-green, high visibility
  { color: '#4ade80', name: 'Green' }, // Fresh green
  { color: '#2dd4bf', name: 'Teal' }, // Blue-green
  { color: '#38bdf8', name: 'Sky' }, // Light blue
  { color: '#818cf8', name: 'Indigo' }, // Purple-blue
  { color: '#c084fc', name: 'Purple' }, // Vibrant purple
  { color: '#f472b6', name: 'Pink' }, // Warm pink
  { color: '#e2e8f0', name: 'Cloud' }, // Soft off-white
  { color: '#334155', name: 'Charcoal' }, // Near-black
  { color: '#94a3b8', name: 'Slate' }, // Cool neutral
  { color: '#a8a29e', name: 'Stone' }, // Warm neutral
];

export function CategoriesPanel() {
  const t = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);

  const { categories, bins } = useLayoutStore(
    useShallow((state) => ({
      categories: state.layout.categories,
      bins: state.layout.bins,
    }))
  );
  const { addCategory, updateCategory, deleteCategory, updateBin } = useMutations();

  const { activeCategoryId, setActiveCategory, setHighlightedCategoryId, selectedBinIds } =
    useUIStore(
      useShallow((state) => ({
        activeCategoryId: state.activeCategoryId,
        setActiveCategory: state.setActiveCategory,
        setHighlightedCategoryId: state.setHighlightedCategoryId,
        selectedBinIds: state.selectedBinIds,
      }))
    );

  const addToast = useToastStore((state) => state.addToast);
  const { execute } = useUndoableAction();

  // Calculate bin counts per category
  const binCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bin of bins) {
      counts.set(bin.category, (counts.get(bin.category) || 0) + 1);
    }
    return counts;
  }, [bins]);

  // Cleanup: Clear highlighted category when panel unmounts (e.g., sidebar collapses)
  useEffect(() => {
    return () => {
      setHighlightedCategoryId(null);
    };
  }, [setHighlightedCategoryId]);

  // Close edit mode or color picker on click outside or Escape
  useEffect(() => {
    if (!editingId && !colorPickerId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      // Guard against null target or non-Node target (rare but possible in DOM)
      if (!(target instanceof Node)) return;

      // Close color picker if clicking outside it
      if (colorPickerId && colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setColorPickerId(null);
      }

      // Close edit mode if clicking outside the editing area
      if (editingId && editingRef.current && !editingRef.current.contains(target)) {
        setEditingId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setColorPickerId(null);
        setEditingId(null);
      }
    };

    // Small delay to avoid immediate trigger from the click that opened the mode
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingId, colorPickerId]);

  // Handle category selection: applies to selected bins if any, always sets active category
  const handleCategorySelect = (categoryId: string, categoryName: string) => {
    // Always set active category for new bins
    setActiveCategory(categoryId);

    // If bins are selected, update their categories
    if (selectedBinIds.length > 0) {
      // Filter to only bins that actually change
      const binsToUpdate = selectedBinIds
        .map((id) => bins.find((b) => b.id === id))
        .filter((bin): bin is (typeof bins)[number] => !!bin && bin.category !== categoryId);
      if (binsToUpdate.length === 0) return;

      const binCount = binsToUpdate.length;
      execute(() => {
        for (const bin of binsToUpdate) {
          updateBin(bin.id, { category: categoryId });
        }
      });

      // Track once per batch (not per bin)
      if (binsToUpdate.length > 0) {
        mlTracking.trackCategory(binsToUpdate[0], categoryName, binCount);
      }

      addToast(t('toast.categoryChanged', { count: binCount, name: categoryName }), 'success');
    }
  };

  const handleAddCategory = () => {
    execute(() => {
      const result = addCategory({ name: 'New Category', color: DEFAULT_CATEGORY_COLOR });
      if (isOk(result)) {
        setActiveCategory(result.value);
        setEditingId(result.value);
      }
    });
  };

  const handleUpdateCategory = (id: string, field: 'name' | 'color', value: string) => {
    const result = execute(() =>
      updateCategory(id, {
        [field]: field === 'name' ? value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) : value,
      })
    );
    if (isErr(result)) {
      addToast(getUserMessage(result.error), 'error');
    }
  };

  const handleDeleteCategory = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const binCount = binCounts.get(id) || 0;

    // Show helpful message if category is in use
    if (binCount > 0) {
      addToast(
        `${binCount} bin${binCount > 1 ? 's' : ''} use "${name}". Reassign them first.`,
        'error'
      );
      return;
    }

    // Show message if it's the last category
    if (categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
      addToast(t('categories.cannotDeleteLast'), 'error');
      return;
    }

    setDeleteConfirm({ id, name });
  };

  const confirmDeleteCategory = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    const result = execute(() => {
      const deleteResult = deleteCategory(id);
      if (isOk(deleteResult)) {
        // Access fresh state to avoid stale closure issues
        const currentCategories = useLayoutStore.getState().layout.categories;
        const currentActiveCategoryId = useUIStore.getState().activeCategoryId;
        if (currentActiveCategoryId === id && currentCategories.length > 0) {
          setActiveCategory(currentCategories[0].id);
        }
      }
      return deleteResult;
    });
    if (isErr(result)) {
      addToast(getUserMessage(result.error), 'error');
    }
    setEditingId(null);
    setDeleteConfirm(null);
  };

  const canAddCategory = categories.length < CONSTRAINTS.CATEGORIES_MAX;

  const addCategoryButton = (
    <button
      onClick={handleAddCategory}
      disabled={!canAddCategory}
      className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
      title={t('categories.addCategory')}
      aria-label={t('categories.addCategory')}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );

  return (
    <div>
      <CollapsibleSection
        title={t('categories.title')}
        variant="default"
        actions={addCategoryButton}
      >
        <div className="space-y-1">
          {categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            const isEditing = editingId === category.id;
            const binCount = binCounts.get(category.id) || 0;
            const canDelete = binCount === 0 && categories.length > CONSTRAINTS.CATEGORIES_MIN;
            const isHovered = hoveredCategoryId === category.id;

            return (
              <div
                key={category.id}
                className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer min-w-0 transition-colors duration-150 ${isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-surface-hover'}`}
                onClick={() => handleCategorySelect(category.id, category.name)}
                onMouseEnter={() => {
                  setHoveredCategoryId(category.id);
                  setHighlightedCategoryId(category.id);
                }}
                onMouseLeave={() => {
                  setHoveredCategoryId(null);
                  setHighlightedCategoryId(null);
                }}
              >
                {isEditing ? (
                  <div
                    ref={editingRef}
                    className="flex flex-col gap-2 w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Name input - auto-saves on change */}
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) => handleUpdateCategory(category.id, 'name', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                      className="input w-full py-1 px-2 text-sm"
                      autoFocus
                      placeholder={t('categories.categoryNamePlaceholder')}
                    />
                    {/* Color palette - 7 columns for better fit with 14 colors */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {COLOR_PALETTE.map(({ color, name }) => (
                        <button
                          key={color}
                          onClick={() => handleUpdateCategory(category.id, 'color', color)}
                          className="w-6 h-6 rounded transition-all duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-accent"
                          style={{
                            backgroundColor: color,
                            boxShadow:
                              category.color === color
                                ? '0 0 0 2px var(--color-primary)'
                                : 'var(--shadow-sm)',
                          }}
                          title={name}
                          aria-label={t('categories.setColorTo', { name })}
                          aria-pressed={category.color === color}
                        />
                      ))}
                    </div>
                    {/* Footer row: hint + delete link */}
                    <div className="flex items-center justify-between text-xs text-content-tertiary mt-0.5">
                      <span>{t('categories.clickOutsideToClose')}</span>
                      {canDelete && (
                        <button
                          onClick={(e) => handleDeleteCategory(category.id, category.name, e)}
                          className="text-content-tertiary hover:text-error transition-colors"
                          aria-label={t('categories.deleteCategory')}
                        >
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Color swatch with checkmark overlay - click to open quick color picker */}
                    <div className="relative">
                      <button
                        className="relative w-5 h-5 rounded flex-shrink-0 shadow-sm transition-all duration-150 hover:scale-110 hover:ring-2 hover:ring-accent/50 focus-visible:ring-2 focus-visible:ring-accent"
                        style={{ backgroundColor: category.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setColorPickerId(colorPickerId === category.id ? null : category.id);
                        }}
                        title={t('categories.changeColor')}
                        aria-label={t('categories.changeColor')}
                        aria-expanded={colorPickerId === category.id}
                        aria-haspopup="true"
                      >
                        {isActive && (
                          <svg
                            className="absolute inset-0 w-5 h-5 p-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="white"
                            style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8))' }}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>

                      {/* Quick color picker popover */}
                      {colorPickerId === category.id && (
                        <div
                          ref={colorPickerRef}
                          className="absolute left-0 top-full mt-1.5 z-50 p-2 bg-surface-elevated border border-stroke-subtle rounded-lg shadow-lg animate-scale-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid grid-cols-7 gap-1.5">
                            {COLOR_PALETTE.map(({ color, name }) => (
                              <button
                                key={color}
                                onClick={() => {
                                  handleUpdateCategory(category.id, 'color', color);
                                  setColorPickerId(null);
                                }}
                                className="w-6 h-6 rounded transition-all duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-accent"
                                style={{
                                  backgroundColor: color,
                                  boxShadow:
                                    category.color === color
                                      ? '0 0 0 2px var(--color-primary)'
                                      : 'var(--shadow-sm)',
                                }}
                                title={name}
                                aria-label={t('categories.setColorTo', { name })}
                                aria-pressed={category.color === color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Category name - click to select, double-click to edit */}
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategorySelect(category.id, category.name);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setColorPickerId(null);
                        setEditingId(category.id);
                      }}
                      aria-pressed={isActive}
                      aria-label={
                        selectedBinIds.length > 0
                          ? t('categories.applyToSelectedBins', {
                              name: category.name,
                              count: selectedBinIds.length,
                            })
                          : isActive
                            ? t('categories.selectedForNewBins', { name: category.name })
                            : t('categories.selectForNewBins', { name: category.name })
                      }
                      title={
                        selectedBinIds.length > 0
                          ? t('categories.applyToCount', { count: selectedBinIds.length })
                          : undefined
                      }
                    >
                      <span className="text-sm truncate text-content block">{category.name}</span>
                    </button>
                    {/* Edit button - appears on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColorPickerId(null);
                        setEditingId(category.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 -my-1 rounded hover:bg-surface-elevated transition-opacity flex-shrink-0 focus-visible:ring-2 focus-visible:ring-accent"
                      title={t('categories.editCategory')}
                      aria-label={t('categories.editCategoryAria', { name: category.name })}
                    >
                      <svg
                        className="w-3.5 h-3.5 text-content-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    {/* Delete button - appears on hover for unused categories */}
                    {canDelete && (
                      <button
                        onClick={(e) => handleDeleteCategory(category.id, category.name, e)}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 -my-1 rounded text-content-tertiary hover:text-error hover:bg-error/10 transition-all flex-shrink-0 focus-visible:ring-2 focus-visible:ring-accent"
                        title={t('categories.deleteCategory')}
                        aria-label={t('categories.deleteCategoryAria', { name: category.name })}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                    {/* Bin count badge - only rendered when category has bins */}
                    {binCount > 0 && (
                      <span
                        className={`text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full flex-shrink-0 transition-colors ${
                          isHovered ? 'bg-accent/20 text-accent' : 'text-content-tertiary'
                        }`}
                        title={t('categories.binsUseCategory', { count: binCount })}
                      >
                        {binCount}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={t('categories.confirmDelete.title')}
        message={t('categories.confirmDelete.message', { name: deleteConfirm?.name || '' })}
        confirmText={t('categories.confirmDelete.confirm')}
        destructive
        onConfirm={confirmDeleteCategory}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
