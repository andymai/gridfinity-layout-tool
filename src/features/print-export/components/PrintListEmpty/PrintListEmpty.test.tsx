import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrintListEmpty } from '@/features/print-export';

describe('PrintListEmpty', () => {
  describe('default layout', () => {
    it('renders empty state message', () => {
      render(<PrintListEmpty />);

      expect(screen.getByText('No bins to print')).toBeInTheDocument();
      expect(screen.getByText('Add bins to the grid to see the print list')).toBeInTheDocument();
    });

    it('renders icon', () => {
      const { container } = render(<PrintListEmpty />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has empty-state class', () => {
      const { container } = render(<PrintListEmpty />);

      expect(container.querySelector('.empty-state')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('renders compact empty state message', () => {
      render(<PrintListEmpty compact={true} />);

      expect(screen.getByText('No bins to print')).toBeInTheDocument();
      expect(screen.getByText('Add bins to the grid to see the print list')).toBeInTheDocument();
    });

    it('renders larger icon in compact mode', () => {
      const { container } = render(<PrintListEmpty compact={true} />);

      const svg = container.querySelector('.w-8.h-8');
      expect(svg).toBeInTheDocument();
    });

    it('renders circular icon container in compact mode', () => {
      const { container } = render(<PrintListEmpty compact={true} />);

      expect(container.querySelector('.rounded-full')).toBeInTheDocument();
    });
  });
});
