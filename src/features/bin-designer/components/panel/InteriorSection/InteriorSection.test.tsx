import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorSection } from './InteriorSection';
import type { BinStyle } from '../../../types';

// Mock the card component
vi.mock('./InteriorModeCard', () => ({
  InteriorModeCard: ({
    mode,
    isExpanded,
    onSelect,
    summary,
  }: {
    mode: BinStyle;
    isExpanded: boolean;
    onSelect: () => void;
    summary?: string;
  }) => (
    <div data-testid={`card-${mode}`}>
      <button onClick={onSelect}>Select {mode}</button>
      {isExpanded && <div data-testid={`expanded-${mode}`}>Expanded</div>}
      {summary && <div data-testid={`summary-${mode}`}>{summary}</div>}
    </div>
  ),
}));

// Mock the hook
const mockSetStyle = vi.fn();
vi.mock('./useInteriorSection', () => ({
  useInteriorSection: () => ({
    state: { style: 'standard', isSlotted: false, isSolid: false },
    handlers: { setStyle: mockSetStyle },
    summaries: {
      standard: '1 compartment',
      slotted: 'Removable dividers',
      solid: undefined,
    },
  }),
}));

describe('InteriorSection', () => {
  beforeEach(() => {
    mockSetStyle.mockClear();
  });

  it('renders three mode cards', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('card-standard')).toBeInTheDocument();
    expect(screen.getByTestId('card-slotted')).toBeInTheDocument();
    expect(screen.getByTestId('card-solid')).toBeInTheDocument();
  });

  it('expands the selected card', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('expanded-standard')).toBeInTheDocument();
    expect(screen.queryByTestId('expanded-slotted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expanded-solid')).not.toBeInTheDocument();
  });

  it('passes summary to each card', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('summary-standard')).toHaveTextContent('1 compartment');
    expect(screen.getByTestId('summary-slotted')).toHaveTextContent('Removable dividers');
    expect(screen.queryByTestId('summary-solid')).not.toBeInTheDocument();
  });

  it('calls setStyle when card is selected', () => {
    render(<InteriorSection />);

    fireEvent.click(screen.getByText('Select slotted'));

    expect(mockSetStyle).toHaveBeenCalledWith('slotted');
  });
});
