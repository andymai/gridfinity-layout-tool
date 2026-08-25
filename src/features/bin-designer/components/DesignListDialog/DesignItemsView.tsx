import { DesignGridItem } from '../DesignGridItem';
import { DesignListItem } from '../DesignListItem';
import { isLayoutPlaceableDesign } from '@/features/bin-designer/utils/designKind';
import type { SavedDesign } from '../../types';
import type { LineageRow } from './designLineage';

interface DesignItemsViewProps {
  variant: 'grid' | 'list';
  /** Already flattened by `groupByLineage`, so index-based navigation is unchanged. */
  rows: readonly LineageRow[];
  expandedIds: ReadonlySet<string>;
  onToggleExpand: (id: string) => void;
  currentDesignId: string | null;
  focusedIndex: number;
  selectionActive: boolean;
  isSelected: (id: string) => boolean;
  onLoad: (design: SavedDesign) => void;
  onPlaceInLayout: (design: SavedDesign) => void;
  onDownloadJSON: (design: SavedDesign) => void;
  onRename: (design: SavedDesign, newName: string) => void;
  onEditTags: (design: SavedDesign) => void;
  onDuplicate: (design: SavedDesign) => void;
  onCreateVariant: (design: SavedDesign) => void;
  onDelete: (design: SavedDesign) => void;
  onFocus: (index: number) => void;
  onToggleSelect: (id: string) => void;
  registerItemRef: (id: string, el: HTMLDivElement | HTMLLIElement | null) => void;
}

/**
 * Renders the saved-design items for either the grid or list view. Both
 * variants share identical per-item wiring; only the item component and its
 * `itemRef` element type differ.
 */
export function DesignItemsView({
  variant,
  rows,
  expandedIds,
  onToggleExpand,
  currentDesignId,
  focusedIndex,
  selectionActive,
  isSelected,
  onLoad,
  onPlaceInLayout,
  onDownloadJSON,
  onRename,
  onEditTags,
  onDuplicate,
  onCreateVariant,
  onDelete,
  onFocus,
  onToggleSelect,
  registerItemRef,
}: DesignItemsViewProps) {
  const commonProps = (row: LineageRow, index: number) => ({
    design: row.design,
    nestLevel: row.depth,
    childCount: row.childCount,
    expanded: expandedIds.has(String(row.design.id)),
    onToggleExpand: () => onToggleExpand(String(row.design.id)),
    ...rowProps(row.design, index),
  });

  const rowProps = (design: SavedDesign, index: number) => ({
    isActive: design.id === currentDesignId,
    isFocused: index === focusedIndex,
    onSelect: () => onLoad(design),
    onPlaceInLayout: isLayoutPlaceableDesign(design) ? () => onPlaceInLayout(design) : undefined,
    onDownloadJSON: design.params ? () => onDownloadJSON(design) : undefined,
    onRename: (newName: string) => onRename(design, newName),
    onEditTags: () => onEditTags(design),
    onDuplicate: () => onDuplicate(design),
    // Only a bin design that is not already a variant: a variant of a variant
    // would need a propagation chain, and a non-bin has no overridable params.
    onCreateVariant: design.params && !design.variantOf ? () => onCreateVariant(design) : undefined,
    onDelete: () => onDelete(design),
    onFocus: () => onFocus(index),
    selectionActive,
    isSelected: isSelected(design.id),
    onToggleSelect: () => onToggleSelect(design.id),
  });

  if (variant === 'grid') {
    return (
      <>
        {rows.map((row, index) => (
          <DesignGridItem
            key={row.design.id}
            {...commonProps(row, index)}
            itemRef={(el) => registerItemRef(row.design.id, el)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {rows.map((row, index) => (
        <DesignListItem
          key={row.design.id}
          {...commonProps(row, index)}
          itemRef={(el) => registerItemRef(row.design.id, el)}
        />
      ))}
    </>
  );
}
