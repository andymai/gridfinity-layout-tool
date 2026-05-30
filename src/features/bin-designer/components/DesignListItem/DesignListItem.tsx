import { useTranslation, useFormatting } from '@/i18n';
import { useInlineEdit } from '@/shared/hooks';
import { Checkbox } from '@/design-system';
import { BinDesignThumbnail } from '../BinDesignThumbnail';
import { DesignActions } from '../DesignActions';
import { DesignTagChips } from '../DesignTagChips';
import type { SavedDesign } from '../../types';

interface DesignListItemProps {
  design: SavedDesign;
  isActive: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onDownloadJSON: () => void;
  onRename: (newName: string) => void;
  onEditTags: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFocus: () => void;
  itemRef: (el: HTMLLIElement | null) => void;
  /** Bulk-selection mode: clicking toggles selection instead of loading. */
  selectionActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
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
  onEditTags,
  onDuplicate,
  onDelete,
  onFocus,
  itemRef,
  selectionActive = false,
  isSelected = false,
  onToggleSelect,
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

  const activate = () => {
    if (selectionActive) onToggleSelect?.();
    else onSelect();
  };

  const handleClick = () => {
    if (!isEditing) {
      activate();
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      handleKeyDown(e);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
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
          isSelected
            ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
            : isActive
              ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
              : 'border-stroke-subtle hover:bg-surface-hover'
        }
      `}
    >
      {/* Active badge */}
      {isActive && (
        <span className="absolute -top-2 left-3 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface">
          {t('layouts.active')}
        </span>
      )}

      {/* Selection checkbox (bulk mode) */}
      {selectionActive && (
        <div
          role="presentation"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
        >
          <Checkbox
            checked={isSelected}
            aria-label={t('binDesigner.selectDesign', { name: design.name })}
          />
        </div>
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
        {design.tags && design.tags.length > 0 && (
          <div className="mt-1">
            <DesignTagChips tags={design.tags} />
          </div>
        )}
      </div>

      {/* Actions - always visible on touch, hover/focus on desktop */}
      <div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <DesignActions
          design={design}
          isActive={isActive}
          onLoad={onSelect}
          onDownloadJSON={onDownloadJSON}
          onRename={startEditing}
          onEditTags={onEditTags}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}
