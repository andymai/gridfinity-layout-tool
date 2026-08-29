import { useTranslation, useFormatting } from '@/i18n';
import { Checkbox, IconButton, Input, useInlineEdit } from '@/design-system';
import { BinDesignThumbnail } from '../BinDesignThumbnail';
import { DesignActions } from '../DesignActions';
import { DesignTagChips } from '../DesignTagChips';
import type { SavedDesign } from '../../types';
import { designFootprint } from '../../utils/designKind';

interface DesignListItemProps {
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
  itemRef: (el: HTMLLIElement | null) => void;
  /** Bulk-selection mode: clicking toggles selection instead of loading. */
  selectionActive?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  /** 1 when this row is a branch shown under the design it came from. */
  nestLevel?: 0 | 1;
  /** Branches hanging off this row; 0 hides the disclosure entirely. */
  childCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
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
    <li
      ref={itemRef}
      role="option"
      aria-selected={isFocused}
      tabIndex={isFocused ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleItemKeyDown}
      onFocus={onFocus}
      className={`
        group relative flex items-center gap-3 rounded-lg border py-2.5 pr-3
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
      style={{ paddingLeft: nestLevel === 1 ? 34 : 12 }}
    >
      {/* Active badge */}
      {isActive && (
        <span className="absolute -top-2 left-3 rounded bg-accent px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide text-surface">
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

      {/* Disclosure for a design that has branches. Rendered in the row's own
          flow (not absolutely placed) so the indent below cannot overlap it. */}
      {childCount > 0 && onToggleExpand && (
        <IconButton
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-expanded={expanded}
          aria-label={
            expanded ? t('binDesigner.designs.hideBranches') : t('binDesigner.designs.showBranches')
          }
          className="flex-shrink-0 text-content-tertiary"
        >
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </IconButton>
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
        ) : design.params ? (
          <BinDesignThumbnail params={design.params} size={40} />
        ) : null}
      </div>

      {/* Name, dimensions & date */}
      <div className="min-w-0 flex-1">
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
        {/* A variant and a branch are both nested children, so the row has to say
            which: one still follows its parent, the other does not. */}
        {nestLevel === 1 && (
          <p className="truncate text-label text-accent">
            {design.variantOf
              ? t('binDesigner.variants.label')
              : design.parentVersionName
                ? t('binDesigner.designs.branchedFrom', { name: design.parentVersionName })
                : t('binDesigner.designs.branchBadge')}
          </p>
        )}
        {childCount > 0 && (
          <p className="text-label text-content-tertiary">
            {t('binDesigner.designs.branchCount', { count: childCount })}
          </p>
        )}
        <p className="text-label text-content-tertiary">
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
          onPlaceInLayout={onPlaceInLayout}
          onDownloadJSON={onDownloadJSON}
          onRename={startEditing}
          onEditTags={onEditTags}
          onDuplicate={onDuplicate}
          onCreateVariant={onCreateVariant}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}
