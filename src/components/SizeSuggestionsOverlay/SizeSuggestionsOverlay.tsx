/**
 * Stable component for rendering size suggestion overlays in the Grid.
 * Separated from the hook to satisfy react-refresh/only-export-components.
 */

import { useCallback } from 'react';
import type { LayerId } from '@/core/types';
import { NextBinPreview, SuggestionGhost } from '@/features/size-suggestions';
import type { SizeSuggestion } from '@/features/size-suggestions/types';

interface SizeSuggestionsOverlayProps {
  cellSize: number;
  gap: number;
  activeLayerId: LayerId;
  activeLayerHeight: number;
  onAccept: (suggestion: SizeSuggestion, layerId: LayerId, layerHeight: number) => void;
  categoryColor: string;
}

export function SizeSuggestionsOverlay({
  cellSize,
  gap,
  activeLayerId,
  activeLayerHeight,
  onAccept,
  categoryColor,
}: SizeSuggestionsOverlayProps) {
  const handleAccept = useCallback(
    (s: SizeSuggestion) => onAccept(s, activeLayerId, activeLayerHeight),
    [onAccept, activeLayerId, activeLayerHeight]
  );

  return (
    <>
      <SuggestionGhost cellSize={cellSize} gap={gap} categoryColor={categoryColor} />
      <NextBinPreview onAccept={handleAccept} categoryColor={categoryColor} />
    </>
  );
}
