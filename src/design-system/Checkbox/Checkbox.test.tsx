import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  describe('controlled mode', () => {
    it('renders as a checkbox', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('reflects checked state', () => {
      render(<Checkbox checked={true} onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('calls onChange with true when checking', () => {
      const onChange = vi.fn();
      render(<Checkbox checked={false} onChange={onChange} aria-label="Test" />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when unchecking', () => {
      const onChange = vi.fn();
      render(<Checkbox checked={true} onChange={onChange} aria-label="Test" />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('uncontrolled mode', () => {
    it('starts unchecked by default', () => {
      render(<Checkbox onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('starts checked with defaultChecked', () => {
      render(<Checkbox defaultChecked onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('toggles internally on click', () => {
      render(<Checkbox onChange={vi.fn()} aria-label="Test" />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('display-only mode', () => {
    it('renders without a native checkbox', () => {
      render(<Checkbox checked={true} />);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('has aria-hidden for display-only', () => {
      const { container } = render(<Checkbox checked={false} />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('shows checkmark when checked', () => {
      const { container } = render(<Checkbox checked={true} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('indeterminate state', () => {
    it('sets aria-checked to mixed', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} indeterminate aria-label="Test" />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    });

    it('syncs indeterminate property to DOM', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} indeterminate aria-label="Test" />);
      const input = screen.getByRole('checkbox');
      expect(input.indeterminate).toBe(true);
    });
  });

  describe('disabled', () => {
    it('disables the native checkbox', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} disabled aria-label="Test" />);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('prevents interaction when disabled', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} disabled aria-label="Test" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox.closest('label')).toHaveClass('cursor-not-allowed');
    });
  });

  describe('label', () => {
    it('renders visible label text', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} label="Accept terms" />);
      expect(screen.getByText('Accept terms')).toBeInTheDocument();
    });

    it('associates label with checkbox', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} label="Accept terms" />);
      expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeInTheDocument();
    });
  });
});
