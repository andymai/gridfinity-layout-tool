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
      'binDesigner.walls.pattern.gothic': 'Gothic arches',
    };
    return translations[key] ?? key;
  },
}));

describe('PatternSelector', () => {
  it('renders all pattern options', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} />);

    expect(screen.getByText('Wall pattern')).toBeInTheDocument();
    expect(screen.getByText('Solid walls')).toBeInTheDocument();
    expect(screen.getByText('Honeycomb')).toBeInTheDocument();
    expect(screen.getByText('Gothic arches')).toBeInTheDocument();
  });

  it('shows "none" as selected when pattern is null', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} />);

    const noneRadio = screen.getByRole('radio', { name: /solid walls/i });
    expect(noneRadio).toBeChecked();
  });

  it('shows honeycomb as selected when pattern is honeycomb', () => {
    render(<PatternSelector selectedPattern="honeycomb" onChange={() => {}} />);

    const honeycombRadio = screen.getByRole('radio', { name: /honeycomb/i });
    expect(honeycombRadio).toBeChecked();
  });

  it('shows gothic as selected when pattern is gothic', () => {
    render(<PatternSelector selectedPattern="gothic" onChange={() => {}} />);

    const gothicRadio = screen.getByRole('radio', { name: /gothic arches/i });
    expect(gothicRadio).toBeChecked();
  });

  it('calls onChange with null when "none" is selected', () => {
    const onChange = vi.fn();
    render(<PatternSelector selectedPattern="honeycomb" onChange={onChange} />);

    const noneRadio = screen.getByRole('radio', { name: /solid walls/i });
    fireEvent.click(noneRadio);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with honeycomb when honeycomb is selected', () => {
    const onChange = vi.fn();
    render(<PatternSelector selectedPattern={null} onChange={onChange} />);

    const honeycombRadio = screen.getByRole('radio', { name: /honeycomb/i });
    fireEvent.click(honeycombRadio);

    expect(onChange).toHaveBeenCalledWith('honeycomb');
  });

  it('calls onChange with gothic when gothic is selected', () => {
    const onChange = vi.fn();
    render(<PatternSelector selectedPattern={null} onChange={onChange} />);

    const gothicRadio = screen.getByRole('radio', { name: /gothic arches/i });
    fireEvent.click(gothicRadio);

    expect(onChange).toHaveBeenCalledWith('gothic');
  });

  it('disables all options when disabled prop is true', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} disabled />);

    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).toBeDisabled();
    });
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
