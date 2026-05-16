import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SnapClipExplodeSlider,
  SNAP_CLIP_OFFSET_MIN,
  SNAP_CLIP_OFFSET_MAX,
} from './SnapClipExplodeSlider';

describe('SnapClipExplodeSlider', () => {
  it('renders with the given value', () => {
    render(<SnapClipExplodeSlider value={20} onChange={vi.fn()} />);
    const input = screen.getByRole('slider');
    expect(input.value).toBe('20');
    expect(input.getAttribute('aria-valuenow')).toBe('20');
  });

  it('emits onChange on keyboard navigation', () => {
    const onChange = vi.fn();
    render(<SnapClipExplodeSlider value={10} onChange={onChange} />);
    const input = screen.getByRole('slider');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(11);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(9);

    fireEvent.keyDown(input, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(SNAP_CLIP_OFFSET_MAX);

    fireEvent.keyDown(input, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(SNAP_CLIP_OFFSET_MIN);
  });

  it('clamps values to the [MIN, MAX] range', () => {
    const onChange = vi.fn();
    render(<SnapClipExplodeSlider value={SNAP_CLIP_OFFSET_MAX} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    // Already at max; no further increase.
    expect(onChange).not.toHaveBeenCalled();
  });
});
