import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';

const TestIcon = (): React.ReactElement => (
  <svg data-testid="test-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12" />
  </svg>
);

describe('IconButton', () => {
  describe('rendering', () => {
    it('renders a button with the aria-label as its accessible name', () => {
      render(
        <IconButton aria-label="Close dialog">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    });

    it('renders the icon children', () => {
      render(
        <IconButton aria-label="Close dialog">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('defaults to the ghost variant', () => {
      render(
        <IconButton aria-label="Undo">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button').className).toContain('bg-transparent');
    });

    it('applies secondary variant styling', () => {
      render(
        <IconButton aria-label="Swap dimensions" variant="secondary">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button').className).toContain('border-stroke');
    });

    it('applies dangerGhost hover classes on top of ghost styling', () => {
      render(
        <IconButton aria-label="Delete category" variant="dangerGhost">
          <TestIcon />
        </IconButton>
      );
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-transparent');
      expect(button.className).toContain('hover:text-error');
      expect(button.className).toContain('hover:bg-error-muted');
    });

    it('defaults to md size width', () => {
      render(
        <IconButton aria-label="Close dialog">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button').className).toContain('w-9');
    });

    it('applies sm and lg size widths', () => {
      const { rerender } = render(
        <IconButton aria-label="Remove tag" size="sm">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button').className).toContain('w-6');

      rerender(
        <IconButton aria-label="Remove tag" size="lg">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button').className).toContain('w-12');
    });

    it('enforces the touch target by default and removes it when touchTarget is false', () => {
      const { rerender } = render(
        <IconButton aria-label="Align left">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button').className).toContain('min-h-[44px]');

      rerender(
        <IconButton aria-label="Align left" touchTarget={false}>
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button').className).not.toContain('min-h-[44px]');
    });

    it('merges a custom className', () => {
      render(
        <IconButton aria-label="Close dialog" className="custom-class">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('passes native attributes like title through', () => {
      render(
        <IconButton aria-label="Undo" title="Undo (Ctrl+Z)">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Undo (Ctrl+Z)');
    });
  });

  describe('pressed state', () => {
    it('omits aria-pressed when the pressed prop is not provided', () => {
      render(
        <IconButton aria-label="Toggle grid">
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
    });

    it('sets aria-pressed and active styling when pressed is true', () => {
      render(
        <IconButton aria-label="Toggle grid" pressed>
          <TestIcon />
        </IconButton>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button.className).toContain('bg-surface-active');
    });

    it('sets aria-pressed false without active styling when pressed is false', () => {
      render(
        <IconButton aria-label="Toggle grid" pressed={false}>
          <TestIcon />
        </IconButton>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button.className).not.toContain('bg-surface-active');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(
        <IconButton aria-label="Undo" onClick={onClick}>
          <TestIcon />
        </IconButton>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn();
      render(
        <IconButton aria-label="Undo" disabled onClick={onClick}>
          <TestIcon />
        </IconButton>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('sets aria-busy and disables the button', () => {
      render(
        <IconButton aria-label="Refresh share" loading>
          <TestIcon />
        </IconButton>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
    });

    it('swaps the icon for a spinner', () => {
      render(
        <IconButton aria-label="Refresh share" loading>
          <TestIcon />
        </IconButton>
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();
    });

    it('does not call onClick while loading', () => {
      const onClick = vi.fn();
      render(
        <IconButton aria-label="Refresh share" loading onClick={onClick}>
          <TestIcon />
        </IconButton>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('ref forwarding', () => {
    it('forwards the ref to the underlying button element', () => {
      const ref = vi.fn();
      render(
        <IconButton aria-label="Close dialog" ref={ref}>
          <TestIcon />
        </IconButton>
      );
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    });
  });
});
