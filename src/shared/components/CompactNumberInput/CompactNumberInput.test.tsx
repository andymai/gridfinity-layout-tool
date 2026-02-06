import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompactNumberInput } from './CompactNumberInput';

describe('CompactNumberInput', () => {
  it('renders without crashing', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} />);

    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<CompactNumberInput label="W" value={25.5} onChange={vi.fn()} />);

    expect(screen.getByText('25.5')).toBeInTheDocument();
  });

  it('displays the unit when provided', () => {
    render(<CompactNumberInput label="R" value={90} onChange={vi.fn()} unit="°" />);

    expect(screen.getByText('°')).toBeInTheDocument();
  });

  it('applies disabled state', () => {
    render(<CompactNumberInput label="X" value={10} onChange={vi.fn()} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
