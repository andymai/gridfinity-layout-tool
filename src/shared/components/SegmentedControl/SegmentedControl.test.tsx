import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'assembled' as const, label: 'Assembled' },
  { value: 'exploded' as const, label: 'Exploded' },
];

describe('SegmentedControl', () => {
  it('renders all options', () => {
    render(
      <SegmentedControl options={OPTIONS} value="assembled" onChange={vi.fn()} ariaLabel="View" />
    );
    expect(screen.getByText('Assembled')).toBeInTheDocument();
    expect(screen.getByText('Exploded')).toBeInTheDocument();
  });

  it('marks active option with aria-pressed="true"', () => {
    render(
      <SegmentedControl options={OPTIONS} value="assembled" onChange={vi.fn()} ariaLabel="View" />
    );
    expect(screen.getByText('Assembled').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Exploded').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange when inactive option is clicked', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl options={OPTIONS} value="assembled" onChange={onChange} ariaLabel="View" />
    );
    fireEvent.click(screen.getByText('Exploded'));
    expect(onChange).toHaveBeenCalledWith('exploded');
  });

  it('has accessible group role and label', () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="assembled"
        onChange={vi.fn()}
        ariaLabel="View mode"
      />
    );
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'View mode');
  });
});
