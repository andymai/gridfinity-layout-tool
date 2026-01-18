import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplitPreview } from '@/components/Print/SplitPreview';
import type { PrintPiece } from '@/core/types';

describe('SplitPreview', () => {
  const createPiece = (width: number, depth: number, count = 1): PrintPiece => ({
    width,
    depth,
    count,
    height: 3,
    filament: 10,
    printTime: 1,
    cost: 0.5,
    isOversized: false,
  });

  describe('rendering', () => {
    it('renders pieces with correct dimensions', () => {
      const pieces = [createPiece(2, 2)];
      render(<SplitPreview width={4} depth={4} pieces={pieces} />);

      expect(screen.getByText('2×2')).toBeInTheDocument();
    });

    it('renders multiple different pieces', () => {
      const pieces = [createPiece(2, 2), createPiece(1, 1)];
      render(<SplitPreview width={4} depth={4} pieces={pieces} />);

      expect(screen.getByText('2×2')).toBeInTheDocument();
      expect(screen.getByText('1×1')).toBeInTheDocument();
    });

    it('renders multiple copies of the same piece', () => {
      const pieces = [createPiece(2, 2, 2)];
      render(<SplitPreview width={4} depth={4} pieces={pieces} />);

      // Should show two 2×2 pieces
      const labels = screen.getAllByText('2×2');
      expect(labels).toHaveLength(2);
    });

    it('renders container with correct size', () => {
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={[]} cellSize={16} gap={2} />
      );

      const preview = container.firstChild as HTMLElement;
      // Width: 4 * 16 + 3 * 2 = 70px
      // Height: 4 * 16 + 3 * 2 = 70px
      expect(preview.style.width).toBe('70px');
      expect(preview.style.height).toBe('70px');
    });
  });

  describe('piece placement', () => {
    it('places pieces from bottom-left', () => {
      const pieces = [createPiece(2, 2)];
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={pieces} cellSize={16} gap={2} />
      );

      const piece = container.querySelector('[class*="absolute"]') as HTMLElement;
      expect(piece.style.left).toBe('0px');
      expect(piece.style.bottom).toBe('0px');
    });

    it('places pieces left-to-right', () => {
      const pieces = [createPiece(2, 2, 2)];
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={pieces} cellSize={16} gap={2} />
      );

      const placedPieces = container.querySelectorAll('[class*="absolute"]');
      expect(placedPieces).toHaveLength(2);

      // First piece at x=0
      expect((placedPieces[0] as HTMLElement).style.left).toBe('0px');
      // Second piece at x=2 (2 * (16 + 2) = 36)
      expect((placedPieces[1] as HTMLElement).style.left).toBe('36px');
    });

    it('wraps to next row when full', () => {
      const pieces = [createPiece(2, 2, 3)]; // 3 pieces of 2x2 in 4x4 grid
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={pieces} cellSize={16} gap={2} />
      );

      const placedPieces = container.querySelectorAll('[class*="absolute"]');
      // Only 2 fit in first row (2+2=4), third goes to second row
      expect(placedPieces).toHaveLength(3);

      // Third piece should be at y=2 (row 1)
      expect((placedPieces[2] as HTMLElement).style.bottom).toBe('36px');
    });
  });

  describe('custom cell size', () => {
    it('uses custom cell size', () => {
      const pieces = [createPiece(2, 2)];
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={pieces} cellSize={20} gap={4} />
      );

      const preview = container.firstChild as HTMLElement;
      // Width: 4 * 20 + 3 * 4 = 92px
      expect(preview.style.width).toBe('92px');
    });

    it('calculates piece dimensions with custom cell size', () => {
      const pieces = [createPiece(2, 2)];
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={pieces} cellSize={20} gap={4} />
      );

      const piece = container.querySelector('[class*="absolute"]') as HTMLElement;
      // Piece width: 2 * 20 + 1 * 4 = 44px
      expect(piece.style.width).toBe('44px');
    });
  });

  describe('empty state', () => {
    it('renders empty container when no pieces', () => {
      const { container } = render(<SplitPreview width={4} depth={4} pieces={[]} />);

      const pieces = container.querySelectorAll('[class*="absolute"]');
      expect(pieces).toHaveLength(0);
    });
  });

  describe('complex layouts', () => {
    it('handles mixed piece sizes', () => {
      const pieces = [createPiece(3, 2), createPiece(1, 2)];
      render(<SplitPreview width={4} depth={4} pieces={pieces} />);

      expect(screen.getByText('3×2')).toBeInTheDocument();
      expect(screen.getByText('1×2')).toBeInTheDocument();
    });

    it('handles pieces that fill exactly', () => {
      const pieces = [createPiece(2, 2, 4)]; // 4 pieces of 2x2 = 4x4 grid
      const { container } = render(
        <SplitPreview width={4} depth={4} pieces={pieces} />
      );

      const placedPieces = container.querySelectorAll('[class*="absolute"]');
      expect(placedPieces).toHaveLength(4);
    });
  });
});
