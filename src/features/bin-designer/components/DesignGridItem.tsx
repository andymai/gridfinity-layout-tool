import { useTranslation, useFormatting } from '@/i18n';
import { useInlineEdit } from '@/shared/hooks';
import { BinDesignThumbnail } from './BinDesignThumbnail';
import { DesignActions } from './DesignActions';
import type { SavedDesign } from '../types';

interface DesignGridItemProps {
  design: SavedDesign;
  isActive: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFocus: () => void;
  itemRef: (el: HTMLDivElement | null) => void;
}

/**
 * Grid view card for a saved design.
 * Shows isometric thumbnail, name, metadata, and actions.
 * Portrait aspect ratio (3:4) matching the layout modal grid.
 */
export function DesignGridItem({
  design,
  isActive,
  isFocused,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onFocus,
  itemRef,
}: DesignGridItemProps) {
  const t = useTranslation();
  const { formatRelativeDate } = useFormatting();

  const {
    isEditing,
    editingValue,
    inputRef,
    startEditing,
    handleChange,
    handleFinish,
    handleKeyDown,
  } = useInlineEdit({
    initialValue: design.name,
    onSave: onRename,
  });

  const { width, depth, height, compartments } = design.params;
  const numCompartments = new Set(compartments.cells).size;

  const handleClick = () => {
    if (!isEditing) {
      onSelect();
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      handleKeyDown(e);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isFocused}
      tabIndex={isFocused ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleItemKeyDown}
      onFocus={onFocus}
      className={`
        group relative flex flex-col rounded-lg border-2
        cursor-pointer transition-all outline-none overflow-hidden
        hover:scale-[1.02] hover:shadow-md
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary
        ${isActive ? 'border-accent' : 'border-transparent hover:border-accent/50'}
      `}
    >
      {/* Active badge */}
      {isActive && (
        <span className="absolute top-1.5 right-1.5 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface">
          {t('binDesigner.active')}
        </span>
      )}

      {/* Thumbnail area - portrait aspect ratio */}
      <div className="aspect-[3/4] flex items-center justify-center bg-surface-elevated rounded-t-md">
        <BinDesignThumbnail params={design.params} size={80} />
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col p-2.5 bg-surface-secondary">
        {/* Name with inline edit */}
        <div className="min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editingValue}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleFinish}
              onKeyDown={handleKeyDown}
              className="w-full rounded border border-accent bg-surface px-1.5 py-0.5 text-sm text-content outline-none"
              aria-label={t('binDesigner.designName')}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-sm font-medium text-content line-clamp-1" title={design.name}>
              {design.name}
            </p>
          )}
        </div>

        {/* Metadata */}
        <p className="text-xs text-content-secondary mt-0.5">
          {width}×{depth}×{height}u
          {numCompartments > 1 && ` · ${numCompartments} comp.`}
        </p>

        {/* Date and actions row */}
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-content-tertiary">
            {formatRelativeDate(design.updatedAt)}
          </p>

          {/* Actions - always visible on touch, hover/focus on desktop */}
          <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <DesignActions
              design={design}
              isActive={isActive}
              onLoad={onSelect}
              onRename={startEditing}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
