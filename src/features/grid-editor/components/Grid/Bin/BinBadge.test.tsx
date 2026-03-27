import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinBadge } from './BinBadge';

describe('BinBadge', () => {
  it('renders with aria-label', () => {
    render(<BinBadge small={false} label="Test badge" path="M0 0L10 10" />);
    expect(screen.getByLabelText('Test badge')).toBeInTheDocument();
  });

  it('renders small variant with smaller icon', () => {
    const { container } = render(<BinBadge small={true} label="Small" path="M0 0L10 10" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-2.5')).toBe(true);
  });

  it('renders normal variant with larger icon', () => {
    const { container } = render(<BinBadge small={false} label="Normal" path="M0 0L10 10" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-3')).toBe(true);
  });

  it('applies custom color class', () => {
    const { container } = render(
      <BinBadge small={false} label="Custom" path="M0 0" colorClass="text-red-500" />
    );
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('text-red-500')).toBe(true);
  });
});
