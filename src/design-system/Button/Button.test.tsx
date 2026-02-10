import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders as button element', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button').tagName).toBe('BUTTON');
    });

    it('applies className', () => {
      render(<Button className="custom-class">Test</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Click</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn();
      render(
        <Button onClick={onClick} disabled>
          Click
        </Button>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const onClick = vi.fn();
      render(
        <Button onClick={onClick} loading>
          Click
        </Button>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('sets aria-busy when loading', () => {
      render(<Button loading>Save</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('is disabled when loading', () => {
      render(<Button loading>Save</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows spinner when loading', () => {
      render(<Button loading>Save</Button>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not set aria-busy when not loading', () => {
      render(<Button>Save</Button>);
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
    });
  });

  describe('icons', () => {
    it('renders left icon', () => {
      render(<Button leftIcon={<span data-testid="left-icon" />}>Test</Button>);
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('renders right icon', () => {
      render(<Button rightIcon={<span data-testid="right-icon" />}>Test</Button>);
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('replaces left icon with spinner when loading', () => {
      render(
        <Button loading leftIcon={<span data-testid="left-icon" />}>
          Test
        </Button>
      );
      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('touchTarget', () => {
    it('applies touch target class by default on iconOnly', () => {
      render(
        <Button iconOnly aria-label="Close">
          X
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button.className).toContain('min-h-[44px]');
      expect(button.className).toContain('min-w-[44px]');
    });

    it('does not apply touch target on regular buttons', () => {
      render(<Button>Click</Button>);
      const button = screen.getByRole('button');
      expect(button.className).not.toContain('min-h-[44px]');
    });

    it('can disable touch target on iconOnly', () => {
      render(
        <Button iconOnly touchTarget={false} aria-label="Close">
          X
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button.className).not.toContain('min-h-[44px]');
    });

    it('can enable touch target on regular buttons', () => {
      render(<Button touchTarget>Click</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('min-h-[44px]');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Test</Button>);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    });
  });
});
