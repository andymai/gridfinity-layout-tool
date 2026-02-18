import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSizeSuggestionStore } from '../../store';
import { parseSize } from '../../utils/parseSize';

interface SuggestionGhostProps {
  cellSize: number; // pixels per grid unit
  gap: number; // gap between cells in pixels
  categoryColor: string; // hex color
}

/**
 * SuggestionGhost displays a ghost overlay on the grid showing where
 * the suggested bin would be placed. Uses a dashed border and low-opacity fill.
 */
export function SuggestionGhost({ cellSize, gap, categoryColor }: SuggestionGhostProps) {
  const { suggestions, isDismissed } = useSizeSuggestionStore(
    useShallow((state) => ({
      suggestions: state.suggestions,
      isDismissed: state.isDismissed,
    }))
  );

  const topSuggestion = suggestions[0];

  const style = useMemo(() => {
    if (!topSuggestion?.position) return null;

    const dims = parseSize(topSuggestion.size);
    if (!dims) return null;

    const { width, depth } = dims;
    const left = topSuggestion.position.x * (cellSize + gap);
    const top = topSuggestion.position.y * (cellSize + gap);
    const pixelWidth = width * cellSize + Math.max(0, width - 1) * gap;
    const pixelHeight = depth * cellSize + Math.max(0, depth - 1) * gap;

    return {
      position: 'absolute' as const,
      pointerEvents: 'none' as const,
      zIndex: 5,
      left: `${left}px`,
      top: `${top}px`,
      width: `${pixelWidth}px`,
      height: `${pixelHeight}px`,
      border: `2px dashed ${categoryColor}`,
      backgroundColor: `${categoryColor}15`,
      borderRadius: '4px',
      transition: 'all 200ms ease-out',
    };
  }, [topSuggestion, cellSize, gap, categoryColor]);

  if (suggestions.length === 0 || isDismissed || !style) {
    return null;
  }

  return <div style={style} />;
}
