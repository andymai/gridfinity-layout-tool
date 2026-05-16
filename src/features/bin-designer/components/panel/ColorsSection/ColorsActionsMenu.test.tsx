import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsActionsMenu } from './ColorsActionsMenu';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_SETTINGS } from '@/core/store/settings.types';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/design-system/Popover/Popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const fc: FeatureColorConfig = {
  body: '#aaaaaa',
  lip: { frontLeft: '#aaaaaa', frontRight: '#aaaaaa', backRight: '#aaaaaa', backLeft: '#aaaaaa' },
  labelTab: '#aaaaaa',
  base: '#aaaaaa',
  scoop: '#aaaaaa',
  dividers: '#aaaaaa',
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
