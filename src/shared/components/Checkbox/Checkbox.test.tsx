import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  describe('display-only mode (no onChange)', () => {
    it('renders checked state with checkmark', () => {
      const { container } = render(<Checkbox checked={true} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders unchecked state without checkmark', () => {
      const { container } = render(<Checkbox checked={false} />);
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Checkbox checked={false} label="Enable feature" />);
      expect(screen.getByText('Enable feature')).toBeInTheDocument();
    });

    it('has aria-hidden for display-only mode', () => {
      const { container } = render(<Checkbox checked={false} />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('interactive mode (with onChange)', () => {
    it('renders as checkbox role', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} ariaLabel="Test checkbox" />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('calls onChange when clicked', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when unchecking', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={true} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it('calls onChange when Space key is pressed', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' });
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange when Enter key is pressed', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Toggle" />);
      fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' });
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('does not call onChange when disabled', () => {
      const handleChange = vi.fn();
      render(<Checkbox checked={false} onChange={handleChange} ariaLabel="Disabled" disabled />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('has proper aria-checked attribute', () => {
      const { rerender } = render(<Checkbox checked={false} onChange={vi.fn()} ariaLabel="Test" />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');

      rerender(<Checkbox checked={true} onChange={vi.fn()} ariaLabel="Test" />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    });

    it('applies mobile variant sizing', () => {
      const { container } = render(
        <Checkbox checked={false} onChange={vi.fn()} ariaLabel="Mobile" variant="mobile" />
      );
      expect(container.querySelector('.w-6')).toBeInTheDocument();
    });

    it('applies desktop variant sizing by default', () => {
      const { container } = render(
        <Checkbox checked={false} onChange={vi.fn()} ariaLabel="Desktop" />
      );
      expect(container.querySelector('.w-4')).toBeInTheDocument();
    });
  });
});
