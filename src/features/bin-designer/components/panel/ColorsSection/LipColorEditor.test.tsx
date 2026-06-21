import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LipColorEditor } from './LipColorEditor';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import type { LipColorConfig } from '@/features/bin-designer/types/featureColors';

vi.mock('@/i18n', () => ({ useTranslation: () => (key: string) => key }));

function lip(corners: 1 | 2 | 4, bands: 1 | 2 | 4): LipColorConfig {
  return { corners, bands, cells: makeUniformLipCells('#d4d8dc') };
}

function renderEditor(overrides: Partial<Parameters<typeof LipColorEditor>[0]> = {}) {
  const props = {
    lip: lip(1, 1),
    bodyColor: '#000000',
    hovered: null,
    recentColors: [] as readonly string[],
    swapActive: false,
    otherColorsFor: () => [] as readonly string[],
    onSetCorners: vi.fn(),
    onSetBands: vi.fn(),
    onChangeCell: vi.fn(),
    onHover: vi.fn(),
    onGestureStart: vi.fn(),
    onGestureEnd: vi.fn(),
    onSwap: vi.fn(),
    ...overrides,
  };
  render(<LipColorEditor {...props} />);
  return props;
}

const revealGrid = () =>
  fireEvent.click(screen.getByRole('checkbox', { name: 'binDesigner.colors.lip.splitZones' }));

describe('LipColorEditor', () => {
  it('defaults to a single lip color with the grid controls hidden', () => {
    renderEditor({ lip: lip(1, 1) });
    expect(screen.getByText('binDesigner.colors.lip')).toBeDefined();
    expect(
      screen.queryByRole('radiogroup', { name: 'binDesigner.colors.lip.cornersLabel' })
    ).toBeNull();
    expect(
      screen.getByRole('checkbox', {
        name: 'binDesigner.colors.lip.splitZones',
      }).checked
    ).toBe(false);
  });

  it('reveals the Corners/Bands grid when split is enabled', () => {
    renderEditor({ lip: lip(1, 1) });
    revealGrid();
    expect(
      screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.cornersLabel' })
    ).toBeDefined();
    expect(
      screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.bandsLabel' })
    ).toBeDefined();
  });

  it('toggles the split by clicking the visible label text (no nested label)', () => {
    // The Checkbox renders its own <label htmlFor>. Wrapping it in a second
    // <label> nested two labels, making the visually-hidden input the labeled
    // control — clicking it scrolled the panel to its bottom. Clicking the
    // visible text must route through a single label and reveal the grid.
    renderEditor({ lip: lip(1, 1) });
    expect(
      screen.queryByRole('radiogroup', { name: 'binDesigner.colors.lip.cornersLabel' })
    ).toBeNull();
    fireEvent.click(screen.getByText('binDesigner.colors.lip.splitZones'));
    expect(
      screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.cornersLabel' })
    ).toBeDefined();
  });

  it('auto-shows the grid for a design that already has multiple zones', () => {
    renderEditor({ lip: lip(2, 2) });
    // No opt-in needed — controls render and the toggle reads as enabled.
    expect(
      screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.cornersLabel' })
    ).toBeDefined();
    expect(screen.getAllByText(/binDesigner\.colors\.lip\.bandN/)).toHaveLength(4);
    expect(
      screen.getByRole('checkbox', {
        name: 'binDesigner.colors.lip.splitZones',
      }).checked
    ).toBe(true);
  });

  it('collapsing the split resets the lip to a single color', () => {
    const props = renderEditor({ lip: lip(2, 2) });
    revealGrid(); // already shown (multi-cell); clicking unchecks it
    expect(props.onSetCorners).toHaveBeenCalledWith(1);
    expect(props.onSetBands).toHaveBeenCalledWith(1);
  });

  it('fires onSetCorners when the Corners control changes', () => {
    const props = renderEditor({ lip: lip(1, 1) });
    revealGrid();
    const group = screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.cornersLabel' });
    fireEvent.click(within(group).getByText('4'));
    expect(props.onSetCorners).toHaveBeenCalledWith(4);
  });

  it('fires onSetBands when the Bands control changes', () => {
    const props = renderEditor({ lip: lip(1, 1) });
    revealGrid();
    const group = screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.bandsLabel' });
    fireEvent.click(within(group).getByText('2'));
    expect(props.onSetBands).toHaveBeenCalledWith(2);
  });

  it('names each segment by its value, not the wrapping label', () => {
    // A <label> wrapping the radiogroup would leak its text onto the first
    // radio (accessible name "Corners Corners"), so the value-1 segment would
    // be unreachable by name. Each segment must be named by its own value.
    renderEditor({ lip: lip(2, 2) });
    for (const groupLabel of [
      'binDesigner.colors.lip.cornersLabel',
      'binDesigner.colors.lip.bandsLabel',
    ]) {
      const group = screen.getByRole('radiogroup', { name: groupLabel });
      for (const value of ['1', '2', '4']) {
        expect(within(group).getByRole('radio', { name: value })).toBeDefined();
      }
    }
  });
});
