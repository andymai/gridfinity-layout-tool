import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverhangSliderRow } from './OverhangSliderRow';

const base = {
  label: 'Left',
  value: 4,
  onChange: vi.fn(),
  min: 0,
  max: 21,
  step: 0.5,
  unit: 'mm',
};

describe('OverhangSliderRow', () => {
  it('exposes the slider with its label and value in both layouts', () => {
    const { unmount } = render(<OverhangSliderRow {...base} stacked={false} />);
    expect(screen.getByRole('slider', { name: 'Left' })).toBeDefined();
    unmount();

    render(<OverhangSliderRow {...base} stacked />);
    expect(screen.getByRole('slider', { name: 'Left' })).toBeDefined();
  });

  it('shows the bare value', () => {
    render(<OverhangSliderRow {...base} value={21} stacked={false} />);
    expect(screen.getByRole('button', { name: /Left/ }).textContent).toBe('21');
  });

  it('disambiguates repeated side names via srLabel', () => {
    render(<OverhangSliderRow {...base} stacked={false} srLabel="Flare Left" />);
    expect(screen.getByRole('slider', { name: 'Flare Left' })).toBeDefined();
  });
});
