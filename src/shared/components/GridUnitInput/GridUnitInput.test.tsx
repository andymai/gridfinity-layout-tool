import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridUnitInput } from './GridUnitInput';

describe('GridUnitInput', () => {
  it('renders a single linked input for a square grid', () => {
    render(<GridUnitInput x={42} y={42} onChange={vi.fn()} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    expect(screen.getByLabelText('Grid unit X')).toHaveValue(42);
    expect(screen.getByLabelText('Unlink X and Y grid units')).toBeInTheDocument();
  });

  it('renders X and Y inputs for a non-square grid', () => {
    render(<GridUnitInput x={48} y={42} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Grid unit X')).toHaveValue(48);
    expect(screen.getByLabelText('Grid unit Y')).toHaveValue(42);
    expect(screen.getByLabelText('Link X and Y grid units')).toBeInTheDocument();
  });

  it('unlinks into X and Y inputs, then relinks back to square', () => {
    const onChange = vi.fn();
    render(<GridUnitInput x={42} y={42} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Unlink X and Y grid units'));
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Link X and Y grid units'));
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('reports a diverged Y pitch through onChange', () => {
    const onChange = vi.fn();
    render(<GridUnitInput x={48} y={48} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Unlink X and Y grid units'));
    const yInput = screen.getByLabelText('Grid unit Y');
    fireEvent.change(yInput, { target: { value: '42' } });
    fireEvent.blur(yInput);
    expect(onChange).toHaveBeenCalledWith(48, 42);
  });
});
