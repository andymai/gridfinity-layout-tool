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
      'binDesigner.walls.pattern.round': 'Round',
      'binDesigner.walls.pattern.diamond': 'Diamond',
      'binDesigner.walls.pattern.triangle': 'Triangle',
      'binDesigner.walls.pattern.slots': 'Slots',
      'binDesigner.walls.pattern.mitsukude': 'Mitsukude (三つ組手)',
      'binDesigner.walls.pattern.goma': 'Goma (護摩)',
      'binDesigner.walls.pattern.asanoha': 'Asanoha (麻の葉)',
      'binDesigner.walls.pattern.sakura': 'Sakura (桜)',
      'binDesigner.walls.pattern.rindo': 'Rindo (竜胆)',
      'binDesigner.walls.pattern.mikado': 'Mikado (帝つなぎ)',
      'binDesigner.walls.pattern.tsumiishiKikko': 'Tsumiishi-Kikko (積石亀甲)',
      'binDesigner.walls.pattern.groupKumiko': 'Kumiko',
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

    expect(options).toHaveLength(13);
    expect(options[0]).toHaveTextContent('Solid walls');
    expect(options[1]).toHaveTextContent('Honeycomb');
    expect(options[2]).toHaveTextContent('Round');
    expect(options[3]).toHaveTextContent('Diamond');
    expect(options[4]).toHaveTextContent('Triangle');
    expect(options[5]).toHaveTextContent('Slots');
    expect(options[6]).toHaveTextContent('Mitsukude (三つ組手)');
    expect(options[7]).toHaveTextContent('Goma (護摩)');
    expect(options[8]).toHaveTextContent('Asanoha (麻の葉)');
    expect(options[9]).toHaveTextContent('Sakura (桜)');
    expect(options[10]).toHaveTextContent('Rindo (竜胆)');
    expect(options[11]).toHaveTextContent('Mikado (帝つなぎ)');
    expect(options[12]).toHaveTextContent('Tsumiishi-Kikko (積石亀甲)');
  });

  it('groups kumiko patterns under a Kumiko optgroup', () => {
    render(<PatternSelector selectedPattern={null} onChange={() => {}} />);

    const select = screen.getByRole('combobox');
    const group = select.querySelector('optgroup');
    expect(group).toHaveAttribute('label', 'Kumiko');
    expect(group?.querySelectorAll('option')).toHaveLength(7);
  });

  it('selects mitsukude from the kumiko group', () => {
    const onChange = vi.fn();
    render(<PatternSelector selectedPattern={null} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mitsukude' } });
    expect(onChange).toHaveBeenCalledWith('mitsukude');
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

  it('offers only the narrowed set when `patterns` is given', () => {
    render(
      <PatternSelector
        selectedPattern="round"
        onChange={() => {}}
        patterns={['round', 'honeycomb']}
      />
    );

    // Order follows the canonical option list, not the order given here.
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Solid walls', 'Honeycomb', 'Round']);
  });

  it('falls back to the none entry when the value is outside the narrowed set', () => {
    // A kumiko pattern is a valid WallPatternType but not offered on a floor;
    // binding the select to the raw prop would render a blank selection.
    render(
      <PatternSelector
        selectedPattern="mitsukude"
        onChange={() => {}}
        patterns={['round', 'honeycomb']}
      />
    );

    expect(screen.getByRole('combobox')).toHaveValue('none');
  });
});
