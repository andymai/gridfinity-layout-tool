import { useTranslation, useFormatting } from '@/i18n';
import { useInlineEdit } from '@/shared/hooks';
import { BinDesignThumbnail } from './BinDesignThumbnail';
import { DesignActions } from './DesignActions';
import type { SavedDesign } from '../types';

interface DesignListItemProps {
  design: SavedDesign;
  isActive: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onDownloadJSON: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFocus: () => void;
  itemRef: (el: HTMLLIElement | null) => void;
}

/**
 * List view item for a saved design.
 * Shows thumbnail, name, dimensions, compartment count, and actions.
 */
export function DesignListItem({
  design,
  isActive,
  isFocused,
  onSelect,
  onDownloadJSON,
  onRename,
  onDuplicate,
  onDelete,
  onFocus,
  itemRef,
}: DesignListItemProps) {
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
    <li
      ref={itemRef}
      role="option"
      aria-selected={isFocused}
      tabIndex={isFocused ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleItemKeyDown}
      onFocus={onFocus}
      className={`
        group relative flex items-center gap-3 rounded-lg border px-3 py-2.5
        cursor-pointer transition-colors outline-none
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary
        ${
          isActive
            ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
            : 'border-stroke-subtle hover:bg-surface-hover'
        }
      `}
    >
      {/* Active badge */}
      {isActive && (
        <span className="absolute -top-2 left-3 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface">
          {t('binDesigner.active')}
        </span>
      )}

      {/* Thumbnail */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-surface-elevated overflow-hidden">
        {design.thumbnail ? (
          <img
            src={design.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <BinDesignThumbnail params={design.params} size={40} />
        )}
      </div>

      {/* Name, dimensions & date */}
      <div className="min-w-0 flex-1">
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
          <p className="truncate text-sm font-medium text-content">{design.name}</p>
        )}
        <p className="text-xs text-content-secondary">
          {width}×{depth}×{height}u
          {numCompartments > 1 && (
            <span className="ml-1.5 text-content-tertiary">
              · {numCompartments} {t('binDesigner.compartments')}
            </span>
          )}
        </p>
        <p className="text-[11px] text-content-tertiary">
          {formatRelativeDate(design.updatedAt, { includeTime: true })}
        </p>
      </div>

      {/* Actions - always visible on touch, hover/focus on desktop */}
      <div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <DesignActions
          design={design}
          isActive={isActive}
          onLoad={onSelect}
          onDownloadJSON={onDownloadJSON}
          onRename={startEditing}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}
