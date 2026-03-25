import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsSection } from './ColorsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('ColorsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        featureColors: { body: 'slot1', lip: 'slot2', labelTab: 'slot1' },
      },
      ui: { ...DEFAULT_UI_STATE },
    });
    useSettingsStore.getState().updateSetting('filamentPalette', [
      { id: 'slot1', name: 'Primary', color: '#d4d8dc' },
      { id: 'slot2', name: 'Accent', color: '#3b82f6' },
      { id: 'slot3', name: 'Slot 3', color: '#22c55e' },
      { id: 'slot4', name: 'Slot 4', color: '#ef4444' },
    ]);
  });

  it('renders body, lip, and label tab zone labels', () => {
    render(<ColorsSection />);
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getByText('Stacking Lip')).toBeDefined();
    expect(screen.getByText('Label Tab')).toBeDefined();
  });

  it('renders palette header with swatch buttons', () => {
    render(<ColorsSection />);
    expect(screen.getByText('Filament Palette')).toBeDefined();
    expect(screen.getByText('Primary')).toBeDefined();
    expect(screen.getByText('Accent')).toBeDefined();
  });

  it('renders swatch buttons for each zone row', () => {
    render(<ColorsSection />);
    // Each zone has 4 swatches + 4 palette header buttons = plenty of buttons
    const buttons = screen.getAllByRole('button');
    // 4 palette + 4*3 zone swatches = 16 buttons total
    expect(buttons.length).toBe(16);
  });

  it('disables lip row when stacking lip is off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        featureColors: { body: 'slot1', lip: 'slot1', labelTab: 'slot1' },
      },
    });

    render(<ColorsSection />);
    // Lip row should have opacity-40 class on its container
    const lipLabel = screen.getByText('Stacking Lip');
    const lipRow = lipLabel.closest('div');
    expect(lipRow?.className).toContain('opacity-40');
  });

  it('disables label tab row when labels are off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
        featureColors: { body: 'slot1', lip: 'slot1', labelTab: 'slot1' },
      },
    });

    render(<ColorsSection />);
    const labelTabText = screen.getByText('Label Tab');
    const labelRow = labelTabText.closest('div');
    expect(labelRow?.className).toContain('opacity-40');
  });

  it('updates feature colors when swatch clicked', () => {
    render(<ColorsSection />);
    // Zone row swatch buttons have title={slot.name}, palette header buttons do not
    const accentSwatches = screen.getAllByTitle('Accent');
    // First match is the body row's Accent swatch
    fireEvent.click(accentSwatches[0]);
    const state = useDesignerStore.getState();
    expect(state.params.featureColors.body).toBe('slot2');
  });
});
