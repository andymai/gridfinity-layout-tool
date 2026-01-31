import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SparklesIcon, CloseIcon, ChevronRightIcon } from './icons';

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

  describe('CloseIcon', () => {
    it('renders without crashing', () => {
      const { container } = render(<CloseIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<CloseIcon className="text-red-500" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-red-500');
    });

    it('renders SVG with correct attributes', () => {
      const { container } = render(<CloseIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });
  });

  describe('ChevronRightIcon', () => {
    it('renders without crashing', () => {
      const { container } = render(<ChevronRightIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<ChevronRightIcon className="w-6 h-6" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('h-6');
    });

    it('renders SVG with correct attributes', () => {
      const { container } = render(<ChevronRightIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });
  });
});
