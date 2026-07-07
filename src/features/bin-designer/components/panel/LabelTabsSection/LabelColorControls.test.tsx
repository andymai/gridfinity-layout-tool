import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelColorControls } from './LabelColorControls';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

const BODY = DEFAULT_FEATURE_COLOR_CONFIG.body; // '#d4d8dc' — also the "Light Grey" preset
const RED = '#ef4444'; // the "Red" filament preset, distinct from the body color

function setColors(overrides: Partial<FeatureColorConfig>) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      featureColors: { ...DEFAULT_FEATURE_COLOR_CONFIG, enabled: false, ...overrides },
    },
    ui: { ...DEFAULT_UI_STATE },
  });
}

describe('LabelColorControls', () => {
  beforeEach(() => {
    setColors({});
  });

  it('renders a Tab and Engraved Text swatch row', () => {
    render(<LabelColorControls />);
    expect(screen.getByText('Color')).toBeDefined();
    expect(screen.getByRole('button', { name: /Label Tab:/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Engraved Text:/ })).toBeDefined();
  });

  it('picks the zone for the swap tool instead of opening the picker when swap is active', () => {
    setColors({ enabled: true });
    useDesignerStore.setState((s) => ({ ui: { ...s.ui, colorTool: 'swap-pick-first' } }));
    render(<LabelColorControls />);
    fireEvent.click(screen.getByRole('button', { name: /Label Tab:/ }));

    // The picker stays closed; the click registered the tab as the first swap pick.
    expect(screen.queryByText('Presets')).toBeNull();
    const { ui } = useDesignerStore.getState();
    expect(ui.swapFirstZone).toBe('labelTab');
    expect(ui.colorTool).toBe('swap-pick-second');
  });

  it('enables multi-color and sets the tab color when a non-body color is picked', () => {
    render(<LabelColorControls />);
    fireEvent.click(screen.getByRole('button', { name: /Label Tab:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));

    const { featureColors } = useDesignerStore.getState().params;
    expect(featureColors.enabled).toBe(true);
    expect(featureColors.labelTab.toLowerCase()).toBe(RED);
  });

  it('routes the text swatch to the text zone', () => {
    render(<LabelColorControls />);
    fireEvent.click(screen.getByRole('button', { name: /Engraved Text:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));

    const { featureColors } = useDesignerStore.getState().params;
    expect(featureColors.enabled).toBe(true);
    expect(featureColors.text.toLowerCase()).toBe(RED);
    expect(featureColors.labelTab.toLowerCase()).toBe(BODY.toLowerCase());
  });

  it('does not force-enable multi-color when a swatch is set back to the body color', () => {
    // Start with a non-body tab color so picking the body-colored preset is a
    // real change (not an idempotent no-op the picker would swallow).
    setColors({ enabled: false, labelTab: RED });
    render(<LabelColorControls />);
    fireEvent.click(screen.getByRole('button', { name: /Label Tab:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Light Grey' }));

    const { featureColors } = useDesignerStore.getState().params;
    expect(featureColors.labelTab.toLowerCase()).toBe(BODY.toLowerCase());
    expect(featureColors.enabled).toBe(false);
  });
});
