import { useSelectionStore } from '@/core/store/selection';
import { useMobileStore } from '@/core/store';
import type { CategoryId } from '@/core/types';
import { CONSTRAINTS, CATEGORY_COLOR_PALETTE } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button, IconButton, PlusIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useCategoryManager } from '@/features/categories/hooks/useCategoryManager';

/**
 * Mobile-optimized categories panel with large touch targets.
 */
export function MobileCategoriesPanel() {
  const t = useTranslation();
  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);
  const selectedBinIds = useSelectionStore((state) => state.selectedBinIds);

  const {
    categories,
    binCounts,
    activeCategoryId,
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
  } = useCategoryManager({ onAfterSelect: closeMobilePanel });

  const handleUpdateColor = (id: CategoryId, color: string) => {
    updateCategoryField(id, 'color', color);
  };

  const handleUpdateName = (id: CategoryId, name: string) => {
    updateCategoryField(id, 'name', name);
  };

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
                    {CATEGORY_COLOR_PALETTE.map(({ color, nameKey }) => (
                      <IconButton
                        key={color}
                        size="lg"
                        touchTarget={false}
                        onClick={() => handleUpdateColor(category.id, color)}
                        className="w-10 h-10 rounded-lg transition-transform active:scale-95"
                        style={{
                          backgroundColor: color,
                          boxShadow:
                            category.color === color
                              ? '0 0 0 3px var(--color-primary)'
                              : 'var(--shadow-sm)',
                        }}
                        aria-label={t(nameKey)}
                      >
                        <span />
                      </IconButton>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant={canDelete ? 'danger' : 'secondary'}
                      fullWidth
                      onClick={() => requestDelete(category.id, category.name)}
                      className={`flex-1 ${canDelete ? '' : 'opacity-50'}`}
                    >
                      {t('common.delete')}
                      {binCount > 0 ? ` (${binCount} bins)` : ''}
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => setEditingId(null)}
                      className="flex-1"
                    >
                      {t('common.done')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  fullWidth
                  className="p-4 flex items-center gap-3 justify-start rounded-none hover:bg-transparent"
                  onClick={() => selectCategory(category.id, category.name)}
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
                  <IconButton
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(category.id);
                    }}
                    className="w-10 h-10"
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
                  </IconButton>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add category button */}
      <Button
        variant="primary"
        fullWidth
        onClick={addCategory}
        disabled={!canAddCategory}
        className="mt-4"
        leftIcon={<PlusIcon />}
      >
        {t('categories.addCategory')}
      </Button>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={t('categories.confirmDelete.title')}
        message={t('categories.confirmDelete.message', { name: deleteConfirm?.name || '' })}
        confirmText={t('categories.confirmDelete.confirm')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
