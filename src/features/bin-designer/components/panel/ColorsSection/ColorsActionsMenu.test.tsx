import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsActionsMenu } from './ColorsActionsMenu';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_SETTINGS } from '@/core/store/settings.types';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/design-system/Popover/Popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const fc: FeatureColorConfig = {
  enabled: false,
  body: '#aaaaaa',
  lip: { corners: 1, bands: 1, cells: makeUniformLipCells('#aaaaaa') },
  labelTab: '#aaaaaa',
  base: '#aaaaaa',
  scoop: '#aaaaaa',
  dividers: '#aaaaaa',
  text: '#aaaaaa',
  lid: '#aaaaaa',
};

describe('ColorsActionsMenu', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  });

  it('opens the menu on trigger click and exposes Match-all-to-body', () => {
    render(
      <ColorsActionsMenu featureColors={fc} onMatchAllToBody={vi.fn()} onApplyPalette={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('binDesigner.colors.actions'));
    expect(screen.getByText('binDesigner.colors.matchAllToBody')).toBeInTheDocument();
  });

  it('invokes onMatchAllToBody when the menu item is clicked', () => {
    const onMatchAll = vi.fn();
    render(
      <ColorsActionsMenu
        featureColors={fc}
        onMatchAllToBody={onMatchAll}
        onApplyPalette={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('binDesigner.colors.actions'));
    fireEvent.click(screen.getByText('binDesigner.colors.matchAllToBody'));
    expect(onMatchAll).toHaveBeenCalled();
  });

  it('shows the empty-state when no palettes are saved', () => {
    render(
      <ColorsActionsMenu featureColors={fc} onMatchAllToBody={vi.fn()} onApplyPalette={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('binDesigner.colors.actions'));
    expect(screen.getByText('binDesigner.colors.noPalettes')).toBeInTheDocument();
  });

  it('saves a palette through the inline-input row (no window.prompt)', () => {
    render(
      <ColorsActionsMenu featureColors={fc} onMatchAllToBody={vi.fn()} onApplyPalette={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('binDesigner.colors.actions'));
    fireEvent.click(screen.getByText('binDesigner.colors.savePalette'));

    const input = screen.getByLabelText('binDesigner.colors.savePalette.prompt');
    fireEvent.change(input, { target: { value: 'My Palette' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const palettes = useSettingsStore.getState().settings.savedColorPalettes;
    expect(palettes).toHaveLength(1);
    expect(palettes[0].name).toBe('My Palette');
  });

  it('cancels the inline save row when Escape is pressed', () => {
    render(
      <ColorsActionsMenu featureColors={fc} onMatchAllToBody={vi.fn()} onApplyPalette={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText('binDesigner.colors.actions'));
    fireEvent.click(screen.getByText('binDesigner.colors.savePalette'));

    const input = screen.getByLabelText('binDesigner.colors.savePalette.prompt');
    fireEvent.change(input, { target: { value: 'discard me' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(
      screen.queryByLabelText('binDesigner.colors.savePalette.prompt')
    ).not.toBeInTheDocument();
    expect(useSettingsStore.getState().settings.savedColorPalettes).toHaveLength(0);
  });

  it('lists saved palettes and applies one on click', () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        savedColorPalettes: [
          {
            id: 'p1',
            name: 'Workshop',
            createdAt: new Date().toISOString(),
            colors: fc,
          },
        ],
      },
    });
    const onApply = vi.fn();
    render(
      <ColorsActionsMenu featureColors={fc} onMatchAllToBody={vi.fn()} onApplyPalette={onApply} />
    );
    fireEvent.click(screen.getByLabelText('binDesigner.colors.actions'));
    fireEvent.click(screen.getByText('Workshop'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ name: 'Workshop' }));
  });
});
