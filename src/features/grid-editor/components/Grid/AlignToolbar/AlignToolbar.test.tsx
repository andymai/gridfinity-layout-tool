import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlignToolbar } from './AlignToolbar';
import { binId } from '@/core/types';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('AlignToolbar', () => {
  const mockOnAlign = vi.fn();
  const selectedBinIds = [binId('a'), binId('b')];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock bin DOM elements for positioning
    for (const id of selectedBinIds) {
      const el = document.createElement('div');
      el.setAttribute('data-bin-id', id);
      el.getBoundingClientRect = () => ({
        top: 100,
        bottom: 150,
        left: 200,
        right: 300,
        width: 100,
        height: 50,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      });
      document.body.appendChild(el);
    }
  });

  it('renders toolbar with 4 alignment buttons', () => {
    render(<AlignToolbar selectedBinIds={selectedBinIds} onAlign={mockOnAlign} />);

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });

  it('renders correct aria-labels for each button', () => {
    render(<AlignToolbar selectedBinIds={selectedBinIds} onAlign={mockOnAlign} />);

    expect(screen.getByLabelText('commandPalette.alignLeft')).toBeInTheDocument();
    expect(screen.getByLabelText('commandPalette.alignTop')).toBeInTheDocument();
    expect(screen.getByLabelText('commandPalette.alignBottom')).toBeInTheDocument();
    expect(screen.getByLabelText('commandPalette.alignRight')).toBeInTheDocument();
  });

  it('calls onAlign with correct edge when buttons are clicked', () => {
    render(<AlignToolbar selectedBinIds={selectedBinIds} onAlign={mockOnAlign} />);

    fireEvent.click(screen.getByLabelText('commandPalette.alignLeft'));
    expect(mockOnAlign).toHaveBeenCalledWith('left');

    fireEvent.click(screen.getByLabelText('commandPalette.alignTop'));
    expect(mockOnAlign).toHaveBeenCalledWith('top');

    fireEvent.click(screen.getByLabelText('commandPalette.alignRight'));
    expect(mockOnAlign).toHaveBeenCalledWith('right');

    fireEvent.click(screen.getByLabelText('commandPalette.alignBottom'));
    expect(mockOnAlign).toHaveBeenCalledWith('bottom');
  });

  it('uses fixed positioning', () => {
    render(<AlignToolbar selectedBinIds={selectedBinIds} onAlign={mockOnAlign} />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveClass('fixed');
  });
});
