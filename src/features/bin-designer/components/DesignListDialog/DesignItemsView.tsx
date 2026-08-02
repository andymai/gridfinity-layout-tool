import { DesignGridItem } from '../DesignGridItem';
import { DesignListItem } from '../DesignListItem';
import type { SavedDesign } from '../../types';

interface DesignItemsViewProps {
  variant: 'grid' | 'list';
  items: readonly SavedDesign[];
  currentDesignId: string | null;
  focusedIndex: number;
  selectionActive: boolean;
  isSelected: (id: string) => boolean;
  onLoad: (design: SavedDesign) => void;
  onDownloadJSON: (design: SavedDesign) => void;
  onRename: (design: SavedDesign, newName: string) => void;
  onEditTags: (design: SavedDesign) => void;
  onDuplicate: (design: SavedDesign) => void;
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
  items,
  currentDesignId,
  focusedIndex,
  selectionActive,
  isSelected,
  onLoad,
  onDownloadJSON,
  onRename,
  onEditTags,
  onDuplicate,
  onDelete,
  onFocus,
  onToggleSelect,
  registerItemRef,
}: DesignItemsViewProps) {
  const commonProps = (design: SavedDesign, index: number) => ({
    design,
    isActive: design.id === currentDesignId,
    isFocused: index === focusedIndex,
    onSelect: () => onLoad(design),
    onDownloadJSON: () => onDownloadJSON(design),
    onRename: (newName: string) => onRename(design, newName),
    onEditTags: () => onEditTags(design),
    onDuplicate: () => onDuplicate(design),
    onDelete: () => onDelete(design),
    onFocus: () => onFocus(index),
    selectionActive,
    isSelected: isSelected(design.id),
    onToggleSelect: () => onToggleSelect(design.id),
  });

  if (variant === 'grid') {
    return (
      <>
        {items.map((design, index) => (
          <DesignGridItem
            key={design.id}
            {...commonProps(design, index)}
            itemRef={(el) => registerItemRef(design.id, el)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {items.map((design, index) => (
        <DesignListItem
          key={design.id}
          {...commonProps(design, index)}
          itemRef={(el) => registerItemRef(design.id, el)}
        />
      ))}
    </>
  );
}
