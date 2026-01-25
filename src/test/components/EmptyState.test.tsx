import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/features/bin-inspector';

describe('EmptyState', () => {
  describe('desktop variant', () => {
    it('renders desktop empty state', () => {
      render(<EmptyState variant="desktop" />);

      expect(screen.getByText('No bin selected')).toBeInTheDocument();
      expect(screen.getByText('Click a bin on the grid or draw to create one')).toBeInTheDocument();
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
      expect(screen.getByText('Tap a bin on the grid, or use the Tools tab to create one')).toBeInTheDocument();
    });

    it('renders creation instructions', () => {
      render(<EmptyState variant="mobile" />);

      expect(screen.getByText('How to create bins:')).toBeInTheDocument();
      expect(screen.getByText('Go to Layers → Tools tab')).toBeInTheDocument();
      expect(screen.getByText('Tap on the grid to place')).toBeInTheDocument();
    });

    it('renders larger icon for mobile', () => {
      const { container } = render(<EmptyState variant="mobile" />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-8', 'h-8');
    });
  });
});
