import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TallestStackMeter } from './TallestStackMeter';

describe('TallestStackMeter', () => {
  it('shows the tallest stack against the drawer', () => {
    render(<TallestStackMeter tallest={9} drawerHeight={12} />);
    expect(screen.getByText('Tallest stack')).toBeInTheDocument();
    expect(screen.getByText('9/12u')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Tallest stack' });
    expect(bar).toHaveAttribute('aria-valuenow', '9');
    expect(bar).toHaveAttribute('aria-valuemax', '12');
    expect(screen.queryByText(/taller than the drawer/)).not.toBeInTheDocument();
  });

  it('warns by how much a stack passes the drawer', () => {
    render(<TallestStackMeter tallest={13.5} drawerHeight={12} />);
    expect(screen.getByText('1.5u taller than the drawer')).toBeInTheDocument();
    expect(screen.getByText('13.5/12u')).toHaveClass('text-warning');
  });

  it('rounds a measured drawer height for display', () => {
    render(<TallestStackMeter tallest={0} drawerHeight={10.333333} />);
    expect(screen.getByText('0/10.33u')).toBeInTheDocument();
  });
});
