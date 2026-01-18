import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/features/bin-inspector';

describe('EmptyState', () => {
  describe('desktop variant', () => {
    it('renders desktop empty state', () => {
      render(<EmptyState variant="desktop" />);

      expect(screen.getByText('No bin selected')).toBeInTheDocument();
      expect(screen.getByText('Click a bin to edit its properties')).toBeInTheDocument();
    });

    it('renders desktop icon', () => {
      const { container } = render(<EmptyState variant="desktop" />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-6', 'h-6');
    });
  });

  describe('mobile variant', () => {
    it('renders mobile empty state', () => {
      render(<EmptyState variant="mobile" />);

      expect(screen.getByText('No bin selected')).toBeInTheDocument();
      expect(screen.getByText('Tap a bin on the grid to edit it')).toBeInTheDocument();
    });

    it('renders creation instructions', () => {
      render(<EmptyState variant="mobile" />);

      expect(screen.getByText('How to create bins:')).toBeInTheDocument();
      expect(screen.getByText(/Tap and drag on empty grid cells/)).toBeInTheDocument();
      expect(screen.getByText(/Long-press a bin for quick actions/)).toBeInTheDocument();
    });

    it('renders larger icon for mobile', () => {
      const { container } = render(<EmptyState variant="mobile" />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-8', 'h-8');
    });
  });
});
