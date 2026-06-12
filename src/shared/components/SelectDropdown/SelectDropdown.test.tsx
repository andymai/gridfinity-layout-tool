import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectDropdown } from './SelectDropdown';

const options = [
  { id: 'cat1', name: 'Tools' },
  { id: 'cat2', name: 'Screws', suffix: ' (current)' },
];

describe('SelectDropdown', () => {
  it('renders all options', () => {
    render(
      <SelectDropdown value="cat1" onChange={vi.fn()} options={options} ariaLabel="Category" />
    );
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('selects current value', () => {
    render(
      <SelectDropdown value="cat2" onChange={vi.fn()} options={options} ariaLabel="Category" />
    );
    expect(screen.getByRole('combobox')).toHaveValue('cat2');
  });

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn();
    render(
      <SelectDropdown value="cat1" onChange={onChange} options={options} ariaLabel="Category" />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'cat2' } });
    expect(onChange).toHaveBeenCalledWith('cat2');
  });

  it('renders placeholder when provided', () => {
    render(
      <SelectDropdown
        value=""
        onChange={vi.fn()}
        options={options}
        placeholder={{ value: '', label: 'Select...', disabled: true }}
        ariaLabel="Category"
      />
    );
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('renders color swatch when provided', () => {
    const { container } = render(
      <SelectDropdown
        value="cat1"
        onChange={vi.fn()}
        options={options}
        colorSwatch="#ff0000"
        ariaLabel="Category"
      />
    );
    const swatch = container.querySelector('[style*="background-color"]');
    expect(swatch).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(
      <SelectDropdown value="cat1" onChange={vi.fn()} options={options} ariaLabel="Category" />
    );
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Category');
  });
});
