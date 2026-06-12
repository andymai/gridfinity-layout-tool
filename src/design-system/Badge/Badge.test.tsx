import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Badge>Experimental</Badge>);
      expect(screen.getByText('Experimental')).toBeInTheDocument();
    });

    it('renders node children alongside text', () => {
      render(
        <Badge>
          <span data-testid="swatch" />
          Red
        </Badge>
      );
      expect(screen.getByTestId('swatch')).toBeInTheDocument();
      expect(screen.getByText('Red')).toBeInTheDocument();
    });

    it('renders as a span with no implicit role', () => {
      render(<Badge>3</Badge>);
      expect(screen.getByText('3').tagName).toBe('SPAN');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('applies className passthrough', () => {
      render(<Badge className="custom-class">3</Badge>);
      expect(screen.getByText('3')).toHaveClass('custom-class');
    });

    it('passes through native span attributes', () => {
      render(<Badge title="3 staged bins">3</Badge>);
      expect(screen.getByText('3')).toHaveAttribute('title', '3 staged bins');
    });
  });

  describe('tone', () => {
    it('defaults to neutral', () => {
      render(<Badge>3</Badge>);
      expect(screen.getByText('3')).toHaveClass('bg-surface-hover', 'text-content-tertiary');
    });

    it('applies accent classes', () => {
      render(<Badge tone="accent">2</Badge>);
      expect(screen.getByText('2')).toHaveClass('bg-accent', 'text-on-accent');
    });

    it('applies warning intent classes', () => {
      render(<Badge tone="warning">Experimental</Badge>);
      expect(screen.getByText('Experimental')).toHaveClass('bg-warning-muted', 'text-warning');
    });

    it('applies success intent classes', () => {
      render(<Badge tone="success">Can edit</Badge>);
      expect(screen.getByText('Can edit')).toHaveClass('bg-success-muted', 'text-success');
    });

    it('applies error intent classes', () => {
      render(<Badge tone="error">Deleted</Badge>);
      expect(screen.getByText('Deleted')).toHaveClass('bg-error-muted', 'text-error');
    });

    it('applies info intent classes', () => {
      render(<Badge tone="info">New</Badge>);
      expect(screen.getByText('New')).toHaveClass('bg-info-muted', 'text-info');
    });

    it('applies overlay classes', () => {
      render(<Badge tone="overlay">4 layers</Badge>);
      expect(screen.getByText('4 layers')).toHaveClass('bg-black/70', 'text-white');
    });
  });

  describe('shape', () => {
    it('defaults to rounded', () => {
      render(<Badge>Saved</Badge>);
      expect(screen.getByText('Saved')).toHaveClass('rounded-md');
    });

    it('applies pill shape', () => {
      render(<Badge shape="pill">9+</Badge>);
      expect(screen.getByText('9+')).toHaveClass('rounded-full');
    });
  });

  describe('size', () => {
    it('defaults to sm', () => {
      render(<Badge>3</Badge>);
      expect(screen.getByText('3')).toHaveClass('text-[10px]', 'px-1.5', 'py-0.5');
    });

    it('applies md size', () => {
      render(<Badge size="md">3</Badge>);
      expect(screen.getByText('3')).toHaveClass('text-xs', 'px-2', 'py-0.5');
    });
  });

  describe('remove button', () => {
    it('does not render a remove button without onRemove', () => {
      render(<Badge>tag</Badge>);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders a remove button with default aria-label', () => {
      render(<Badge onRemove={vi.fn()}>tag</Badge>);
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('uses removeAriaLabel for the remove button name', () => {
      render(
        <Badge onRemove={vi.fn()} removeAriaLabel="Remove tag hardware">
          hardware
        </Badge>
      );
      expect(screen.getByRole('button', { name: 'Remove tag hardware' })).toBeInTheDocument();
    });

    it('calls onRemove when the remove button is clicked', () => {
      const onRemove = vi.fn();
      render(<Badge onRemove={onRemove}>tag</Badge>);
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('renders the remove button as type=button', () => {
      render(<Badge onRemove={vi.fn()}>tag</Badge>);
      expect(screen.getByRole('button', { name: 'Remove' })).toHaveAttribute('type', 'button');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the span element', () => {
      const ref = vi.fn();
      render(<Badge ref={ref}>3</Badge>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLSpanElement));
    });
  });
});
