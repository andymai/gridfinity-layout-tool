import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SliderInput } from './SliderInput';

describe('SliderInput', () => {
  const defaultProps = {
    label: 'Width',
    value: 5,
    onChange: vi.fn(),
    min: 1,
    max: 10,
  };

  it('renders label and slider', () => {
    render(<SliderInput {...defaultProps} />);
    expect(screen.getByText('Width')).toBeDefined();
    expect(screen.getByRole('slider')).toBeDefined();
  });

  it('shows value in the badge', () => {
    render(<SliderInput {...defaultProps} />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('shows unit suffix when provided', () => {
    render(<SliderInput {...defaultProps} unit="mm" />);
    expect(screen.getByText('mm')).toBeDefined();
  });

  it('shows info text when provided', () => {
    render(<SliderInput {...defaultProps} info="42mm per unit" />);
    expect(screen.getByText('42mm per unit')).toBeDefined();
  });

  it('applies disabled styling', () => {
    const { container } = render(<SliderInput {...defaultProps} disabled />);
    expect(container.querySelector('.opacity-50')).not.toBeNull();
  });

  it('enters edit mode on badge click and commits on blur', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} onChange={onChange} />);

    const badge = screen.getByText('5');
    fireEvent.click(badge);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('commits value on Enter key', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} onChange={onChange} />);

    const badge = screen.getByText('5');
    fireEvent.click(badge);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(9);
  });

  it('cancels editing on Escape key', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} onChange={onChange} />);

    const badge = screen.getByText('5');
    fireEvent.click(badge);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps value to max on commit', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} max={10} onChange={onChange} />);

    const badge = screen.getByText('5');
    fireEvent.click(badge);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('clamps value to min on commit', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} min={1} onChange={onChange} />);

    const badge = screen.getByText('5');
    fireEvent.click(badge);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('does not call onChange for NaN input', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} onChange={onChange} />);

    const badge = screen.getByText('5');
    fireEvent.click(badge);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps to step increment', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} step={0.5} onChange={onChange} />);

    const badge = screen.getByText('5');
    fireEvent.click(badge);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '7.3' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(7.5);
  });

  it('slider keyboard interaction calls onChange', () => {
    const onChange = vi.fn();
    render(<SliderInput {...defaultProps} value={5} step={1} onChange={onChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(6);
  });
});
