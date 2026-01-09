import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useUIStore, useUndoableAction } from '../../store';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR } from '../../constants';
import { ConfirmDialog } from '../modals/ConfirmDialog';

// Curated color palette optimized for dark UI backgrounds
// Colors chosen for: visual distinction, balanced saturation, good contrast
const COLOR_PALETTE = [
  { color: '#f87171', name: 'Coral' },      // Warm red, softer than pure red
  { color: '#fb923c', name: 'Orange' },     // Vibrant orange
  { color: '#fbbf24', name: 'Amber' },      // Golden yellow
  { color: '#a3e635', name: 'Lime' },       // Yellow-green, high visibility
  { color: '#4ade80', name: 'Green' },      // Fresh green
  { color: '#2dd4bf', name: 'Teal' },       // Blue-green
  { color: '#38bdf8', name: 'Sky' },        // Light blue
  { color: '#818cf8', name: 'Indigo' },     // Purple-blue
  { color: '#c084fc', name: 'Purple' },     // Vibrant purple
  { color: '#f472b6', name: 'Pink' },       // Warm pink
  { color: '#e2e8f0', name: 'Cloud' },      // Soft off-white
  { color: '#334155', name: 'Charcoal' },   // Near-black
  { color: '#94a3b8', name: 'Slate' },      // Cool neutral
  { color: '#a8a29e', name: 'Stone' },      // Warm neutral
];

export function CategoriesPanel() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const { categories, bins, addCategory, updateCategory, deleteCategory } = useLayoutStore(
    useShallow((state) => ({
      categories: state.layout.categories,
      bins: state.layout.bins,
      addCategory: state.addCategory,
      updateCategory: state.updateCategory,
      deleteCategory: state.deleteCategory,
    }))
  );

  const { activeCategoryId, setActiveCategory } = useUIStore(
    useShallow((state) => ({
      activeCategoryId: state.activeCategoryId,
      setActiveCategory: state.setActiveCategory,
    }))
  );

  const { execute } = useUndoableAction();

  const handleAddCategory = () => {
    execute(() => {
      const id = addCategory({ name: 'New Category', color: DEFAULT_CATEGORY_COLOR });
      setActiveCategory(id);
      setEditingId(id);
    });
  };

  const handleUpdateCategory = (id: string, field: 'name' | 'color', value: string) => {
    execute(() => {
      updateCategory(id, { [field]: field === 'name' ? value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH) : value });
    });
  };

  const handleDeleteCategory = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Can't delete if in use or if it's the last category
    const inUse = bins.some(b => b.category === id);
    if (inUse || categories.length <= CONSTRAINTS.CATEGORIES_MIN) return;
    setDeleteConfirm({ id, name });
  };

  const confirmDeleteCategory = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    execute(() => {
      deleteCategory(id);
      if (activeCategoryId === id && categories.length > 1) {
        const remaining = categories.filter(c => c.id !== id);
        setActiveCategory(remaining[0].id);
      }
    });
    setEditingId(null);
    setDeleteConfirm(null);
  };

  const canAddCategory = categories.length < CONSTRAINTS.CATEGORIES_MAX;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-content-secondary tracking-wide" title="Color-code your bins by category. New bins use the selected category.">Categories</h2>
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
      </div>

      <div className="space-y-1">
        {categories.map((category) => {
          const isActive = category.id === activeCategoryId;
          const isEditing = editingId === category.id;
          const inUse = bins.some(b => b.category === category.id);
          const canDelete = !inUse && categories.length > CONSTRAINTS.CATEGORIES_MIN;

          return (
            <div
              key={category.id}
              className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer min-w-0 transition-all ${isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-surface-hover'}`}
              onClick={() => setActiveCategory(category.id)}
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
                          boxShadow: category.color === color ? '0 0 0 2px var(--color-primary)' : 'var(--shadow-sm)',
                        }}
                        title={name}
                        aria-label={`Set color to ${name}`}
                      />
                    ))}
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-2 mt-1">
                    {canDelete && (
                      <button
                        onClick={(e) => handleDeleteCategory(category.id, category.name, e)}
                        className="btn btn-danger btn-sm flex-1 justify-center"
                        aria-label={`Delete ${category.name} category`}
                      >
                        Delete
                      </button>
                    )}
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
                  {/* Selectable button for the category - keyboard accessible */}
                  <button
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    onClick={(e) => { e.stopPropagation(); setActiveCategory(category.id); }}
                    aria-pressed={isActive}
                    aria-label={isActive ? `${category.name} (selected for new bins)` : `Select ${category.name} for new bins`}
                  >
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0 text-sm truncate text-content">
                      {category.name}
                    </span>
                  </button>
                  {/* Edit button - appears on hover */}
                  <button
                    className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-content-tertiary hover:text-content"
                    onClick={(e) => { e.stopPropagation(); setEditingId(category.id); }}
                    title="Edit category"
                    aria-label={`Edit ${category.name}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {isActive && (
                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

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
