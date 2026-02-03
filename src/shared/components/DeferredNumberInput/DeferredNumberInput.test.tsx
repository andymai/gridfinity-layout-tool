import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';

describe('DeferredNumberInput', () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    value: 5,
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders input with value', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(5);
    });

    it('applies className', () => {
      render(<DeferredNumberInput {...defaultProps} className="test-class" />);

      expect(screen.getByRole('spinbutton')).toHaveClass('test-class');
    });

    it('applies id', () => {
      render(<DeferredNumberInput {...defaultProps} id="test-id" />);

      expect(screen.getByRole('spinbutton')).toHaveAttribute('id', 'test-id');
    });

    it('applies aria-label', () => {
      render(<DeferredNumberInput {...defaultProps} aria-label="Test Label" />);

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    });

    it('applies min attribute', () => {
      render(<DeferredNumberInput {...defaultProps} min={0} />);

      expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '0');
    });

    it('applies max attribute', () => {
      render(<DeferredNumberInput {...defaultProps} max={100} />);

      expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '100');
    });

    it('applies step attribute', () => {
      render(<DeferredNumberInput {...defaultProps} step={0.5} />);

      expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.5');
    });

    it('defaults min to 1', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '1');
    });
  });

  describe('value formatting', () => {
    it('displays integer values without decimal', () => {
      render(<DeferredNumberInput {...defaultProps} value={10} />);

      expect(screen.getByRole('spinbutton')).toHaveValue(10);
    });

    it('displays fractional values with one decimal place', () => {
      render(<DeferredNumberInput {...defaultProps} value={5.5} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveDisplayValue('5.5');
    });
  });

  describe('local editing', () => {
    it('allows typing without immediate commit', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });

      // Local value changes but onChange not called yet
      expect(input).toHaveDisplayValue('10');
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('allows clearing input while typing', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '' } });

      expect(input).toHaveDisplayValue('');
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('committing on blur', () => {
    it('calls onChange on blur with valid value', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(10);
    });

    it('clamps value to min on blur', () => {
      render(<DeferredNumberInput {...defaultProps} min={5} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '2' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(5);
    });

    it('clamps value to max on blur', () => {
      render(<DeferredNumberInput {...defaultProps} max={10} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '15' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(10);
    });

    it('resets to original value on blur with invalid input', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(input).toHaveDisplayValue('5');
    });

    it('resets to original value on blur with empty input', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(input).toHaveDisplayValue('5');
    });
  });

  describe('committing on Enter', () => {
    it('calls onChange on Enter with valid value', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(10);
    });

    it('clamps value on Enter', () => {
      render(<DeferredNumberInput {...defaultProps} min={5} max={10} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '20' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(10);
    });
  });

  describe('canceling on Escape', () => {
    it('resets to original value on Escape', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input).toHaveDisplayValue('5');
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('external value updates', () => {
    it('syncs local value when external value changes', () => {
      const { rerender } = render(<DeferredNumberInput {...defaultProps} value={5} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveDisplayValue('5');

      // Simulate external value change (e.g., from undo)
      rerender(<DeferredNumberInput {...defaultProps} value={10} />);

      expect(input).toHaveDisplayValue('10');
    });

    it('handles external value change to fractional', () => {
      const { rerender } = render(<DeferredNumberInput {...defaultProps} value={5} />);

      rerender(<DeferredNumberInput {...defaultProps} value={7.5} />);

      expect(screen.getByRole('spinbutton')).toHaveDisplayValue('7.5');
    });
  });

  describe('focus behavior', () => {
    it('selects all text on focus', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');

      // Mock select method
      const selectSpy = vi.spyOn(input, 'select');

      fireEvent.focus(input);

      expect(selectSpy).toHaveBeenCalled();
    });
  });

  describe('fractional values', () => {
    it('handles fractional input values', () => {
      render(<DeferredNumberInput {...defaultProps} step={0.5} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '5.5' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(5.5);
    });

    it('formats committed fractional value correctly', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '5.5' } });
      fireEvent.blur(input);

      expect(input).toHaveDisplayValue('5.5');
    });
  });

  describe('edge cases', () => {
    it('handles negative numbers when allowed', () => {
      render(<DeferredNumberInput {...defaultProps} min={-10} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-5' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(-5);
    });

    it('handles zero value', () => {
      render(<DeferredNumberInput {...defaultProps} min={0} value={0} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveDisplayValue('0');
    });

    it('handles very large numbers', () => {
      render(<DeferredNumberInput {...defaultProps} max={1000000} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '999999' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(999999);
    });

    it('clamps to max when max is Infinity by default', () => {
      render(<DeferredNumberInput {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '9999999' } });
      fireEvent.blur(input);

      expect(mockOnChange).toHaveBeenCalledWith(9999999);
    });
  });
});
