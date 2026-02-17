import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SizeSuggestionsOverlay } from './SizeSuggestionsOverlay';
import type { LayerId } from '@/core/types';

vi.mock('@/features/size-suggestions', () => ({
  NextBinPreview: ({ onAccept }: { onAccept: () => void }) => (
    <div data-testid="next-bin-preview" onClick={onAccept} />
  ),
  SuggestionGhost: ({ cellSize, gap }: { cellSize: number; gap: number }) => (
    <div data-testid="suggestion-ghost" data-cell-size={cellSize} data-gap={gap} />
  ),
}));

const mockLayerId = 'test-layer' as unknown as LayerId;

describe('SizeSuggestionsOverlay', () => {
  it('renders ghost and preview components', () => {
    const { getByTestId } = render(
      <SizeSuggestionsOverlay
        cellSize={40}
        gap={2}
        activeLayerId={mockLayerId}
        activeLayerHeight={1}
        onAccept={vi.fn()}
        categoryColor="#6366f1"
      />
    );

    expect(getByTestId('suggestion-ghost')).toBeDefined();
    expect(getByTestId('next-bin-preview')).toBeDefined();
  });

  it('passes cellSize and gap to ghost', () => {
    const { getByTestId } = render(
      <SizeSuggestionsOverlay
        cellSize={40}
        gap={2}
        activeLayerId={mockLayerId}
        activeLayerHeight={1}
        onAccept={vi.fn()}
        categoryColor="#6366f1"
      />
    );

    const ghost = getByTestId('suggestion-ghost');
    expect(ghost.dataset.cellSize).toBe('40');
    expect(ghost.dataset.gap).toBe('2');
  });
});
