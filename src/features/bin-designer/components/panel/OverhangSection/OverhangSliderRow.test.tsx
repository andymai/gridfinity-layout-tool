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

  it('shows the cap in place of the bare value', () => {
    render(<OverhangSliderRow {...base} value={21} stacked={false} cap="21 of 21" />);
    expect(screen.getByRole('button', { name: /Left/ }).textContent).toBe('21 of 21');
  });

  it('ignores the cap in the stacked layout, which has room for a plain value', () => {
    render(<OverhangSliderRow {...base} value={21} stacked cap="21 of 21" />);
    expect(screen.getByRole('button', { name: /Left/ }).textContent).toBe('21');
  });

  it('renders an inert row instead of a control when there is nothing to taper', () => {
    render(<OverhangSliderRow {...base} stacked={false} inertReason="No overhang" />);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText('No overhang')).toBeDefined();
    // The label stays put so the four sides do not reflow as overhang changes.
    expect(screen.getByText('Left')).toBeDefined();
  });

  it('keeps the inert row out of the tab order entirely', () => {
    render(<OverhangSliderRow {...base} stacked={false} inertReason="No overhang" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
