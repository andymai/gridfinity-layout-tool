import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FeetDetachSlider } from './FeetDetachSlider';

describe('FeetDetachSlider', () => {
  it('labels its ends for feet rather than for a lid', () => {
    // The control is the lid's slider reused; if the label override is dropped
    // it silently falls back to "Open"/"Closed", which describes nothing here.
    render(<FeetDetachSlider value={0} onChange={vi.fn()} />);
    expect(screen.getByText('Attached')).toBeInTheDocument();
    expect(screen.getByText('Detached')).toBeInTheDocument();
  });

  it('names itself for assistive tech', () => {
    render(<FeetDetachSlider value={0} onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Detach feet' })).toBeInTheDocument();
  });

  it('reports the value it was given', () => {
    render(<FeetDetachSlider value={12} onChange={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveValue('12');
  });

  it('puts Attached at the top and Detached at the bottom', () => {
    // The drag has to move the part the way the part moves: feet drop DOWNWARD
    // off the bin, so the bottom of the track is the detached end. With the
    // lid's orientation the hand and the part went opposite ways.
    const { container } = render(<FeetDetachSlider value={0} onChange={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text.indexOf('Attached')).toBeLessThan(text.indexOf('Detached'));
  });

  it('fills from the top, the end its zero sits at', () => {
    const { container } = render(<FeetDetachSlider value={40} onChange={vi.fn()} />);
    const fill = container.querySelector('[data-testid="slider-fill"]');
    expect(fill?.className).toContain('top-0');
    expect(fill?.className).not.toContain('bottom-0');
  });

  it('moves the feet the way the arrow points', () => {
    // The keyboard is the fourth end of the inverted track: with the maximum
    // at the bottom, ArrowUp must move the thumb (and the feet) UP — i.e.
    // decrease — or the hand and the part go opposite ways again.
    const onChange = vi.fn();
    render(<FeetDetachSlider value={10} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(9);
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(11);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(80);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('steps aside when the lid slider is on screen too', () => {
    const alone = render(<FeetDetachSlider value={0} onChange={vi.fn()} />);
    const beside = render(<FeetDetachSlider value={0} onChange={vi.fn()} showsBesideLid />);
    expect(alone.container.querySelector('.right-2')).not.toBeNull();
    expect(beside.container.querySelector('.right-16')).not.toBeNull();
  });
});
