import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutPresetChips } from './CutoutPresetChips';
import type { CutoutSizePreset } from './cutoutShapePresets';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// Stub the "More…" dropdown so we can assert overflow presets are routed there.
vi.mock('./CutoutPresetMenu', () => ({
  CutoutPresetMenu: ({ presets }: { presets: readonly CutoutSizePreset[] }) => (
    <div data-testid="more-menu" data-count={presets.length} />
  ),
}));

const PRESETS: CutoutSizePreset[] = [
  { id: 'a', label: '1/4" hex bit (6.35mm)', mm: 6.35 },
  { id: 'b', label: 'Allen 2mm', mm: 2 },
  { id: 'c', label: 'Allen 3mm', mm: 3 },
  { id: 'd', label: 'Allen 4mm', mm: 4 },
];

describe('CutoutPresetChips', () => {
  it('renders the first N presets as chips and routes the rest to the More menu', () => {
    render(<CutoutPresetChips presets={PRESETS} onPick={vi.fn()} maxChips={2} />);
    // Two chips, labelled by full spec for a11y.
    expect(screen.getByRole('button', { name: '1/4" hex bit (6.35mm)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allen 2mm' })).toBeInTheDocument();
    // Remaining 2 presets live in the More menu.
    const more = screen.getByTestId('more-menu');
    expect(more).toHaveAttribute('data-count', '2');
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

  it('omits the More menu when all presets fit as chips', () => {
    render(<CutoutPresetChips presets={PRESETS} onPick={vi.fn()} maxChips={4} />);
    expect(screen.queryByTestId('more-menu')).not.toBeInTheDocument();
  });
});
