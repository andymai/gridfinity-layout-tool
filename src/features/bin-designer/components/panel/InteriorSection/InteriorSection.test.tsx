import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorSection } from './InteriorSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '../../../constants';
import { DEFAULT_TRAY_BOTTOM } from '../../../types';
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

  describe('Removable card gate', () => {
    const initial = useDesignerStore.getState().params;
    afterEach(() => {
      useDesignerStore.setState({ params: initial });
    });

    it('stays clickable while Solid is the current style', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          style: 'solid',
          base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        },
      });
      render(<InteriorSection />);

      expect(screen.getByTestId('card-slotted').closest('[inert]')).toBeNull();
      fireEvent.click(screen.getByText('Select slotted'));
      expect(mockSelectCard).toHaveBeenCalledWith('slotted');
    });

    it('is gated on a Nesting body, with the floor reason', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            style: 'lid',
            trayBottom: { ...DEFAULT_TRAY_BOTTOM, floorAtBed: true },
          },
        },
      });
      render(<InteriorSection />);

      const gate = screen.getByTestId('card-slotted').closest('[inert]');
      expect(gate).not.toBeNull();
      expect(gate).toHaveAttribute('title', 'Not available with the lowered Nesting floor');
    });
  });
});
