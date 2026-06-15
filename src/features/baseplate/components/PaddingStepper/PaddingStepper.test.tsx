import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaddingStepper } from './PaddingStepper';
import { PADDING_BUTTON_STEP, PADDING_MAX, PADDING_MIN, roundMm } from './constants';

// Mock i18n: render `Increase {label}` / `Decrease {label}` from the en.ts pattern
// so test assertions stay readable. Real translation keys are tested separately
// via the i18n key-alignment check.
vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, params?: Record<string, unknown>): string => {
      if (key === 'baseplate.increasePadding' && typeof params?.label === 'string') {
        return `Increase ${params.label}`;
      }
      if (key === 'baseplate.decreasePadding' && typeof params?.label === 'string') {
        return `Decrease ${params.label}`;
      }
      return key;
    },
}));

const baseProps = {
  value: 5,
  orientation: 'horizontal' as const,
  'aria-label': 'Front padding',
};

describe('roundMm', () => {
  it('absorbs IEEE-754 noise (0.1 + 0.2 -> 0.3)', () => {
    expect(roundMm(0.1 + 0.2)).toBe(0.3);
  });

  it('snaps to 2-decimal precision', () => {
    expect(roundMm(5.555)).toBe(5.56);
    expect(roundMm(5.554)).toBe(5.55);
  });

  it('preserves exact whole numbers', () => {
    expect(roundMm(5)).toBe(5);
    expect(roundMm(0)).toBe(0);
  });
});

describe('PaddingStepper', () => {
  describe('rendering', () => {
    it('renders horizontal layout with input and +/- buttons', () => {
      render(<PaddingStepper {...baseProps} onChange={vi.fn()} />);
      expect(screen.getByRole('spinbutton', { name: 'Front padding' })).toHaveValue(5);
      expect(screen.getByRole('button', { name: 'Increase Front padding' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Decrease Front padding' })).toBeInTheDocument();
    });

    it('renders vertical layout with input and +/- buttons', () => {
      render(
        <PaddingStepper
          value={3}
          orientation="vertical"
          aria-label="Left padding"
          onChange={vi.fn()}
        />
      );
      expect(screen.getByRole('spinbutton', { name: 'Left padding' })).toHaveValue(3);
      expect(screen.getByRole('button', { name: 'Increase Left padding' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Decrease Left padding' })).toBeInTheDocument();
    });

    it('renders optional label slot for horizontal orientation', () => {
      render(<PaddingStepper {...baseProps} label="Front" onChange={vi.fn()} />);
      expect(screen.getByText('Front')).toBeInTheDocument();
    });

    it('omits label when not provided', () => {
      render(<PaddingStepper {...baseProps} onChange={vi.fn()} />);
      // No <label> element associated with the input
      expect(document.querySelector('label')).toBeNull();
    });

    it('formats fractional values without trailing zeros', () => {
      render(<PaddingStepper {...baseProps} value={5.5} onChange={vi.fn()} />);
      expect(screen.getByRole('spinbutton', { name: 'Front padding' })).toHaveValue(5.5);
    });
  });

  describe('button stepping', () => {
    it('increments by PADDING_BUTTON_STEP on +', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Increase Front padding' }));
      expect(onChange).toHaveBeenCalledWith(5 + PADDING_BUTTON_STEP);
    });

    it('decrements by PADDING_BUTTON_STEP on -', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Decrease Front padding' }));
      expect(onChange).toHaveBeenCalledWith(5 - PADDING_BUTTON_STEP);
    });

    it('disables decrement at PADDING_MIN', () => {
      render(<PaddingStepper {...baseProps} value={PADDING_MIN} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Decrease Front padding' })).toBeDisabled();
    });

    it('disables increment at PADDING_MAX', () => {
      render(<PaddingStepper {...baseProps} value={PADDING_MAX} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Increase Front padding' })).toBeDisabled();
    });

    it('clamps increment so it never overshoots PADDING_MAX', () => {
      const onChange = vi.fn();
      // value within step distance of max -> clamp
      render(<PaddingStepper {...baseProps} value={PADDING_MAX - 0.1} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Increase Front padding' }));
      expect(onChange).toHaveBeenCalledWith(PADDING_MAX);
    });

    it('clamps decrement so it never undershoots PADDING_MIN', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={0.1} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Decrease Front padding' }));
      expect(onChange).toHaveBeenCalledWith(PADDING_MIN);
    });

    it('button increment does not accumulate float noise from a noisy starting value', () => {
      // Simulates: typed-in noisy value (5.5600000000000005) followed by a button click.
      // Without roundMm in handleIncrement, the result would be 5.810000000000001.
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5.5600000000000005} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Increase Front padding' }));
      expect(onChange).toHaveBeenCalledWith(5.81);
    });

    it('button decrement does not accumulate float noise', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5.5600000000000005} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Decrease Front padding' }));
      expect(onChange).toHaveBeenCalledWith(5.31);
    });

    it('disables both buttons when disabled prop is true', () => {
      render(<PaddingStepper {...baseProps} value={5} disabled onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Increase Front padding' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Decrease Front padding' })).toBeDisabled();
    });
  });

  describe('typed input', () => {
    it('commits typed value on Enter', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '7.5' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(7.5);
    });

    it('commits typed value on Blur', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '12.34' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(12.34);
    });

    it('reverts typed value on Escape (does not commit)', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('Enter blurs the input and does not double-commit on subsequent blur', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
      // Only one commit, not two
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(7);
    });

    it('clamps typed values above PADDING_MAX silently', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(PADDING_MAX);
    });

    it('clamps typed values below PADDING_MIN silently', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '-10' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(PADDING_MIN);
    });

    it('snaps typed values to 0.01 mm step with no float noise', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '5.555' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      // Exact equality: roundMm must absorb IEEE-754 noise.
      expect(onChange).toHaveBeenCalledWith(5.56);
    });

    it('ignores NaN input (does not commit)', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores empty input on commit (does not commit)', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('shows external value when not focused, even after typing+escape', () => {
      const onChange = vi.fn();
      render(<PaddingStepper {...baseProps} value={5} onChange={onChange} />);
      const input = screen.getByRole('spinbutton', { name: 'Front padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input).toHaveValue(5);
    });

    it('disables input when disabled prop is true', () => {
      render(<PaddingStepper {...baseProps} value={5} disabled onChange={vi.fn()} />);
      expect(screen.getByRole('spinbutton', { name: 'Front padding' })).toBeDisabled();
    });
  });

  describe('orientation parity', () => {
    it('vertical orientation accepts typed input the same way', () => {
      const onChange = vi.fn();
      render(
        <PaddingStepper
          value={2}
          orientation="vertical"
          aria-label="Left padding"
          onChange={onChange}
        />
      );
      const input = screen.getByRole('spinbutton', { name: 'Left padding' });
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '8.25' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(8.25);
    });

    it('vertical orientation buttons step the same way', () => {
      const onChange = vi.fn();
      render(
        <PaddingStepper
          value={2}
          orientation="vertical"
          aria-label="Left padding"
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Increase Left padding' }));
      expect(onChange).toHaveBeenCalledWith(2 + PADDING_BUTTON_STEP);
    });
  });
});
