import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon, PlusIcon, CheckIcon, XIcon } from './index';

describe('Icon', () => {
  describe('decorative mode (no label)', () => {
    it('is hidden from screen readers', () => {
      const { container } = render(
        <Icon>
          <path d="M12 5v14" />
        </Icon>
      );
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });

    it('has no role', () => {
      const { container } = render(
        <Icon>
          <path d="M12 5v14" />
        </Icon>
      );
      expect(container.querySelector('svg')).not.toHaveAttribute('role');
    });
  });

  describe('meaningful mode (with label)', () => {
    it('has img role', () => {
      render(
        <Icon label="Add item">
          <path d="M12 5v14" />
        </Icon>
      );
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has accessible label', () => {
      render(
        <Icon label="Add item">
          <path d="M12 5v14" />
        </Icon>
      );
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Add item');
    });

    it('is not aria-hidden', () => {
      render(
        <Icon label="Add item">
          <path d="M12 5v14" />
        </Icon>
      );
      expect(screen.getByRole('img')).not.toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Icon className="text-red-500">
          <path d="M12 5v14" />
        </Icon>
      );
      expect(container.querySelector('svg')).toHaveClass('text-red-500');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to SVG element', () => {
      const ref = vi.fn();
      render(
        <Icon ref={ref}>
          <path d="M12 5v14" />
        </Icon>
      );
      expect(ref).toHaveBeenCalledWith(expect.any(SVGSVGElement));
    });
  });

  describe('named icons', () => {
    it('renders PlusIcon', () => {
      const { container } = render(<PlusIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders CheckIcon', () => {
      const { container } = render(<CheckIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders XIcon', () => {
      const { container } = render(<XIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
