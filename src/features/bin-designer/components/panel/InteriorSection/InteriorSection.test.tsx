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
  }: {
    mode: BinStyle;
    isExpanded: boolean;
    onSelect: () => void;
  }) => (
    <div data-testid={`card-${mode}`}>
      <button onClick={onSelect}>Select {mode}</button>
      {isExpanded && <div data-testid={`expanded-${mode}`}>Expanded</div>}
    </div>
  ),
}));

// Mock the hook
const mockSetStyle = vi.fn();
vi.mock('./useInteriorSection', () => ({
  useInteriorSection: () => ({
    state: { style: 'standard', isSlotted: false, isSolid: false },
    handlers: { setStyle: mockSetStyle },
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

  it('calls setStyle when card is selected', () => {
    render(<InteriorSection />);

    fireEvent.click(screen.getByText('Select slotted'));

    expect(mockSetStyle).toHaveBeenCalledWith('slotted');
  });
});
