import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteriorSection } from './InteriorSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '../../../constants';
import { DEFAULT_TRAY_BOTTOM } from '../../../types';
import type { InteriorCard } from '../../../types';
import en from '@/i18n/locales/en';

vi.mock('./InteriorModes', () => ({
  InteriorModeContent: ({ card }: { card: InteriorCard }) => (
    <div data-testid={`content-${card}`}>Content</div>
  ),
}));

// Mock the hook
const mockSelectCard = vi.fn();
const mockSetStyle = vi.fn();
const view = vi.hoisted(() => ({ card: 'standard', isDesktop: true }));
vi.mock('./useInteriorSection', () => ({
  useInteriorSection: () => ({
    state: { style: 'standard', card: view.card, isSlotted: false, isSolid: false },
    handlers: { setStyle: mockSetStyle, selectCard: mockSelectCard },
  }),
}));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: view.isDesktop }),
}));

describe('InteriorSection', () => {
  beforeEach(() => {
    mockSelectCard.mockClear();
    mockSetStyle.mockClear();
    view.card = 'standard';
    view.isDesktop = true;
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

  it('plays a clip of the compartment editor beside the Grid Dividers caption', () => {
    render(<InteriorSection />);
    fireEvent.click(screen.getByRole('button', { name: 'See how Grid Dividers works' }));
    expect(screen.getByText(en['binDesigner.featureTip.compartments'])).toBeInTheDocument();
  });

  it('offers the scan clip on Custom Cutouts only where the Cut Editor opens', () => {
    view.card = 'solid';
    const { unmount } = render(<InteriorSection />);
    expect(
      screen.getByRole('button', { name: 'See how Scan with your phone works' })
    ).toBeInTheDocument();
    unmount();

    view.isDesktop = false;
    render(<InteriorSection />);
    expect(screen.queryByRole('button', { name: /^See how/ })).toBeNull();
  });

  it('offers no scan clip while cutouts are withheld', () => {
    const initial = useDesignerStore.getState().params;
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true, lightweightMode: 'interior' },
      },
    });
    view.card = 'solid';
    try {
      render(<InteriorSection />);
      expect(screen.queryByRole('button', { name: /^See how/ })).toBeNull();
    } finally {
      useDesignerStore.setState({ params: initial });
    }
  });

  describe('Removable tile gate', () => {
    const initial = useDesignerStore.getState().params;
    afterEach(() => {
      useDesignerStore.setState({ params: initial });
    });

    it('holds the chosen editor and says why when a custom shape blocks it', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } },
      });
      render(<InteriorSection />);

      expect(screen.getByRole('radio', { name: 'Grid Dividers' })).toBeDisabled();
      expect(screen.getByText('Needs a rectangular footprint.')).toBeInTheDocument();
      expect(screen.getByTestId('content-standard').closest('[inert]')).not.toBeNull();
      expect(screen.getByRole('radio', { name: 'Custom Cutouts' })).toHaveAttribute(
        'tabindex',
        '0'
      );
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
