import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorSection } from './InteriorSection';
import type { InteriorCard } from '../../../types';

vi.mock('./InteriorModeCard', () => ({
  InteriorModeCard: ({
    card,
    isExpanded,
    onSelect,
  }: {
    card: InteriorCard;
    isExpanded: boolean;
    onSelect: () => void;
  }) => (
    <div data-testid={`card-${card}`}>
      <button onClick={onSelect}>Select {card}</button>
      {isExpanded && <div data-testid={`expanded-${card}`}>Expanded</div>}
    </div>
  ),
}));

// Mock the hook
const mockSelectCard = vi.fn();
const mockSetStyle = vi.fn();
vi.mock('./useInteriorSection', () => ({
  useInteriorSection: () => ({
    state: { style: 'standard', card: 'standard', isSlotted: false, isSolid: false },
    handlers: { setStyle: mockSetStyle, selectCard: mockSelectCard },
  }),
}));

describe('InteriorSection', () => {
  beforeEach(() => {
    mockSelectCard.mockClear();
    mockSetStyle.mockClear();
  });

  it('renders four mode cards', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('card-standard')).toBeInTheDocument();
    expect(screen.getByTestId('card-bento')).toBeInTheDocument();
    expect(screen.getByTestId('card-slotted')).toBeInTheDocument();
    expect(screen.getByTestId('card-solid')).toBeInTheDocument();
  });

  it('expands the selected card', () => {
    render(<InteriorSection />);

    expect(screen.getByTestId('expanded-standard')).toBeInTheDocument();
    expect(screen.queryByTestId('expanded-bento')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expanded-slotted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expanded-solid')).not.toBeInTheDocument();
  });

  it('calls selectCard when card is selected', () => {
    render(<InteriorSection />);

    fireEvent.click(screen.getByText('Select slotted'));

    expect(mockSelectCard).toHaveBeenCalledWith('slotted');
  });

  it('selects bento without touching the style', () => {
    render(<InteriorSection />);

    fireEvent.click(screen.getByText('Select bento'));

    expect(mockSelectCard).toHaveBeenCalledWith('bento');
  });
});
