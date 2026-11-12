import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CATEGORY_COLOR_PALETTE, DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { relativeLuminance, luminanceContrast } from '@/shared/utils/color';
import { BinOverBedChip } from './BinOverBedChip';

describe('BinOverBedChip', () => {
  it('names a split with a warning mark', () => {
    render(<BinOverBedChip bedFit="split" fontSize={10} />);
    const chip = screen.getByTitle('Exceeds print size, will be split');
    expect(chip).toHaveTextContent('Split');
    expect(chip).toHaveTextContent('⚠');
  });

  it('names a bin kept in one piece', () => {
    render(<BinOverBedChip bedFit="keptWhole" fontSize={10} />);
    expect(screen.getByTitle('Exceeds print size, prints in one piece')).toHaveTextContent(
      'Oversized'
    );
  });

  it('shows only the mark when the bin has no room for the word', () => {
    render(<BinOverBedChip bedFit="split" fontSize={10} iconOnly />);
    const chip = screen.getByLabelText('Exceeds print size, will be split');
    expect(chip).not.toHaveTextContent('Split');
    expect(chip).toHaveTextContent('⚠');
  });

  // The chip sits on the bin's category colour, which can be any colour. The
  // overlay tone paints its own dark ground, so the text never meets the bin.
  it('paints its own ground and text, and never the warning colour', () => {
    render(<BinOverBedChip bedFit="split" fontSize={10} />);
    const chip = screen.getByTitle('Exceeds print size, will be split');
    expect(chip).toHaveClass('bg-black/70', 'text-white');
    expect(chip.style.color).toBe('');
    expect(chip.style.backgroundColor).toBe('');
  });

  it('keeps white text at 4.5:1 on black at 70% over any colour', () => {
    const channel = (hex: string, i: number): number =>
      parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    const under = [
      ...CATEGORY_COLOR_PALETTE.map((c) => c.color),
      DEFAULT_CATEGORY_COLOR,
      '#ffffff',
      '#000000',
    ];
    for (const hex of under) {
      const [r, g, b] = [0, 1, 2].map((i) => (channel(hex, i) * 0.3) / 255);
      const ratio = luminanceContrast(relativeLuminance(1, 1, 1), relativeLuminance(r, g, b));
      expect(ratio, hex).toBeGreaterThanOrEqual(4.5);
    }
  });
});
