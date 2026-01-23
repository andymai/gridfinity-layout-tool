import { useState, useMemo, useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useToastStore } from '@/core/store/toast';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { isOk, isErr, getUserMessage } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);

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

      addToast(`Changed ${binCount} bin${binCount > 1 ? 's' : ''} to "${categoryName}"`, 'success');
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
      addToast('Cannot delete the last category', 'error');
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
      title="Add a new category"
      aria-label="Add new category"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );

  return (
    <div>
      <CollapsibleSection title="Categories" variant="default" actions={addCategoryButton}>
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
                className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer min-w-0 transition-all ${isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-surface-hover'}`}
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
                  <div className="flex flex-col gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                    {/* Name input */}
                    <input
                      type="text"
                      value={category.name}
                      onChange={(e) => handleUpdateCategory(category.id, 'name', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                      className="input w-full py-1 px-2 text-sm"
                      autoFocus
                    />
                    {/* Color palette */}
                    <div className="grid grid-cols-6 gap-1.5">
                      {COLOR_PALETTE.map(({ color, name }) => (
                        <button
                          key={color}
                          onClick={() => handleUpdateCategory(category.id, 'color', color)}
                          className="w-6 h-6 rounded transition-transform hover:scale-110"
                          style={{
                            backgroundColor: color,
                            boxShadow:
                              category.color === color
                                ? '0 0 0 2px var(--color-primary)'
                                : 'var(--shadow-sm)',
                          }}
                          title={name}
                          aria-label={`Set color to ${name}`}
                          aria-pressed={category.color === color}
                        />
                      ))}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={(e) => handleDeleteCategory(category.id, category.name, e)}
                        disabled={!canDelete}
                        className="btn btn-danger btn-sm flex-1 justify-center"
                        aria-label={
                          canDelete
                            ? `Delete ${category.name} category`
                            : binCount > 0
                              ? `Cannot delete: ${binCount} bin${binCount > 1 ? 's' : ''} use this category`
                              : 'Cannot delete the last category'
                        }
                        title={
                          canDelete
                            ? 'Delete category'
                            : binCount > 0
                              ? `${binCount} bin${binCount > 1 ? 's' : ''} use this category`
                              : 'At least one category is required'
                        }
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn btn-secondary btn-sm flex-1 justify-center"
                        aria-label="Finish editing category"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Color swatch with checkmark overlay */}
                    <div
                      className="relative w-5 h-5 rounded flex-shrink-0 shadow-sm cursor-pointer transition-transform hover:scale-110"
                      style={{ backgroundColor: category.color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(category.id);
                      }}
                      title="Click to edit color"
                      aria-hidden="true"
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
                        setEditingId(category.id);
                      }}
                      aria-pressed={isActive}
                      aria-label={
                        selectedBinIds.length > 0
                          ? `Apply ${category.name} to ${selectedBinIds.length} selected bin${selectedBinIds.length > 1 ? 's' : ''}`
                          : isActive
                            ? `${category.name} (selected for new bins)`
                            : `Select ${category.name} for new bins`
                      }
                      title={
                        selectedBinIds.length > 0
                          ? `Apply to ${selectedBinIds.length} selected bin${selectedBinIds.length > 1 ? 's' : ''}`
                          : undefined
                      }
                    >
                      <span className="text-sm truncate text-content block">{category.name}</span>
                    </button>
                    {/* Edit button - appears on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(category.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 -my-1 rounded hover:bg-surface-elevated transition-opacity flex-shrink-0"
                      title="Edit category"
                      aria-label={`Edit ${category.name}`}
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
                    {/* Bin count badge */}
                    <span
                      className={`text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full flex-shrink-0 transition-colors ${
                        isHovered && binCount > 0
                          ? 'bg-accent/20 text-accent'
                          : 'text-content-tertiary'
                      }`}
                      title={
                        binCount > 0
                          ? `${binCount} bin${binCount > 1 ? 's' : ''} use this category`
                          : 'No bins use this category'
                      }
                    >
                      {binCount > 0 ? binCount : ''}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        destructive
        onConfirm={confirmDeleteCategory}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
