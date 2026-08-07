import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hint, Readout } from './panelText';

describe('panelText', () => {
  it('renders a hint', () => {
    render(<Hint>Limited by the tray wall.</Hint>);
    expect(screen.getByText('Limited by the tray wall.')).toBeInTheDocument();
  });

  it('renders a readout with tabular figures so digits do not jitter as values change', () => {
    render(<Readout>1.5mm deep</Readout>);
    expect(screen.getByText('1.5mm deep')).toHaveClass('tabular-nums');
  });
});
