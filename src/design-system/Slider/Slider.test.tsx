import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Slider } from './Slider';

describe('Slider', () => {
  const defaultProps = {
    value: 50,
    onChange: vi.fn(),
    min: 0,
    max: 100,
    'aria-label': 'Volume',
  };

  it('renders a slider role element', () => {
    render(<Slider {...defaultProps} />);
    expect(screen.getByRole('slider')).toBeDefined();
  });

  it('sets aria attributes from props', () => {
    render(<Slider {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-label', 'Volume');
  });

  it('supports keyboard ArrowRight to increment', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} onChange={onChange} step={1} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(51);
  });

  it('supports keyboard ArrowLeft to decrement', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} onChange={onChange} step={1} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(49);
  });

  it('clamps keyboard increments to max', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} value={100} onChange={onChange} step={1} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps keyboard decrements to min', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} value={0} onChange={onChange} step={1} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports Home key to jump to min', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('supports End key to jump to max', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('does not respond to keyboard when disabled', () => {
    const onChange = vi.fn();
    render(<Slider {...defaultProps} onChange={onChange} disabled />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders filled track proportional to value', () => {
    const { container } = render(<Slider {...defaultProps} value={75} />);
    const filledTrack = container.querySelector('[data-testid="slider-fill"]');
    expect(filledTrack).not.toBeNull();
    expect(filledTrack?.getAttribute('style')).toContain('width: 75%');
  });

  it('renders thumb at correct position', () => {
    const { container } = render(<Slider {...defaultProps} value={75} />);
    const thumb = container.querySelector('[data-testid="slider-thumb"]');
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute('style')).toContain('left: 75%');
  });

  it('applies disabled styles', () => {
    const { container } = render(<Slider {...defaultProps} disabled />);
    expect(container.firstChild).toHaveClass('opacity-50');
  });

  it('supports fractional step values', () => {
    const onChange = vi.fn();
    render(
      <Slider {...defaultProps} value={5.0} min={0} max={10} step={0.5} onChange={onChange} />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(5.5);
  });

  it('accepts aria-describedby for external descriptions', () => {
    render(<Slider {...defaultProps} aria-describedby="help-text" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-describedby', 'help-text');
  });
});
