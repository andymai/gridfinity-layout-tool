import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CategoryChips } from './CategoryChips';

describe('CategoryChips', () => {
  it('shows every category at once instead of hiding them behind a control', () => {
    render(<CategoryChips value="" invalid={false} onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(8);
  });

  it('marks only the selected category as checked', () => {
    render(<CategoryChips value="kitchen" invalid={false} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Kitchen' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Tools' })).toHaveAttribute('aria-checked', 'false');
  });

  it('reports the chosen category', () => {
    const onChange = vi.fn();
    render(<CategoryChips value="" invalid={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Electronics' }));
    expect(onChange).toHaveBeenCalledWith('electronics');
  });

  it('exposes the required and invalid state to assistive technology', () => {
    render(<CategoryChips value="" invalid onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-required', 'true');
    expect(group).toHaveAttribute('aria-invalid', 'true');
  });
});
