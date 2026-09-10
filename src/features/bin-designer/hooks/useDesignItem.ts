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
    // The rename input handles its own keys; the bubbled event must not commit again.
    if (edit.isEditing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  return { ...edit, footprint, numCompartments, handleClick, handleItemKeyDown };
}
