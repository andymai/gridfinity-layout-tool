import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplitPreview } from '@/shell/Print/SplitPreview';
import type { PrintPiece } from '@/core/types';
import { gridUnits } from '@/core/types';
import { splitBinSize } from '@/features/print-export/utils/split';

describe('SplitPreview', () => {
  const piece = (width: number, depth: number, count = 1): PrintPiece => ({
    width: gridUnits(width),
    depth: gridUnits(depth),
    count,
  });

  function boxes(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[class*="absolute"]'));
  }

  describe('rendering', () => {
    it('draws one box per piece, each labelled with its size', () => {
      const { container } = render(<SplitPreview width={4} depth={4} pieces={[piece(2, 2, 4)]} />);
      expect(boxes(container)).toHaveLength(4);
      expect(screen.getAllByText('2×2')).toHaveLength(4);
    });

    it('renders container with correct size', () => {
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={[piece(2, 2, 4)]} cellSize={16} gap={2} />
      );
      const preview = container.firstChild as HTMLElement;
      // 4 * 16 + 3 * 2 = 70px
      expect(preview.style.width).toBe('70px');
      expect(preview.style.height).toBe('70px');
    });

    it('renders nothing when there are no pieces', () => {
      const { container } = render(<SplitPreview width={4} depth={4} pieces={[]} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('piece placement', () => {
    it('lays the pieces out as a grid from the bottom-left', () => {
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={[piece(2, 2, 4)]} cellSize={16} gap={2} />
      );
      const placed = boxes(container).map((b) => [b.style.left, b.style.bottom]);
      // One pitch of 2 units is 2 * (16 + 2) = 36px.
      expect(placed).toEqual([
        ['0px', '0px'],
        ['36px', '0px'],
        ['0px', '36px'],
        ['36px', '36px'],
      ]);
    });

    it('sizes each box from the piece, not the cell count', () => {
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={[piece(2, 2, 4)]} cellSize={20} gap={4} />
      );
      // 2 * 20 + 1 * 4 = 44px
      expect(boxes(container)[0].style.width).toBe('44px');
    });
  });

  // The split cuts a bin into equal pieces, which for an odd count means
  // thirds. The old greedy packer only tried whole-cell origins, so the last
  // third had nowhere left to go and vanished from the diagram while the count
  // beside it still said three.
  describe('fractional pieces', () => {
    it('draws every piece of a three-way split', () => {
      const pieces = splitBinSize(10, 1, 4);
      const { container } = render(<SplitPreview width={10} depth={1} pieces={pieces} />);
      expect(pieces[0].count).toBe(3);
      expect(boxes(container)).toHaveLength(3);
    });

    it('draws every piece of a half-grid split', () => {
      const pieces = splitBinSize(1.5, 1.5, 1);
      const { container } = render(<SplitPreview width={1.5} depth={1.5} pieces={pieces} />);
      expect(pieces[0].count).toBe(4);
      expect(boxes(container)).toHaveLength(4);
    });

    it('draws a single unsplit piece', () => {
      const pieces = splitBinSize(2.5, 2.5, 4);
      const { container } = render(<SplitPreview width={2.5} depth={2.5} pieces={pieces} />);
      expect(boxes(container)).toHaveLength(1);
      expect(screen.getByText('2.5×2.5')).toBeInTheDocument();
    });
  });
});
