import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Stepper, DEFERRED_COMMIT_DELAY_MS } from './Stepper';

const defaultProps = {
  value: 5,
  onStep: vi.fn(),
  min: 0,
  max: 10,
  'aria-label': 'Quantity' as const,
};

describe('Stepper', () => {
  describe('display mode', () => {
    it('shows display value when provided', () => {
      render(<Stepper {...defaultProps} displayValue="5u" />);
      expect(screen.getByText('5u')).toBeInTheDocument();
    });

    it('does not render an input in display mode', () => {
      render(<Stepper {...defaultProps} displayValue="5u" />);
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('input mode', () => {
    it('renders an input with the value', () => {
      render(<Stepper {...defaultProps} onChange={vi.fn()} />);
      expect(screen.getByRole('spinbutton')).toHaveValue(5);
    });

    it('commits a clamped value on Enter', () => {
      const onChange = vi.fn();
      render(<Stepper {...defaultProps} onChange={onChange} max={10} />);
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('preserves off-grid typed values (no snap to step)', () => {
      const onChange = vi.fn();
      render(<Stepper {...defaultProps} onChange={onChange} step={0.5} inputDecimals={2} />);
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '5.25' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(5.25);
    });

    it('renders fractional values at the given precision', () => {
      render(<Stepper {...defaultProps} value={5.5} onChange={vi.fn()} inputDecimals={2} />);
      expect(screen.getByRole('spinbutton')).toHaveValue(5.5);
    });
  });

  describe('stepper buttons', () => {
    it('calls onStep with -1 for decrease', () => {
      const onStep = vi.fn();
      render(<Stepper {...defaultProps} onStep={onStep} displayValue={5} />);
      fireEvent.click(screen.getByLabelText('Decrease Quantity'));
      expect(onStep).toHaveBeenCalledWith(-1);
    });

    it('calls onStep with +1 for increase', () => {
      const onStep = vi.fn();
      render(<Stepper {...defaultProps} onStep={onStep} displayValue={5} />);
      fireEvent.click(screen.getByLabelText('Increase Quantity'));
      expect(onStep).toHaveBeenCalledWith(1);
    });

    it('disables decrease button at min', () => {
      render(<Stepper {...defaultProps} value={0} displayValue={0} />);
      expect(screen.getByLabelText('Decrease Quantity')).toBeDisabled();
    });

    it('disables increase button at max', () => {
      render(<Stepper {...defaultProps} value={10} displayValue={10} />);
      expect(screen.getByLabelText('Increase Quantity')).toBeDisabled();
    });

    it('disables both buttons when disabled', () => {
      render(<Stepper {...defaultProps} disabled displayValue={5} />);
      expect(screen.getByLabelText('Decrease Quantity')).toBeDisabled();
      expect(screen.getByLabelText('Increase Quantity')).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('labels stepper buttons with aria-label context', () => {
      render(<Stepper {...defaultProps} displayValue={5} />);
      expect(screen.getByLabelText('Decrease Quantity')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase Quantity')).toBeInTheDocument();
    });

    it('uses custom increase/decrease labels when provided', () => {
      render(
        <Stepper
          {...defaultProps}
          displayValue={5}
          increaseLabel="More padding"
          decreaseLabel="Less padding"
        />
      );
      expect(screen.getByLabelText('More padding')).toBeInTheDocument();
      expect(screen.getByLabelText('Less padding')).toBeInTheDocument();
    });
  });

  describe('orientation: vertical', () => {
    it('stacks as a column with increase on top, decrease on bottom', () => {
      const ref = vi.fn();
      render(<Stepper {...defaultProps} ref={ref} orientation="vertical" displayValue={5} />);
      const container = ref.mock.calls[0][0] as HTMLDivElement;
      expect(container).toHaveClass('flex-col');
      // Increase button precedes decrease button in DOM order (visually on top).
      const increase = screen.getByLabelText('Increase Quantity');
      const decrease = screen.getByLabelText('Decrease Quantity');
      expect(increase.compareDocumentPosition(decrease)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('steps the same way as horizontal', () => {
      const onStep = vi.fn();
      render(<Stepper {...defaultProps} onStep={onStep} orientation="vertical" displayValue={5} />);
      fireEvent.click(screen.getByLabelText('Increase Quantity'));
      expect(onStep).toHaveBeenCalledWith(1);
    });
  });

  describe('fullWidth', () => {
    it('stretches the container when fullWidth is set', () => {
      const ref = vi.fn();
      render(<Stepper {...defaultProps} ref={ref} displayValue={5} fullWidth />);
      const container = ref.mock.calls[0][0] as HTMLDivElement;
      expect(container).toHaveClass('flex', 'w-full');
      expect(container).not.toHaveClass('inline-flex');
    });

    it('stays inline by default', () => {
      const ref = vi.fn();
      render(<Stepper {...defaultProps} ref={ref} displayValue={5} />);
      const container = ref.mock.calls[0][0] as HTMLDivElement;
      expect(container).toHaveClass('inline-flex');
      expect(container).not.toHaveClass('w-full');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to container', () => {
      const ref = vi.fn();
      render(<Stepper {...defaultProps} ref={ref} displayValue={5} />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe("commitMode: 'deferred'", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('coalesces rapid clicks into a single onStep call', () => {
      const onStep = vi.fn();
      render(
        <Stepper {...defaultProps} onStep={onStep} onChange={vi.fn()} commitMode="deferred" />
      );
      const increase = screen.getByLabelText('Increase Quantity');

      fireEvent.click(increase);
      fireEvent.click(increase);
      fireEvent.click(increase);
      expect(onStep).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(DEFERRED_COMMIT_DELAY_MS);
      });

      expect(onStep).toHaveBeenCalledTimes(1);
      expect(onStep).toHaveBeenCalledWith(3);
    });

    it('shows the optimistic value while the commit is pending', () => {
      render(
        <Stepper {...defaultProps} onStep={vi.fn()} onChange={vi.fn()} commitMode="deferred" />
      );
      const increase = screen.getByLabelText('Increase Quantity');
      fireEvent.click(increase);
      fireEvent.click(increase);
      expect(screen.getByRole('spinbutton')).toHaveValue(7);
    });

    it('drops the pending delta if the value changes externally', () => {
      const onStep = vi.fn();
      const { rerender } = render(
        <Stepper {...defaultProps} onStep={onStep} onChange={vi.fn()} commitMode="deferred" />
      );
      fireEvent.click(screen.getByLabelText('Increase Quantity'));

      rerender(
        <Stepper
          {...defaultProps}
          value={9}
          onStep={onStep}
          onChange={vi.fn()}
          commitMode="deferred"
        />
      );

      act(() => {
        vi.advanceTimersByTime(DEFERRED_COMMIT_DELAY_MS);
      });

      expect(onStep).not.toHaveBeenCalled();
    });

    it("fires onStep synchronously when commitMode is 'immediate'", () => {
      const onStep = vi.fn();
      render(<Stepper {...defaultProps} onStep={onStep} displayValue={5} />);
      fireEvent.click(screen.getByLabelText('Increase Quantity'));
      expect(onStep).toHaveBeenCalledWith(1);
    });
  });
});
