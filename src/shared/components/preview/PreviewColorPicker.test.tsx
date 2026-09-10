import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewColorPicker } from './PreviewColorPicker';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const COLORS = [
  { color: '#111111', nameKey: 'colors.one' },
  { color: '#222222', nameKey: 'colors.two' },
] as const;

describe('PreviewColorPicker', () => {
  it('marks the active swatch and reports a pick', () => {
    const onColorSelect = vi.fn();
    render(
      <PreviewColorPicker colors={COLORS} previewColor="#222222" onColorSelect={onColorSelect} />
    );

    const swatches = screen.getAllByRole('option');
    expect(swatches).toHaveLength(2);
    expect(swatches[0]).toHaveAttribute('aria-selected', 'false');
    expect(swatches[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(swatches[0]);
    expect(onColorSelect).toHaveBeenCalledWith('#111111');
  });
});
