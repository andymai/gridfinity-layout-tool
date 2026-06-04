import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutPresetChips } from './CutoutPresetChips';
import type { CutoutSizePreset } from './cutoutShapePresets';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

const PRESETS: CutoutSizePreset[] = [
  { id: 'a', label: '1/4" hex bit (6.35mm)', mm: 6.35 },
  { id: 'b', label: 'Allen 2mm', mm: 2 },
  { id: 'c', label: 'Allen 3mm', mm: 3 },
  { id: 'd', label: 'Allen 4mm', mm: 4 },
];

const MORE = 'binDesigner.cutouts.sizePresetMore';

describe('CutoutPresetChips', () => {
  it('renders the first N presets as chips plus a "+N" expander for the rest', () => {
    render(<CutoutPresetChips presets={PRESETS} onPick={vi.fn()} maxChips={2} />);
    expect(screen.getByRole('button', { name: '1/4" hex bit (6.35mm)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allen 2mm' })).toBeInTheDocument();
    // Overflow presets are hidden until expanded.
    expect(screen.queryByRole('button', { name: 'Allen 3mm' })).not.toBeInTheDocument();
    const more = screen.getByRole('button', { name: MORE });
    expect(more).toHaveTextContent('+2');
  });

  it('reveals the remaining presets when the expander is clicked', () => {
    render(<CutoutPresetChips presets={PRESETS} onPick={vi.fn()} maxChips={2} />);
    fireEvent.click(screen.getByRole('button', { name: MORE }));
    expect(screen.getByRole('button', { name: 'Allen 3mm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allen 4mm' })).toBeInTheDocument();
  });

  it('shortens the chip label to the spec fraction or the mm value', () => {
    render(<CutoutPresetChips presets={PRESETS} onPick={vi.fn()} maxChips={2} />);
    expect(screen.getByText('1/4"')).toBeInTheDocument(); // fraction token
    expect(screen.getByText('2')).toBeInTheDocument(); // mm fallback
  });

  it('calls onPick with the preset mm when a chip is clicked', () => {
    const onPick = vi.fn();
    render(<CutoutPresetChips presets={PRESETS} onPick={onPick} maxChips={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Allen 2mm' }));
    expect(onPick).toHaveBeenCalledWith(2);
  });

  it('marks the active chip as pressed', () => {
    render(<CutoutPresetChips presets={PRESETS} onPick={vi.fn()} maxChips={3} activeMm={3} />);
    expect(screen.getByRole('button', { name: 'Allen 3mm' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Allen 2mm' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('omits the expander when all presets fit as chips', () => {
    render(<CutoutPresetChips presets={PRESETS} onPick={vi.fn()} maxChips={4} />);
    expect(screen.queryByRole('button', { name: MORE })).not.toBeInTheDocument();
  });
});
