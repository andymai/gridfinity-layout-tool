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

describe('LipColorEditor', () => {
  it('renders one cell row per active grid cell', () => {
    renderEditor({ lip: lip(2, 2) });
    // 2 corners × 2 bands = 4 cells; each label includes the band key
    // (mocked t returns the raw key, not interpolated copy).
    expect(screen.getAllByText(/binDesigner\.colors\.lip\.bandN/)).toHaveLength(4);
  });

  it('shows a single "Stacking Lip" label at 1×1', () => {
    renderEditor({ lip: lip(1, 1) });
    expect(screen.getByText('binDesigner.colors.lip')).toBeDefined();
  });

  it('fires onSetCorners when the Corners control changes', () => {
    const props = renderEditor({ lip: lip(1, 1) });
    const group = screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.cornersLabel' });
    fireEvent.click(within(group).getByText('4'));
    expect(props.onSetCorners).toHaveBeenCalledWith(4);
  });

  it('fires onSetBands when the Bands control changes', () => {
    const props = renderEditor({ lip: lip(1, 1) });
    const group = screen.getByRole('radiogroup', { name: 'binDesigner.colors.lip.bandsLabel' });
    fireEvent.click(within(group).getByText('2'));
    expect(props.onSetBands).toHaveBeenCalledWith(2);
  });

  it('names each segment by its value, not the wrapping label', () => {
    // A <label> wrapping the radiogroup would leak its text onto the first
    // radio (accessible name "Corners Corners"), so the value-1 segment would
    // be unreachable by name. Each segment must be named by its own value.
    renderEditor({ lip: lip(1, 1) });
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
