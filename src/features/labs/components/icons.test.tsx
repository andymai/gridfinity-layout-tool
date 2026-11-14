import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SparklesIcon, InfoIcon } from './icons';

describe('icons', () => {
  describe('SparklesIcon', () => {
    it('renders without crashing', () => {
      const { container } = render(<SparklesIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<SparklesIcon className="custom-class" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('custom-class');
    });

    it('renders SVG with correct attributes', () => {
      const { container } = render(<SparklesIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });
  });

  describe('InfoIcon', () => {
    it('renders without crashing', () => {
      const { container } = render(<InfoIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<InfoIcon className="text-info" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-info');
    });
  });
});
