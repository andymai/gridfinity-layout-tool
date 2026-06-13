import { useState, useMemo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useSettingsStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { useMutations } from '@/shared/contexts';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR, CATEGORY_COLOR_PALETTE } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useToastStore } from '@/core/store/toast';
import { isOk, isErr } from '@/core/result';
import { useResultToast } from '@/shared/hooks';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useTranslation } from '@/i18n';
import { categoryId as toCategoryId } from '@/core/types';
import type { CategoryId } from '@/core/types';
import { batch } from '@/core/cqrs';
import { Button, Collapsible, IconButton, PlusIcon, XIcon } from '@/design-system';

interface ColorPaletteGridProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
  t: ReturnType<typeof useTranslation>;
}

function ColorPaletteGrid({ selectedColor, onColorSelect, t }: ColorPaletteGridProps) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {CATEGORY_COLOR_PALETTE.map(({ color, nameKey }) => {
        const name = t(nameKey);
        return (
          <IconButton
            key={color}
            size="sm"
            touchTarget={false}
            onClick={() => onColorSelect(color)}
            className="w-6 h-6 hover:scale-110 hover:bg-transparent"
            style={{
              boxShadow:
                selectedColor === color ? '0 0 0 2px var(--color-primary)' : 'var(--shadow-sm)',
            }}
            title={name}
            aria-label={t('categories.setColorTo', { name })}
            pressed={selectedColor === color}
          >
            <span
              className="block w-full h-full rounded"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
          </IconButton>
        );
      })}
    </div>
  );
}

export function CategoriesPanel() {
  const t = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
  const [showSaveCategoriesConfirm, setShowSaveCategoriesConfirm] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);

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

  const setHighlightedCategoryId = useViewStore((state) => state.setHighlightedCategoryId);

  const saveCategoriesAsDefaults = useSettingsStore((state) => state.saveCategoriesAsDefaults);
  const addToast = useToastStore((state) => state.addToast);
  const { showErrorToast } = useResultToast();

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
  const handleCategorySelect = (rawCategoryId: string, categoryName: string) => {
    const catId: CategoryId = toCategoryId(rawCategoryId);
    // Always set active category for new bins
    setActiveCategory(catId);

    // If bins are selected, update their categories
    if (selectedBinIds.length > 0) {
      const binsToUpdate = selectedBinIds
        .map((id) => bins.find((b) => b.id === id))
        .filter((bin): bin is (typeof bins)[number] => !!bin && bin.category !== catId);
      if (binsToUpdate.length === 0) return;

      const binCount = binsToUpdate.length;
      batch(() => {
        for (const bin of binsToUpdate) {
          if (isErr(updateBin(bin.id, { category: catId }))) break;
        }
      });

      mlTracking.trackCategory(binsToUpdate[0], categoryName, binCount);
      addToast(t('toast.categoryChanged', { count: binCount, name: categoryName }), 'success');
    }
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

  const handleUpdateCategory = (id: string, field: 'name' | 'color', value: string) => {
    const updates = {
      [field]: field === 'name' ? value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) : value,
    };
    const result = batch(() => updateCategory(toCategoryId(id), updates));
    if (isErr(result)) {
      showErrorToast(result.error);
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

  const canAddCategory = categories.length < CONSTRAINTS.CATEGORIES_MAX;

  const handleSaveCategoriesAsDefaults = () => {
    saveCategoriesAsDefaults(categories);
    setShowSaveCategoriesConfirm(false);
    addToast(t('toast.categoriesSavedAsDefaults'), 'success');
  };

  const actionButtons = (
    <div className="flex items-center gap-1">
      <IconButton
        size="sm"
        touchTarget={false}
        onClick={() => setShowSaveCategoriesConfirm(true)}
        className="w-7 h-7"
        title={t('categories.saveAsDefaultsTitle')}
        aria-label={t('categories.saveAsDefaults')}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 17v5M9 3h6v2l-1 1v4l3 3v2H7v-2l3-3V6L9 5V3z" />
        </svg>
      </IconButton>
      <IconButton
        size="sm"
        touchTarget={false}
        onClick={handleAddCategory}
        disabled={!canAddCategory}
        className="w-7 h-7"
        title={t('categories.addCategory')}
        aria-label={t('categories.addCategory')}
      >
        <PlusIcon className="w-4 h-4" />
      </IconButton>
    </div>
  );

  return (
    <div>
      <Collapsible title={t('common.categories')} size="md" actions={actionButtons}>
        <div className="space-y-1">
          {categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            const isEditing = editingId === category.id;
            const binCount = binCounts.get(category.id) || 0;
            const canDelete = binCount === 0 && categories.length > CONSTRAINTS.CATEGORIES_MIN;
            const isHovered = hoveredCategoryId === category.id;

            return (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- keyboard users interact with inner buttons
              <div
                key={category.id}
                className={`group relative flex items-center gap-2 p-2 rounded-md cursor-pointer min-w-0 transition-colors duration-150 ${isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-surface-hover'}`}
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
                    role="presentation"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Name input - auto-saves on change */}
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) => handleUpdateCategory(category.id, 'name', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                      className="input w-full py-1 px-2 text-sm"
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
                      autoFocus
                      placeholder={t('categories.categoryNamePlaceholder')}
                    />
                    <ColorPaletteGrid
                      selectedColor={category.color}
                      onColorSelect={(color) => handleUpdateCategory(category.id, 'color', color)}
                      t={t}
                    />
                    {/* Footer row: hint + delete link */}
                    <div className="flex items-center justify-between text-xs text-content-tertiary mt-0.5">
                      <span>{t('categories.clickOutsideToClose')}</span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          onClick={(e) => handleDeleteCategory(category.id, category.name, e)}
                          className="text-content-tertiary hover:text-error px-0 py-0 hover:bg-transparent"
                          aria-label={t('categories.deleteCategory')}
                        >
                          {t('common.delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Color swatch with checkmark overlay - click to open quick color picker */}
                    <IconButton
                      size="sm"
                      touchTarget={false}
                      className="relative w-5 h-5 rounded flex-shrink-0 shadow-sm hover:scale-110 hover:ring-2 hover:ring-accent/50 hover:bg-transparent"
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
                    </IconButton>

                    {colorPickerId === category.id && (
                      <div
                        ref={colorPickerRef}
                        className="absolute left-0 top-full mt-0.5 z-50 p-2 bg-surface-elevated border border-stroke-subtle rounded-lg shadow-lg animate-scale-in w-[calc(100%-0.5rem)]"
                        role="presentation"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ColorPaletteGrid
                          selectedColor={category.color}
                          onColorSelect={(color) => {
                            handleUpdateCategory(category.id, 'color', color);
                            setColorPickerId(null);
                          }}
                          t={t}
                        />
                      </div>
                    )}
                    {/* Category name - click to select, double-click to edit */}
                    <Button
                      variant="ghost"
                      className="flex-1 min-w-0 text-left justify-start px-0 py-0 hover:bg-transparent"
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
                    </Button>
                    {/* Edit button - appears on hover */}
                    <IconButton
                      size="sm"
                      touchTarget={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        setColorPickerId(null);
                        setEditingId(category.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 -my-1 flex-shrink-0"
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
                    </IconButton>
                    {/* Delete button - appears on hover for unused categories */}
                    {canDelete && (
                      <IconButton
                        variant="dangerGhost"
                        size="sm"
                        touchTarget={false}
                        onClick={(e) => handleDeleteCategory(category.id, category.name, e)}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 -my-1 text-content-tertiary flex-shrink-0"
                        title={t('categories.deleteCategory')}
                        aria-label={t('categories.deleteCategoryAria', { name: category.name })}
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </IconButton>
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
      </Collapsible>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={t('categories.confirmDelete.title')}
        message={t('categories.confirmDelete.message', { name: deleteConfirm?.name || '' })}
        confirmText={t('categories.confirmDelete.confirm')}
        destructive
        onConfirm={confirmDeleteCategory}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        isOpen={showSaveCategoriesConfirm}
        title={t('settings.confirmSaveCategories.title')}
        message={`${t('settings.confirmSaveCategories.message', { count: categories.length })}\n\n${categories.map((c) => c.name).join(', ')}`}
        confirmText={t('common.save')}
        onConfirm={handleSaveCategoriesAsDefaults}
        onCancel={() => setShowSaveCategoriesConfirm(false)}
      />
    </div>
  );
}
