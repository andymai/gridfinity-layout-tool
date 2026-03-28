import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './Switch';

describe('Switch', () => {
  describe('controlled mode', () => {
    it('renders as a switch', () => {
      render(<Switch checked={false} onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('reflects checked state', () => {
      render(<Switch checked={true} onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('calls onChange with true when turning on', () => {
      const onChange = vi.fn();
      render(<Switch checked={false} onChange={onChange} aria-label="Test" />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when turning off', () => {
      const onChange = vi.fn();
      render(<Switch checked={true} onChange={onChange} aria-label="Test" />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('uncontrolled mode', () => {
    it('starts off by default', () => {
      render(<Switch onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('switch')).not.toBeChecked();
    });

    it('starts on with defaultChecked', () => {
      render(<Switch defaultChecked onChange={vi.fn()} aria-label="Test" />);
      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('toggles internally on click', () => {
      render(<Switch onChange={vi.fn()} aria-label="Test" />);
      const sw = screen.getByRole('switch');
      fireEvent.click(sw);
      expect(sw).toBeChecked();
    });
  });

  describe('disabled', () => {
    it('disables the native input', () => {
      render(<Switch checked={false} onChange={vi.fn()} disabled aria-label="Test" />);
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('applies disabled styling to container', () => {
      render(<Switch checked={false} onChange={vi.fn()} disabled aria-label="Test" />);
      expect(screen.getByRole('switch').closest('label')).toHaveClass('cursor-not-allowed');
    });
  });

  describe('label', () => {
    it('renders visible label text', () => {
      render(<Switch checked={false} onChange={vi.fn()} label="Dark mode" />);
      expect(screen.getByText('Dark mode')).toBeInTheDocument();
    });

    it('associates label with switch', () => {
      render(<Switch checked={false} onChange={vi.fn()} label="Dark mode" />);
      expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument();
    });
  });
});
