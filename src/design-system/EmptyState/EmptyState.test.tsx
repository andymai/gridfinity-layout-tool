import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('rendering', () => {
    it('renders the title', () => {
      render(<EmptyState title="No layouts yet" />);
      expect(screen.getByText('No layouts yet')).toBeInTheDocument();
    });

    it('renders the description when provided', () => {
      render(<EmptyState title="No layouts yet" description="Create one to get started" />);
      expect(screen.getByText('Create one to get started')).toBeInTheDocument();
    });

    it('does not render an icon container when icon is omitted', () => {
      render(<EmptyState title="No results" />);
      expect(screen.queryByTestId('empty-state-icon')).not.toBeInTheDocument();
    });

    it('renders the icon inside an aria-hidden container', () => {
      render(<EmptyState title="No results" icon={<svg data-testid="my-icon" />} />);
      const container = screen.getByTestId('empty-state-icon');
      expect(container).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId('my-icon')).toBeInTheDocument();
    });

    it('renders the detail slot', () => {
      render(<EmptyState title="Crashed" detail={<pre>stack trace</pre>} />);
      expect(screen.getByText('stack trace')).toBeInTheDocument();
    });

    it('applies className to the container', () => {
      render(<EmptyState title="No results" className="custom-class" data-testid="empty" />);
      expect(screen.getByTestId('empty')).toHaveClass('custom-class');
    });
  });

  describe('icon styles', () => {
    it('renders a faded icon without a tinted container for bare style', () => {
      render(<EmptyState title="No results" icon={<svg />} />);
      const container = screen.getByTestId('empty-state-icon');
      expect(container.className).toContain('opacity-50');
      expect(container.className).not.toContain('bg-surface-elevated');
    });

    it('renders a rounded square with elevated background for tile style', () => {
      render(<EmptyState title="No results" icon={<svg />} iconStyle="tile" />);
      const container = screen.getByTestId('empty-state-icon');
      expect(container.className).toContain('rounded-xl');
      expect(container.className).toContain('bg-surface-elevated');
    });

    it('renders a rounded circle for circle style', () => {
      render(<EmptyState title="No results" icon={<svg />} iconStyle="circle" />);
      const container = screen.getByTestId('empty-state-icon');
      expect(container.className).toContain('rounded-full');
      expect(container.className).toContain('bg-surface-elevated');
    });
  });

  describe('tint', () => {
    it('applies error tint classes to the icon container', () => {
      render(<EmptyState title="Crashed" icon={<svg />} iconStyle="circle" tint="error" />);
      const container = screen.getByTestId('empty-state-icon');
      expect(container.className).toContain('bg-error-muted');
      expect(container.className).toContain('text-error');
    });

    it('applies warning tint classes to the icon container', () => {
      render(<EmptyState title="Blocked" icon={<svg />} iconStyle="circle" tint="warning" />);
      const container = screen.getByTestId('empty-state-icon');
      expect(container.className).toContain('bg-warning-muted');
      expect(container.className).toContain('text-warning');
    });

    it('sets role alert when tint is error', () => {
      render(<EmptyState title="Crashed" tint="error" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('does not set role alert for neutral tint', () => {
      render(<EmptyState title="No results" />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not set role alert for warning tint', () => {
      render(<EmptyState title="Blocked" tint="warning" />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('size', () => {
    it('uses panel spacing and a 12-unit icon at md', () => {
      render(<EmptyState title="No results" icon={<svg />} data-testid="empty" />);
      expect(screen.getByTestId('empty').className).toContain('py-8');
      expect(screen.getByTestId('empty-state-icon').className).toContain('h-12');
    });

    it('uses full-screen spacing and a 16-unit circle at lg', () => {
      render(
        <EmptyState
          title="Crashed"
          icon={<svg />}
          iconStyle="circle"
          size="lg"
          data-testid="empty"
        />
      );
      expect(screen.getByTestId('empty').className).toContain('py-12');
      const container = screen.getByTestId('empty-state-icon');
      expect(container.className).toContain('h-16');
      expect(container.className).toContain('w-16');
    });

    it('scales the title to text-base at lg', () => {
      render(<EmptyState title="Crashed" size="lg" />);
      expect(screen.getByText('Crashed').className).toContain('text-base');
    });
  });

  describe('actions', () => {
    it('renders actions and forwards clicks to the handler', () => {
      const onClick = vi.fn();
      render(
        <EmptyState
          title="No results"
          actions={
            <button type="button" onClick={onClick}>
              Browse all
            </button>
          }
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Browse all' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders multiple actions in one row', () => {
      render(
        <EmptyState
          title="Crashed"
          actions={
            <>
              <button type="button">Try Again</button>
              <button type="button">Reload</button>
            </>
          }
        />
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].parentElement).toBe(buttons[1].parentElement);
    });
  });

  describe('ref forwarding', () => {
    it('forwards the ref to the container element', () => {
      const ref = createRef<HTMLDivElement>();
      render(<EmptyState ref={ref} title="No results" />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});
