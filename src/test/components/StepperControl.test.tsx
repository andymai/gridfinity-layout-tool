import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepperControl } from '@/shared/components/StepperControl';

describe('StepperControl', () => {
  const mockOnStep = vi.fn();
  const mockOnChange = vi.fn();

  const defaultProps = {
    value: 5,
    onStep: mockOnStep,
    min: 0,
    max: 10,
    ariaLabel: 'Test value',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('variant rendering', () => {
    it('renders compact variant with smaller size', () => {
      const { container } = render(<StepperControl {...defaultProps} variant="compact" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('h-6');
    });

    it('renders desktop variant with standard size', () => {
      const { container } = render(<StepperControl {...defaultProps} variant="desktop" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('h-8');
    });

    it('renders mobile variant without fixed height class', () => {
      const { container } = render(<StepperControl {...defaultProps} variant="mobile" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveClass('h-6');
      expect(wrapper).not.toHaveClass('h-8');
    });

    it('defaults to desktop variant', () => {
      const { container } = render(<StepperControl {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('h-8');
    });
  });

  describe('button states', () => {
    it('disables decrease button when value equals min', () => {
      render(<StepperControl {...defaultProps} value={0} />);

      const decreaseButton = screen.getByRole('button', { name: 'Decrease Test value' });
      expect(decreaseButton).toBeDisabled();
    });

    it('disables increase button when value equals max', () => {
      render(<StepperControl {...defaultProps} value={10} />);

      const increaseButton = screen.getByRole('button', { name: 'Increase Test value' });
      expect(increaseButton).toBeDisabled();
    });

    it('enables both buttons when value is in range', () => {
      render(<StepperControl {...defaultProps} value={5} />);

      const decreaseButton = screen.getByRole('button', { name: 'Decrease Test value' });
      const increaseButton = screen.getByRole('button', { name: 'Increase Test value' });
      expect(decreaseButton).not.toBeDisabled();
      expect(increaseButton).not.toBeDisabled();
    });

    it('disables both buttons when disabled prop is true', () => {
      render(<StepperControl {...defaultProps} disabled />);

      const decreaseButton = screen.getByRole('button', { name: 'Decrease Test value' });
      const increaseButton = screen.getByRole('button', { name: 'Increase Test value' });
      expect(decreaseButton).toBeDisabled();
      expect(increaseButton).toBeDisabled();
    });
  });

  describe('step behavior', () => {
    it('calls onStep with -1 when decrease button clicked', () => {
      render(<StepperControl {...defaultProps} />);

      const decreaseButton = screen.getByRole('button', { name: 'Decrease Test value' });
      fireEvent.click(decreaseButton);

      expect(mockOnStep).toHaveBeenCalledWith(-1);
    });

    it('calls onStep with +1 when increase button clicked', () => {
      render(<StepperControl {...defaultProps} />);

      const increaseButton = screen.getByRole('button', { name: 'Increase Test value' });
      fireEvent.click(increaseButton);

      expect(mockOnStep).toHaveBeenCalledWith(1);
    });

    it('does not call onStep when decrease button is disabled', () => {
      render(<StepperControl {...defaultProps} value={0} />);

      const decreaseButton = screen.getByRole('button', { name: 'Decrease Test value' });
      fireEvent.click(decreaseButton);

      expect(mockOnStep).not.toHaveBeenCalled();
    });

    it('does not call onStep when increase button is disabled', () => {
      render(<StepperControl {...defaultProps} value={10} />);

      const increaseButton = screen.getByRole('button', { name: 'Increase Test value' });
      fireEvent.click(increaseButton);

      expect(mockOnStep).not.toHaveBeenCalled();
    });
  });

  describe('input mode', () => {
    it('renders input when onChange is provided', () => {
      render(<StepperControl {...defaultProps} onChange={mockOnChange} />);

      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('input has correct aria-label', () => {
      render(<StepperControl {...defaultProps} onChange={mockOnChange} />);

      expect(screen.getByLabelText('Test value')).toBeInTheDocument();
    });

    it('input shows current value', () => {
      render(<StepperControl {...defaultProps} onChange={mockOnChange} />);

      expect(screen.getByRole('spinbutton')).toHaveValue(5);
    });
  });

  describe('display mode', () => {
    it('renders display value when displayValue is provided', () => {
      render(<StepperControl {...defaultProps} displayValue="5u" />);

      expect(screen.getByText('5u')).toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('renders static display when neither onChange nor displayValue is provided', () => {
      render(<StepperControl {...defaultProps} />);

      // Should show the value as text without an input
      const display = screen.getByLabelText('Test value');
      expect(display).toBeInTheDocument();
      expect(display.tagName.toLowerCase()).toBe('span');
    });
  });

  describe('aria-label propagation', () => {
    it('applies aria-label to decrease button', () => {
      render(<StepperControl {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Decrease Test value' })).toBeInTheDocument();
    });

    it('applies aria-label to increase button', () => {
      render(<StepperControl {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Increase Test value' })).toBeInTheDocument();
    });

    it('applies aria-label to display element', () => {
      render(<StepperControl {...defaultProps} displayValue="5u" />);

      expect(screen.getByLabelText('Test value')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies additional className to container', () => {
      const { container } = render(
        <StepperControl {...defaultProps} className="custom-class" />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});
