import { useLayoutStore, useUIStore } from '@/core/store';
import { BinContextMenu } from './BinContextMenu';
import { MultiBinContextMenu } from './MultiBinContextMenu';

export interface BinContextMenuWrapperProps {
  binIds: string[];
  position: { x: number; y: number };
  onClose: () => void;
  source?: 'grid' | 'staging';
}

/**
 * Context menu wrapper that routes to single or multi-bin menu.
 *
 * Handles the logic of determining whether to show a single-bin or multi-bin
 * context menu based on the current selection state.
 *
 * - If the right-clicked bin is part of a multi-selection, shows MultiBinContextMenu
 * - Otherwise, shows the single BinContextMenu for the clicked bin
 */
export function BinContextMenuWrapper({
  binIds,
  position,
  onClose,
  source,
}: BinContextMenuWrapperProps) {
  const bins = useLayoutStore((state) => state.layout.bins);
  const selectedBinIds = useUIStore((state) => state.selectedBinIds);

  // Guard: ensure binIds is valid
  if (!binIds || binIds.length === 0) return null;

  // Multi-select detection: if first bin is selected AND multiple bins selected
  const isMultiSelect = selectedBinIds.includes(binIds[0]) && selectedBinIds.length > 1;

  if (isMultiSelect) {
    const selectedBins = bins.filter((b) => selectedBinIds.includes(b.id));
    return (
      <MultiBinContextMenu
        binIds={selectedBins.map((b) => b.id)}
        position={position}
        onClose={onClose}
        source={source}
      />
    );
  }

  // Single bin context menu
  const bin = bins.find((b) => b.id === binIds[0]);
  if (!bin) return null;

  return <BinContextMenu bin={bin} position={position} onClose={onClose} source={source} />;
}
