import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavRow } from './NavRow';

const defaultProps = {
  icon: <svg data-testid="leading-icon" />,
  title: 'Inspiration gallery',
};

describe('NavRow', () => {
  describe('rendering', () => {
    it('renders a button with the title as accessible name', () => {
      render(<NavRow {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Inspiration gallery' })).toBeInTheDocument();
    });

    it('renders the subtitle when provided', () => {
      render(<NavRow {...defaultProps} subtitle="Get ideas for your drawer" />);
      expect(screen.getByText('Get ideas for your drawer')).toBeInTheDocument();
    });

    it('does not render a subtitle element when omitted', () => {
      render(<NavRow {...defaultProps} />);
      expect(screen.queryByText('Get ideas for your drawer')).not.toBeInTheDocument();
    });

    it('renders the leading icon inside an aria-hidden tile', () => {
      render(<NavRow {...defaultProps} />);
      const tile = screen.getByTestId('nav-row-icon-tile');
      expect(tile).toHaveAttribute('aria-hidden', 'true');
      expect(tile).toContainElement(screen.getByTestId('leading-icon'));
      expect(tile.className).toContain('w-10');
      expect(tile.className).toContain('h-10');
    });

    it('renders as type="button"', () => {
      render(<NavRow {...defaultProps} />);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
  });

  describe('trailing chevron', () => {
    it('renders the default aria-hidden chevron', () => {
      render(<NavRow {...defaultProps} />);
      expect(screen.getByTestId('nav-row-chevron')).toHaveAttribute('aria-hidden', 'true');
    });

    it('omits the chevron when trailing is null', () => {
      render(<NavRow {...defaultProps} trailing={null} />);
      expect(screen.queryByTestId('nav-row-chevron')).not.toBeInTheDocument();
    });

    it('renders a custom trailing node instead of the chevron', () => {
      render(<NavRow {...defaultProps} trailing={<span data-testid="custom-trailing" />} />);
      expect(screen.getByTestId('custom-trailing')).toBeInTheDocument();
      expect(screen.queryByTestId('nav-row-chevron')).not.toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('applies plain surface classes by default', () => {
      render(<NavRow {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-surface-elevated');
      expect(button.className).toContain('border-stroke-subtle');
    });

    it('applies promo gradient classes', () => {
      render(<NavRow {...defaultProps} variant="promo" />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gradient-to-r');
      expect(button.className).toContain('from-accent/10');
      expect(button.className).toContain('border-accent/20');
    });

    it('applies neutral icon tint by default', () => {
      render(<NavRow {...defaultProps} />);
      expect(screen.getByTestId('nav-row-icon-tile').className).toContain('bg-surface-elevated');
    });

    it('applies accent icon tint', () => {
      render(<NavRow {...defaultProps} iconTint="accent" />);
      const tile = screen.getByTestId('nav-row-icon-tile');
      expect(tile.className).toContain('bg-accent/20');
      expect(tile.className).toContain('text-accent');
    });

    it('lets iconClassName override the tile tint', () => {
      render(<NavRow {...defaultProps} iconClassName="bg-purple-500/20 text-purple-500" />);
      const tile = screen.getByTestId('nav-row-icon-tile');
      expect(tile.className).toContain('bg-purple-500/20');
      expect(tile.className).not.toContain('bg-surface-elevated');
    });

    it('applies the activePress class', () => {
      render(<NavRow {...defaultProps} />);
      expect(screen.getByRole('button').className).toContain('active:scale-[0.98]');
    });

    it('merges className onto the button', () => {
      render(<NavRow {...defaultProps} className="custom-class" />);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<NavRow {...defaultProps} onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn();
      render(<NavRow {...defaultProps} onClick={onClick} disabled />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the button element', () => {
      const ref = vi.fn();
      render(<NavRow {...defaultProps} ref={ref} />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    });
  });
});
