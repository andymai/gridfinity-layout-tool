import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('steps aside when the lid slider is on screen too', () => {
    const alone = render(<FeetDetachSlider value={0} onChange={vi.fn()} />);
    const beside = render(<FeetDetachSlider value={0} onChange={vi.fn()} showsBesideLid />);
    expect(alone.container.querySelector('.right-2')).not.toBeNull();
    expect(beside.container.querySelector('.right-16')).not.toBeNull();
  });
});
