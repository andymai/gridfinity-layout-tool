import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionPopover } from './SuggestionPopover';
import { resetAllStores } from '@/test/testUtils';
import { createRef } from 'react';
import { useNameSuggestions } from '../../hooks';

// Mock hooks
vi.mock('../../hooks');

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('SuggestionPopover', () => {
  const mockAnchorRef = createRef<HTMLDivElement>();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="anchor"></div>';
    Object.defineProperty(mockAnchorRef, 'current', {
      writable: true,
      value: document.getElementById('anchor'),
    });

    // Default mock
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: null,
      alternatives: [],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });
  });

  it('does not render when not open', () => {
    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen={false} onClose={mockOnClose} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render when no primary suggestion', () => {
    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open and has suggestion', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Suggested Name', source: 'ai', confidence: 0.8 },
      alternatives: [],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays primary suggestion name', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Test Suggestion', source: 'ai', confidence: 0.8 },
      alternatives: [],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    expect(screen.getByText('Test Suggestion')).toBeInTheDocument();
  });

  it('shows source label for primary suggestion', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'AI Suggestion', source: 'ai', confidence: 0.8 },
      alternatives: [],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    expect(screen.getByText('nameSuggestion.source.ai')).toBeInTheDocument();
  });

  it('calls dismiss and onClose when close button clicked', () => {
    const mockDismiss = vi.fn();
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Test', source: 'ai', confidence: 0.8 },
      alternatives: [],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: mockDismiss,
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    fireEvent.click(screen.getByLabelText('common.dismiss'));

    expect(mockDismiss).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls acceptPrimary and onClose when primary suggestion clicked', () => {
    const mockAcceptPrimary = vi.fn();
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Test', source: 'ai', confidence: 0.8 },
      alternatives: [],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: mockAcceptPrimary,
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    fireEvent.click(screen.getByText('Test'));

    expect(mockAcceptPrimary).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading indicator when loading more suggestions', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Test', source: 'ai', confidence: 0.8 },
      alternatives: [],
      showAlternatives: false,
      isLoadingMore: true,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    expect(screen.getByText('nameSuggestion.loadingMore')).toBeInTheDocument();
  });

  it('shows alternatives toggle when alternatives exist', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Test', source: 'ai', confidence: 0.8 },
      alternatives: [
        { name: 'Alt 1', source: 'ai', confidence: 0.6 },
        { name: 'Alt 2', source: 'ai', confidence: 0.5 },
      ],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    expect(screen.getByText(/nameSuggestion.showAlternatives/)).toBeInTheDocument();
  });

  it('expands alternatives when toggle is clicked', () => {
    const mockToggleAlternatives = vi.fn();
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Test', source: 'ai', confidence: 0.8 },
      alternatives: [{ name: 'Alt 1', source: 'ai', confidence: 0.6 }],
      showAlternatives: false,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: mockToggleAlternatives,
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    fireEvent.click(screen.getByText(/nameSuggestion.showAlternatives/));

    expect(mockToggleAlternatives).toHaveBeenCalled();
  });

  it('displays alternatives when expanded', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      primarySuggestion: { name: 'Test', source: 'ai', confidence: 0.8 },
      alternatives: [
        { name: 'Alternative 1', source: 'ai', confidence: 0.6 },
        { name: 'Alternative 2', source: 'ai', confidence: 0.5 },
      ],
      showAlternatives: true,
      isLoadingMore: false,
      acceptPrimary: vi.fn(),
      acceptAlternative: vi.fn(),
      dismiss: vi.fn(),
      toggleAlternatives: vi.fn(),
    });

    render(<SuggestionPopover anchorRef={mockAnchorRef} isOpen onClose={mockOnClose} />);

    expect(screen.getByText('Alternative 1')).toBeInTheDocument();
    expect(screen.getByText('Alternative 2')).toBeInTheDocument();
  });
});
