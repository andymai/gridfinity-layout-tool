import { useTranslation, useFormatting } from '@/i18n';
import { Button, Checkbox, Input, useInlineEdit } from '@/design-system';
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
  onPlaceInLayout?: () => void;
  onDownloadJSON?: () => void;
  onRename: (newName: string) => void;
  onEditTags: () => void;
  onDuplicate: () => void;
  onCreateVariant?: () => void;
  onDelete: () => void;
  onFocus: () => void;
  itemRef: (el: HTMLDivElement | null) => void;
  /** Bulk-selection mode: clicking toggles selection instead of loading. */
  selectionActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  /** 1 when this card is a branch shown under the design it came from. */
  nestLevel?: 0 | 1;
  /** Branches hanging off this card; 0 hides the disclosure entirely. */
  childCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
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
  onPlaceInLayout,
  onDownloadJSON,
  onRename,
  onEditTags,
  onDuplicate,
  onCreateVariant,
  onDelete,
  onFocus,
  itemRef,
  selectionActive = false,
  isSelected = false,
  onToggleSelect,
  nestLevel = 0,
  childCount = 0,
  expanded = false,
  onToggleExpand,
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
        <span className="absolute top-1.5 right-1.5 z-10 rounded bg-accent px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide text-surface">
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
            <Input
              ref={inputRef}
              value={editingValue}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleFinish}
              onKeyDown={handleKeyDown}
              size="sm"
              fullWidth
              wrapperClassName="border-accent"
              className="text-sm"
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
          {nestLevel === 1 && (
            <p className="truncate text-micro text-accent">
              {design.variantOf
                ? t('binDesigner.variants.label')
                : design.parentVersionName
                  ? t('binDesigner.designs.branchedFrom', { name: design.parentVersionName })
                  : t('binDesigner.designs.branchBadge')}
            </p>
          )}
          {/* A card cannot be indented the way a list row can, so the branch count
            doubles as the disclosure: the relationship has to be reachable in
            both view modes or the grid quietly loses half the feature. */}
          {childCount > 0 && onToggleExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              aria-expanded={expanded}
              className="h-auto px-0 py-0 text-micro font-normal text-accent hover:underline"
            >
              {expanded
                ? t('binDesigner.designs.hideBranches')
                : t('binDesigner.designs.branchCount', { count: childCount })}
            </Button>
          )}
          <p className="text-micro text-content-tertiary">{formatRelativeDate(design.updatedAt)}</p>

          {/* Actions - always visible on touch, hover/focus on desktop */}
          <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <DesignActions
              design={design}
              isActive={isActive}
              onLoad={onSelect}
              onPlaceInLayout={onPlaceInLayout}
              onDownloadJSON={onDownloadJSON}
              onRename={startEditing}
              onEditTags={onEditTags}
              onDuplicate={onDuplicate}
              onCreateVariant={onCreateVariant}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
