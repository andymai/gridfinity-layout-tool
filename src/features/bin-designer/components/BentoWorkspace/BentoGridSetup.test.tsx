import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoGridSetup, type BentoGridSetupProps } from './BentoGridSetup';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeProps(overrides: Partial<BentoGridSetupProps> = {}): BentoGridSetupProps {
  return {
    width: 2,
    depth: 2,
    wallThickness: 1.2,
    compartmentThickness: 1.2,
    gridUnitMm: 42,
    interiorW: 81,
    interiorD: 81,
    onPick: vi.fn(),
    ...overrides,
  };
}

describe('BentoGridSetup', () => {
  it('offers whole-, half- and third-unit grids for the bin size', () => {
    render(<BentoGridSetup {...makeProps()} />);

    expect(screen.getByText('2×2')).toBeInTheDocument();
    expect(screen.getByText('4×4')).toBeInTheDocument();
    expect(screen.getByText('6×6')).toBeInTheDocument();
  });

  it('picks a grid on click', () => {
    const onPick = vi.fn();
    render(<BentoGridSetup {...makeProps({ onPick })} />);

    fireEvent.click(screen.getByText('4×4'));

    expect(onPick).toHaveBeenCalledWith(4, 4);
  });

  it('clamps suggestions to the 12-cell ceiling and dedupes', () => {
    render(
      <BentoGridSetup {...makeProps({ width: 6, depth: 6, interiorW: 250, interiorD: 250 })} />
    );

    // 6u bin: whole=6×6, half=12×12, third clamps to 12×12 (deduped away).
    expect(screen.getByText('6×6')).toBeInTheDocument();
    expect(screen.getAllByText('12×12')).toHaveLength(1);
  });

  it('drops grid options whose cells would be under the minimum size', () => {
    // A 1×1u bin (39mm interior): 12 cells of ~3mm fail the 5mm minimum.
    render(<BentoGridSetup {...makeProps({ width: 1, depth: 1, interiorW: 39, interiorD: 39 })} />);

    expect(screen.queryByText('12×12')).not.toBeInTheDocument();
    expect(screen.getByText('2×2')).toBeInTheDocument();
  });
});
