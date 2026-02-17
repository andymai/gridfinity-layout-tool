import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SuggestionGhost } from './SuggestionGhost';
import { useSizeSuggestionStore } from '../../store';

describe('SuggestionGhost', () => {
  beforeEach(() => {
    useSizeSuggestionStore.getState().reset();
  });

  it('should render nothing when no suggestions', () => {
    const { container } = render(<SuggestionGhost cellSize={50} gap={2} categoryColor="#4f46e5" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render ghost at correct position', () => {
    useSizeSuggestionStore
      .getState()
      .setSuggestions([
        { size: '2x1', score: 0.8, position: { x: 1, y: 2 }, positionSource: 'gap_fill' },
      ]);
    const { container } = render(<SuggestionGhost cellSize={50} gap={2} categoryColor="#4f46e5" />);
    const ghost = container.firstChild as HTMLElement;
    expect(ghost).toBeTruthy();
    expect(ghost.style.left).toBe('52px'); // 1 * (50 + 2)
    expect(ghost.style.top).toBe('104px'); // 2 * (50 + 2)
    expect(ghost.style.width).toBe('102px'); // 2 * 50 + 1 * 2
    expect(ghost.style.height).toBe('50px'); // 1 * 50 + 0 * 2
  });

  it('should render nothing when dismissed', () => {
    useSizeSuggestionStore
      .getState()
      .setSuggestions([
        { size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
      ]);
    useSizeSuggestionStore.getState().dismiss();
    const { container } = render(<SuggestionGhost cellSize={50} gap={2} categoryColor="#4f46e5" />);
    expect(container.firstChild).toBeNull();
  });
});
