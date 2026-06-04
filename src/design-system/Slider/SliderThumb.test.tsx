import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SliderThumb } from './SliderThumb';

describe('SliderThumb', () => {
  it('renders three grip lines inside the knob', () => {
    const { getByTestId } = render(<SliderThumb />);
    const thumb = getByTestId('slider-thumb');
    expect(thumb.querySelectorAll('span')).toHaveLength(3);
  });

  it('forwards positioning className and style', () => {
    const { getByTestId } = render(
      <SliderThumb className="-translate-x-1/2" style={{ left: '40%' }} />
    );
    const thumb = getByTestId('slider-thumb');
    expect(thumb).toHaveClass('-translate-x-1/2');
    expect(thumb.getAttribute('style')).toContain('left: 40%');
  });

  it('applies the active scale + glow only when not disabled', () => {
    const { getByTestId, rerender } = render(<SliderThumb active />);
    expect(getByTestId('slider-thumb')).toHaveClass('scale-105', 'brightness-110');

    rerender(<SliderThumb active disabled />);
    expect(getByTestId('slider-thumb')).not.toHaveClass('scale-105');
  });
});
