import type { BinId } from '@/core/types';
import { useShallow } from 'zustand/react/shallow';
import { useSelectionStore } from '@/core/store';

export interface BinSelectionResult {
  selectedBinIds: readonly BinId[];
  focusedBinId: BinId | null;
  setSelectedBin: (binId: BinId) => void;
  toggleSelection: (binId: BinId) => void;
  setFocusedBin: (binId: BinId | null) => void;
  showQuickLabel: (binId: BinId) => void;
}

/**
 * Hook that reads selection store state and actions for a bin.
 * Centralizes all selection-related store access.
 */
export function useBinSelection(): BinSelectionResult {
  const { selectedBinIds, focusedBinId } = useSelectionStore(
    useShallow((state) => ({
      selectedBinIds: state.selectedBinIds,
      focusedBinId: state.focusedBinId,
    }))
  );

  const setSelectedBin = useSelectionStore((state) => state.setSelectedBin);
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);
  const setFocusedBin = useSelectionStore((state) => state.setFocusedBin);
  const showQuickLabel = useSelectionStore((state) => state.showQuickLabel);

  return {
    selectedBinIds,
    focusedBinId,
    setSelectedBin,
    toggleSelection,
    setFocusedBin,
    showQuickLabel,
  };
}
