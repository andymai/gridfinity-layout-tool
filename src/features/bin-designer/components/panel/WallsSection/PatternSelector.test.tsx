import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatternSelector } from './PatternSelector';

// Mock the translation function
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'binDesigner.walls.pattern.label': 'Wall pattern',
      'binDesigner.walls.pattern.none': 'Solid walls',
      'binDesigner.walls.pattern.honeycomb': 'Honeycomb',
    };
    return translations[key] ?? key;
  },
}));

describe('PatternSelector', () => {
  it('renders the label and dropdown', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} />);

    expect(screen.getByText('Wall pattern')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders all pattern options in dropdown', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} />);

    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');

    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Solid walls');
    expect(options[1]).toHaveTextContent('Honeycomb');
  });

  it('shows "none" as selected when pattern is null', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} />);

    const select = screen.getByRole('combobox');
    expect(select.value).toBe('none');
  });

  it('shows honeycomb as selected when pattern is honeycomb', () => {
    render(<PatternSelector selectedPattern="honeycomb" onChange={() => {}} />);

    const select = screen.getByRole('combobox');
    expect(select.value).toBe('honeycomb');
  });

  it('calls onChange with null when "none" is selected', () => {
    const onChange = vi.fn();
    render(<PatternSelector selectedPattern="honeycomb" onChange={onChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'none' } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with honeycomb when honeycomb is selected', () => {
    const onChange = vi.fn();
    render(<PatternSelector selectedPattern={null} onChange={onChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'honeycomb' } });

    expect(onChange).toHaveBeenCalledWith('honeycomb');
  });

  it('disables the dropdown when disabled prop is true', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} disabled />);

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('shows disabled reason when provided', () => {
    render(
      <PatternSelector
        selectedPattern={null}
        onChange={() => {}}
        disabled
        disabledReason="All walls have slots"
      />
    );

    expect(screen.getByText('All walls have slots')).toBeInTheDocument();
  });

  it('does not show disabled reason when enabled', () => {
    render(
      <PatternSelector
        selectedPattern={null}
        onChange={() => {}}
        disabledReason="All walls have slots"
      />
    );

    expect(screen.queryByText('All walls have slots')).not.toBeInTheDocument();
  });
});
