import { useTranslation, useFormatting } from '@/i18n';
import { useInlineEdit } from '@/shared/hooks';
import { Checkbox } from '@/design-system';
import { BinDesignThumbnail } from '../BinDesignThumbnail';
import { DesignActions } from '../DesignActions';
import { DesignTagChips } from '../DesignTagChips';
import type { SavedDesign } from '../../types';
import { designFootprint } from '../../utils/designKind';

interface DesignGridItemProps {
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
  itemRef: (el: HTMLDivElement | null) => void;
  /** Bulk-selection mode: clicking toggles selection instead of loading. */
  selectionActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
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

  const { width, depth, height } = designFootprint(design);
  const numCompartments = design.params ? new Set(design.params.compartments.cells).size : 0;

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
        cursor-pointer transition-colors outline-none overflow-hidden
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary
        ${
          isSelected
            ? 'border-accent ring-2 ring-accent/40'
            : isActive
              ? 'border-accent'
              : 'border-transparent hover:border-accent/50'
        }
      `}
    >
      {/* Selection checkbox (bulk mode) */}
      {selectionActive && (
        <div
          className="absolute top-1.5 left-1.5 z-10"
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

      {/* Active badge */}
      {isActive && (
        <span className="absolute top-1.5 right-1.5 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-surface">
          {t('layouts.active')}
        </span>
      )}

      {/* Thumbnail area - portrait aspect ratio */}
      <div className="aspect-[3/4] flex items-center justify-center rounded-t-md overflow-hidden bg-surface-elevated">
        {design.thumbnail ? (
          <img
            src={design.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : design.params ? (
          <BinDesignThumbnail params={design.params} size={80} />
        ) : null}
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
          {numCompartments > 1 &&
            ` · ${t('binDesigner.compartmentsShort', { count: numCompartments })}`}
        </p>

        {design.tags && design.tags.length > 0 && (
          <div className="mt-1">
            <DesignTagChips tags={design.tags} />
          </div>
        )}

        {/* Date and actions row — pinned to the bottom so dates align across a
            row regardless of how many tags each card shows */}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <p className="text-[10px] text-content-tertiary">
            {formatRelativeDate(design.updatedAt)}
          </p>

          {/* Actions - always visible on touch, hover/focus on desktop */}
          <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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
        </div>
      </div>
    </div>
  );
}
