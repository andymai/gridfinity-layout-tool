import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  LidExplodeSlider,
  LID_OFFSET_DEFAULT,
  LID_OFFSET_MIN,
  LID_OFFSET_MAX,
} from './LidExplodeSlider';

describe('LidExplodeSlider', () => {
  it('renders with both end labels', () => {
    render(<LidExplodeSlider value={LID_OFFSET_DEFAULT} onChange={vi.fn()} />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('exposes the current value via aria-valuetext', () => {
    render(<LidExplodeSlider value={15} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuetext', '15mm');
  });

  it('default position is in the middle of the range', () => {
    expect(LID_OFFSET_DEFAULT).toBeGreaterThan(LID_OFFSET_MIN);
    expect(LID_OFFSET_DEFAULT).toBeLessThan(LID_OFFSET_MAX);
  });
});
