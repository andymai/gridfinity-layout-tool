import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useInlineEdit } from '@/design-system';
import type { SavedDesign } from '../types';
import { designFootprint } from '../utils/designKind';

interface UseDesignItemOptions {
  design: SavedDesign;
  onSelect: () => void;
  onRename: (newName: string) => void;
  /** Bulk-selection mode: activating toggles selection instead of loading. */
  selectionActive: boolean;
  onToggleSelect?: () => void;
}

export function useDesignItem({
  design,
  onSelect,
  onRename,
  selectionActive,
  onToggleSelect,
}: UseDesignItemOptions) {
  const edit = useInlineEdit({ initialValue: design.name, onSave: onRename });
  const footprint = designFootprint(design);
  const numCompartments = design.params ? new Set(design.params.compartments.cells).size : 0;

  const activate = () => {
    if (selectionActive) onToggleSelect?.();
    else onSelect();
  };

  const handleClick = () => {
    if (!edit.isEditing) activate();
  };

  const handleItemKeyDown = (e: ReactKeyboardEvent) => {
    // Keys from the rename field and the row's buttons bubble here, and so do
    // keys from its menu, which portals out of the row's DOM but not out of
    // its React tree. The field handles its own, so forwarding them saves twice.
    if (e.target !== e.currentTarget) return;
    if (edit.isEditing) {
      edit.handleKeyDown(e);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  return { ...edit, footprint, numCompartments, handleClick, handleItemKeyDown };
}
