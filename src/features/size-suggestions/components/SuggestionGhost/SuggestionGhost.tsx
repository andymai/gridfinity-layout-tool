import { useShallow } from 'zustand/react/shallow';
import { useSizeSuggestionStore } from '../../store';

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

  // Early returns for cases where we don't render
  if (suggestions.length === 0 || isDismissed) {
    return null;
  }

  const topSuggestion = suggestions[0];
  if (!topSuggestion.position) {
    return null;
  }

  // Parse size string (e.g., "2x1" → width=2, depth=1)
  const sizeMatch = topSuggestion.size.match(/^(\d+)x(\d+)$/);
  if (!sizeMatch) {
    return null;
  }

  const width = parseInt(sizeMatch[1], 10);
  const depth = parseInt(sizeMatch[2], 10);

  // Calculate pixel position and dimensions
  const left = topSuggestion.position.x * (cellSize + gap);
  const top = topSuggestion.position.y * (cellSize + gap);
  const pixelWidth = width * cellSize + (width - 1) * gap;
  const pixelHeight = depth * cellSize + (depth - 1) * gap;

  return (
    <div
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 5,
        left: `${left}px`,
        top: `${top}px`,
        width: `${pixelWidth}px`,
        height: `${pixelHeight}px`,
        border: `2px dashed ${categoryColor}`,
        backgroundColor: `${categoryColor}15`,
        borderRadius: '4px',
        transition: 'all 200ms ease-out',
      }}
    />
  );
}
