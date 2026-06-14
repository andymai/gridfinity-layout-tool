import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  StackSeparationSlider,
  STACK_SEPARATION_MIN,
  STACK_SEPARATION_MAX,
} from './StackSeparationSlider';

describe('StackSeparationSlider', () => {
  it('renders both end labels', () => {
    render(<StackSeparationSlider value={0} onChange={vi.fn()} />);
    expect(screen.getByText('Separate')).toBeInTheDocument();
    expect(screen.getByText('Together')).toBeInTheDocument();
  });

  it('exposes the value via aria attributes', () => {
    render(<StackSeparationSlider value={15} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuetext', '15mm');
    expect(slider).toHaveAttribute('aria-valuemin', String(STACK_SEPARATION_MIN));
    expect(slider).toHaveAttribute('aria-valuemax', String(STACK_SEPARATION_MAX));
  });

  it('emits a clamped value on keyboard step', () => {
    const onChange = vi.fn();
    render(<StackSeparationSlider value={STACK_SEPARATION_MAX} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    slider.focus();
    // ArrowUp at max should not exceed max (no change emitted).
    const before = onChange.mock.calls.length;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(onChange.mock.calls.length).toBe(before);
  });
});
