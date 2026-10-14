import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorSection } from './InteriorSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '../../../constants';
import { DEFAULT_TRAY_BOTTOM } from '../../../types';
import type { InteriorCard } from '../../../types';

vi.mock('./InteriorModes', () => ({
  InteriorModeContent: ({ card }: { card: InteriorCard }) => (
    <div data-testid={`content-${card}`}>Content</div>
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

  it('offers the four modes as tiles', () => {
    render(<InteriorSection />);

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radiogroup', { name: 'Interior' })).toBeInTheDocument();
  });

  it("shows only the chosen mode's caption and editor", () => {
    render(<InteriorSection />);

    expect(screen.getByRole('radio', { name: 'Grid Dividers' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByTestId('content-standard')).toBeInTheDocument();
    expect(screen.queryByTestId('content-bento')).not.toBeInTheDocument();
  });

  it('calls selectCard when a tile is chosen', () => {
    render(<InteriorSection />);

    fireEvent.click(screen.getByRole('radio', { name: 'Removable Dividers' }));

    expect(mockSelectCard).toHaveBeenCalledWith('slotted');
  });

  it('marks Bento as experimental before it is chosen', () => {
    render(<InteriorSection />);

    const bento = screen.getByRole('radio', { name: /^Bento/ });
    expect(bento).toHaveTextContent('Experimental');
    expect(screen.getByRole('radio', { name: 'Grid Dividers' })).not.toHaveTextContent(
      'Experimental'
    );
  });

  it('selects bento without touching the style', () => {
    render(<InteriorSection />);

    fireEvent.click(screen.getByRole('radio', { name: /^Bento/ }));

    expect(mockSelectCard).toHaveBeenCalledWith('bento');
    expect(mockSetStyle).not.toHaveBeenCalled();
  });

  describe('Removable tile gate', () => {
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

      const removable = screen.getByRole('radio', { name: 'Removable Dividers' });
      expect(removable).toBeEnabled();
      fireEvent.click(removable);
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

      const removable = screen.getByRole('radio', { name: 'Removable Dividers' });
      expect(removable).toBeDisabled();
      expect(removable).toHaveAttribute('title', 'Not available with the lowered Nesting floor');
    });
  });
});
