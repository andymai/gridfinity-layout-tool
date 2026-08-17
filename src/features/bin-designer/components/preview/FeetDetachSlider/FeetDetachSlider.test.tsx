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
});
