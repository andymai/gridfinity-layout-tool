import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stepper } from './Stepper';

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
      expect(screen.getByRole('textbox')).toHaveValue('5');
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
  });

  describe('ref forwarding', () => {
    it('forwards ref to container', () => {
      const ref = vi.fn();
      render(<Stepper {...defaultProps} ref={ref} displayValue={5} />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });
});
