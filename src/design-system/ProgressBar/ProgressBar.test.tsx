import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders with determinate value', () => {
    render(<ProgressBar value={60} label="Loading" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders indeterminate when value is omitted', () => {
    render(<ProgressBar label="Processing" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).not.toHaveAttribute('aria-valuemin');
    expect(bar).not.toHaveAttribute('aria-valuemax');
  });

  it('clamps value to 0-100 range', () => {
    const { rerender } = render(<ProgressBar value={-10} label="Test" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    rerender(<ProgressBar value={150} label="Test" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('applies size variant classes', () => {
    const { container } = render(<ProgressBar size="sm" value={50} label="Small" />);
    expect(container.firstChild).toHaveClass('h-1.5');
  });
});
