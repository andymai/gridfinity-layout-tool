import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NameFieldHighlight } from './NameFieldHighlight';
import { resetAllStores } from '@/test/testUtils';
import { useNameSuggestions, useSuggestionTrigger } from '../../hooks';

// Mock hooks
vi.mock('../../hooks');

// Mock child component
vi.mock('../SuggestionPopover', () => ({
  SuggestionPopover: ({
    isOpen,
    onClose,
  }: {
    anchorRef: React.RefObject<HTMLElement | null>;
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="suggestion-popover">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe('NameFieldHighlight', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(useSuggestionTrigger).mockReturnValue({
      triggerSuggestions: vi.fn(() => Promise.resolve({ primary: null, alternatives: [] })),
    });

    vi.mocked(useNameSuggestions).mockReturnValue({
      showHighlight: false,
      showHighConfidenceInline: false,
      primarySuggestion: null,
      acceptPrimary: vi.fn(),
      collapse: vi.fn(),
    });
  });

  it('renders children without highlight when no suggestions', () => {
    render(
      <NameFieldHighlight>
        <input data-testid="name-input" />
      </NameFieldHighlight>
    );

    expect(screen.getByTestId('name-input')).toBeInTheDocument();
  });

  it('shows highlight when suggestions are available', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      showHighlight: true,
      showHighConfidenceInline: false,
      primarySuggestion: { name: 'Suggested Name', source: 'ai', confidence: 0.6 },
      acceptPrimary: vi.fn(),
      collapse: vi.fn(),
    });

    const { container } = render(
      <NameFieldHighlight>
        <input data-testid="name-input" />
      </NameFieldHighlight>
    );

    const wrapper = container.querySelector('.cursor-pointer');
    expect(wrapper).toBeInTheDocument();
  });

  it('shows experimental badge indicator for low-confidence suggestions', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      showHighlight: true,
      showHighConfidenceInline: false,
      primarySuggestion: { name: 'Suggested Name', source: 'ai', confidence: 0.6 },
      acceptPrimary: vi.fn(),
      collapse: vi.fn(),
    });

    render(
      <NameFieldHighlight>
        <input data-testid="name-input" />
      </NameFieldHighlight>
    );

    const badge = document.querySelector('.bg-accent.rounded-full');
    expect(badge).toBeInTheDocument();
  });

  it('shows inline ghost text for high-confidence suggestions', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      showHighlight: true,
      showHighConfidenceInline: true,
      primarySuggestion: { name: 'High Confidence Name', source: 'ai', confidence: 0.9 },
      acceptPrimary: vi.fn(),
      collapse: vi.fn(),
    });

    render(
      <NameFieldHighlight>
        <input data-testid="name-input" />
      </NameFieldHighlight>
    );

    expect(screen.getByText('High Confidence Name')).toBeInTheDocument();
    expect(screen.getByText('Tab')).toBeInTheDocument();
  });

  it('does not show badge for high-confidence inline mode', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      showHighlight: true,
      showHighConfidenceInline: true,
      primarySuggestion: { name: 'High Confidence Name', source: 'ai', confidence: 0.9 },
      acceptPrimary: vi.fn(),
      collapse: vi.fn(),
    });

    render(
      <NameFieldHighlight>
        <input data-testid="name-input" />
      </NameFieldHighlight>
    );

    const badge = document.querySelector('.bg-accent.rounded-full');
    expect(badge).not.toBeInTheDocument();
  });

  it('shows highlight wrapper when showHighlight is true', () => {
    vi.mocked(useNameSuggestions).mockReturnValue({
      showHighlight: true,
      showHighConfidenceInline: false,
      primarySuggestion: { name: 'Suggested Name', source: 'ai', confidence: 0.6 },
      acceptPrimary: vi.fn(),
      collapse: vi.fn(),
    });

    const { container } = render(
      <NameFieldHighlight>
        <input data-testid="name-input" />
      </NameFieldHighlight>
    );

    const wrapper = container.querySelector('.cursor-pointer');
    expect(wrapper).toBeInTheDocument();
  });
});
