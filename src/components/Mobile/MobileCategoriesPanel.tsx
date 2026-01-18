import { useState, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { isOk } from '@/core/result';

const COLOR_PALETTE = [
  { color: '#f87171', name: 'Coral' },
  { color: '#fb923c', name: 'Orange' },
  { color: '#fbbf24', name: 'Amber' },
  { color: '#a3e635', name: 'Lime' },
  { color: '#4ade80', name: 'Green' },
  { color: '#2dd4bf', name: 'Teal' },
  { color: '#38bdf8', name: 'Sky' },
  { color: '#818cf8', name: 'Indigo' },
  { color: '#c084fc', name: 'Purple' },
  { color: '#f472b6', name: 'Pink' },
  { color: '#e2e8f0', name: 'Cloud' },
  { color: '#334155', name: 'Charcoal' },
];

/**
 * Mobile-optimized categories panel with large touch targets.
 */
export function MobileCategoriesPanel() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const { categories, bins, addCategory, updateCategory, deleteCategory, updateBin } = useLayoutStore(
    useShallow((state) => ({
      categories: state.layout.categories,
      bins: state.layout.bins,
      addCategory: state.addCategory,
      updateCategory: state.updateCategory,
      deleteCategory: state.deleteCategory,
      updateBin: state.updateBin,
    }))
  );

  const { activeCategoryId, setActiveCategory, closeMobilePanel, selectedBinIds } = useUIStore(
    useShallow((state) => ({
      activeCategoryId: state.activeCategoryId,
      setActiveCategory: state.setActiveCategory,
      closeMobilePanel: state.closeMobilePanel,
      selectedBinIds: state.selectedBinIds,
    }))
  );

  const addToast = useToastStore(state => state.addToast);
  const { execute } = useUndoableAction();

  // Calculate bin counts per category
  const binCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bin of bins) {
      counts.set(bin.category, (counts.get(bin.category) || 0) + 1);
    }
    return counts;
  }, [bins]);

  const handleSelectCategory = (id: string, name: string) => {
    // Always set active category for new bins
    setActiveCategory(id);

    // If bins are selected, update their categories
    if (selectedBinIds.length > 0) {
      execute(() => {
        for (const binId of selectedBinIds) {
          updateBin(binId, { category: id });
        }
      });
      const binCount = selectedBinIds.length;
      addToast(
        `Changed ${binCount} bin${binCount > 1 ? 's' : ''} to "${name}"`,
        'success'
      );
    }

    closeMobilePanel();
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

  const handleUpdateColor = (id: string, color: string) => {
    execute(() => {
      updateCategory(id, { color });
    });
  };

  const handleUpdateName = (id: string, name: string) => {
    execute(() => {
      updateCategory(id, { name: name.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) });
    });
  };

  const handleDelete = (id: string, name: string) => {
    const binCount = binCounts.get(id) || 0;

    // Show helpful message if category is in use
    if (binCount > 0) {
      addToast(`${binCount} bin${binCount > 1 ? 's' : ''} use "${name}". Reassign them first.`, 'error');
      return;
    }

    // Show message if it's the last category
    if (categories.length <= CONSTRAINTS.CATEGORIES_MIN) {
      addToast('Cannot delete the last category', 'error');
      return;
    }

    setDeleteConfirm({ id, name });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    execute(() => {
      deleteCategory(id);
      // Access fresh state to avoid stale closure issues
      const currentCategories = useLayoutStore.getState().layout.categories;
      const currentActiveCategoryId = useUIStore.getState().activeCategoryId;
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
      <p
        className="text-sm mb-4 text-content-tertiary"
      >
        {selectedBinIds.length > 0
          ? `Tap a category to apply it to ${selectedBinIds.length} selected bin${selectedBinIds.length > 1 ? 's' : ''}.`
          : 'Select a category to use when drawing bins.'}
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
                    placeholder="Category name"
                    autoFocus
                  />

                  {/* Color grid */}
                  <div className="grid grid-cols-6 gap-2">
                    {COLOR_PALETTE.map(({ color, name }) => (
                      <button
                        key={color}
                        onClick={() => handleUpdateColor(category.id, color)}
                        className="w-10 h-10 rounded-lg transition-transform active:scale-95"
                        style={{
                          backgroundColor: color,
                          boxShadow: category.color === color
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
                      Delete{binCount > 0 ? ` (${binCount} bins)` : ''}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn btn-secondary flex-1"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full p-4 flex items-center gap-3"
                  onClick={() => handleSelectCategory(category.id, category.name)}
                  aria-label={
                    selectedBinIds.length > 0
                      ? `Apply ${category.name} to ${selectedBinIds.length} selected bin${selectedBinIds.length > 1 ? 's' : ''}`
                      : `Select ${category.name} for new bins`
                  }
                >
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: category.color, boxShadow: 'var(--shadow-sm)' }}
                  />
                  <span
                    className="flex-1 text-left font-medium truncate text-content"
                  >
                    {category.name}
                  </span>
                  {binCount > 0 && (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium bg-surface text-content-tertiary"
                    >
                      {binCount}
                    </span>
                  )}
                  {isActive && (
                    <span
                      className="px-2 py-1 rounded text-xs font-medium bg-accent text-black"
                    >
                      Active
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(category.id); }}
                    className="btn btn-ghost w-10 h-10 p-0"
                    aria-label="Edit category"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
        Add Category
      </button>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Category"
        message={`Delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmText="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
