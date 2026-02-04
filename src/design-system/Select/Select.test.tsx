import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
];

describe('Select', () => {
  describe('rendering', () => {
    it('renders a select element', () => {
      render(<Select options={options} aria-label="Choice" />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('renders all options', () => {
      render(<Select options={options} aria-label="Choice" />);
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Gamma')).toBeInTheDocument();
    });

    it('renders placeholder option', () => {
      render(<Select options={options} placeholder="Pick one" aria-label="Choice" />);
      expect(screen.getByText('Pick one')).toBeInTheDocument();
    });

    it('disables individual options', () => {
      render(<Select options={options} aria-label="Choice" />);
      const gammaOption = screen.getByText('Gamma');
      expect(gammaOption.disabled).toBe(true);
    });
  });

  describe('interactions', () => {
    it('calls onChange when selection changes', () => {
      const onChange = vi.fn();
      render(<Select options={options} onChange={onChange} aria-label="Choice" />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('reflects controlled value', () => {
      render(<Select options={options} value="b" onChange={vi.fn()} aria-label="Choice" />);
      expect(screen.getByRole('combobox')).toHaveValue('b');
    });
  });

  describe('error state', () => {
    it('sets aria-invalid when error', () => {
      render(<Select options={options} error aria-label="Choice" />);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('disabled', () => {
    it('disables the select', () => {
      render(<Select options={options} disabled aria-label="Choice" />);
      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });

  describe('color swatch', () => {
    it('renders color swatch when provided', () => {
      const { container } = render(
        <Select options={options} colorSwatch="#ff0000" aria-label="Choice" />
      );
      const swatch = container.querySelector('[aria-hidden="true"]');
      expect(swatch).toBeInTheDocument();
    });

    it('renders mixed indicator for null swatch', () => {
      const { container } = render(
        <Select options={options} colorSwatch={null} aria-label="Choice" />
      );
      const swatch = container.querySelector('[aria-hidden="true"]');
      expect(swatch).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to select element', () => {
      const ref = vi.fn();
      render(<Select ref={ref} options={options} aria-label="Choice" />);
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLSelectElement));
    });
  });
});
