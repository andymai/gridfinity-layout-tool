import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextBinPreview } from './NextBinPreview';
import { useSizeSuggestionStore } from '../../store';
import type { SizeSuggestion } from '../../types';

// Mock the i18n hook
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'sizeSuggestion.next') return 'Next';
    if (key === 'sizeSuggestion.useSize') return `Use suggested size: ${vars?.size}`;
    if (key === 'sizeSuggestion.dismiss') return 'Dismiss';
    return key;
  },
}));

describe('NextBinPreview', () => {
  const mockOnAccept = vi.fn();
  const categoryColor = '#3b82f6';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useSizeSuggestionStore.setState({
      suggestions: [],
      isDismissed: false,
    });
  });

  it('renders nothing when no suggestions', () => {
    const { container } = render(
      <NextBinPreview onAccept={mockOnAccept} categoryColor={categoryColor} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when isDismissed is true', () => {
    const suggestion: SizeSuggestion = {
      size: '2x1',
      score: 0.9,
      position: { x: 0, y: 0 },
      positionSource: 'gap_fill',
    };

    useSizeSuggestionStore.setState({
      suggestions: [suggestion],
      isDismissed: true,
    });

    const { container } = render(
      <NextBinPreview onAccept={mockOnAccept} categoryColor={categoryColor} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when top suggestion has no position', () => {
    const suggestion: SizeSuggestion = {
      size: '2x1',
      score: 0.9,
      position: null,
      positionSource: 'none',
    };

    useSizeSuggestionStore.setState({
      suggestions: [suggestion],
      isDismissed: false,
    });

    const { container } = render(
      <NextBinPreview onAccept={mockOnAccept} categoryColor={categoryColor} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders suggestion with "Next" header and formatted size', () => {
    const suggestion: SizeSuggestion = {
      size: '2x1',
      score: 0.9,
      position: { x: 0, y: 0 },
      positionSource: 'gap_fill',
    };

    useSizeSuggestionStore.setState({
      suggestions: [suggestion],
      isDismissed: false,
    });

    render(<NextBinPreview onAccept={mockOnAccept} categoryColor={categoryColor} />);

    expect(screen.getByText('Next')).toBeDefined();
    expect(screen.getByText('2 × 1')).toBeDefined();
  });

  it('calls onAccept when suggestion is clicked', () => {
    const suggestion: SizeSuggestion = {
      size: '2x1',
      score: 0.9,
      position: { x: 0, y: 0 },
      positionSource: 'gap_fill',
    };

    useSizeSuggestionStore.setState({
      suggestions: [suggestion],
      isDismissed: false,
    });

    render(<NextBinPreview onAccept={mockOnAccept} categoryColor={categoryColor} />);

    const acceptButton = screen.getByRole('button', {
      name: /Use suggested size: 2 × 1/,
    });
    fireEvent.click(acceptButton);

    expect(mockOnAccept).toHaveBeenCalledWith(suggestion);
    expect(mockOnAccept).toHaveBeenCalledTimes(1);
  });

  it('hides when dismiss button is clicked', () => {
    const suggestion: SizeSuggestion = {
      size: '2x1',
      score: 0.9,
      position: { x: 0, y: 0 },
      positionSource: 'gap_fill',
    };

    useSizeSuggestionStore.setState({
      suggestions: [suggestion],
      isDismissed: false,
    });

    const { container, rerender } = render(
      <NextBinPreview onAccept={mockOnAccept} categoryColor={categoryColor} />
    );

    // Initially visible
    expect(screen.getByText('Next')).toBeDefined();

    // Click dismiss
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButton);

    // Re-render to reflect state change
    rerender(<NextBinPreview onAccept={mockOnAccept} categoryColor={categoryColor} />);

    // Should be hidden now
    expect(container.firstChild).toBeNull();
  });
});
