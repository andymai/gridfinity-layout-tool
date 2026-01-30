import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortDropdown } from './SortDropdown';

const options = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'date', label: 'Date' },
];

describe('SortDropdown', () => {
  it('renders all options', () => {
    render(<SortDropdown options={options} value="name" onChange={vi.fn()} ariaLabel="Sort by" />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('selects current value', () => {
    render(<SortDropdown options={options} value="size" onChange={vi.fn()} ariaLabel="Sort by" />);
    expect(screen.getByRole('combobox')).toHaveValue('size');
  });

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn();
    render(<SortDropdown options={options} value="name" onChange={onChange} ariaLabel="Sort by" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'date' } });
    expect(onChange).toHaveBeenCalledWith('date');
  });

  it('has correct aria-label', () => {
    render(<SortDropdown options={options} value="name" onChange={vi.fn()} ariaLabel="Sort by" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Sort by');
  });
});
