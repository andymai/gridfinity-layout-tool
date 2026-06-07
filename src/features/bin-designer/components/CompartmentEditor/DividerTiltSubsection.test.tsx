import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DividerTiltSubsection } from './DividerTiltSubsection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

const enableAngledDividers = (): void => {
  useSettingsStore.getState().updateSetting('angledDividersEnabled', true);
};

describe('DividerTiltSubsection', () => {
  beforeEach(() => {
    resetAllStores();
    useDesignerStore.setState((s) => ({
      params: DEFAULT_BIN_PARAMS,
      ui: { ...s.ui, selectedDividerKey: null, hoveredDividerKey: null, dividerTiltPreview: null },
    }));
    // Angled-divider editing is an advanced opt-in (off by default); enable it
    // so the existing behavioural specs exercise the list/inspector content.
    enableAngledDividers();
  });

  const setGrid = (cols: number, rows: number): void => {
    const cells = Array.from({ length: cols * rows }, (_, i) => i);
    useDesignerStore.setState((s) => ({
      params: { ...s.params, compartments: { ...s.params.compartments, cols, rows, cells } },
    }));
  };

  const openInspector = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /Edit divider between Comp/i }));
  };

  it('renders nothing when no interior dividers exist', () => {
    const { container } = render(<DividerTiltSubsection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every eligible divider, not just the modified ones', () => {
    setGrid(2, 2); // 4 cells → 4 eligible dividers
    render(<DividerTiltSubsection />);
    const rows = screen.getAllByRole('button', { name: /Edit divider between Comp/i });
    expect(rows).toHaveLength(4);
  });

  it('shows the info popover when the help button is clicked', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    fireEvent.click(screen.getByLabelText(/about diagonal dividers/i));
    expect(
      screen.getByText(/Tilt interior walls to create wedge-shaped compartments/i)
    ).toBeInTheDocument();
  });

  it('opens the inspector with an angle slider and stepper (no endpoint offsets)', () => {
    setGrid(2, 1); // side-by-side → vertical divider
    render(<DividerTiltSubsection />);
    openInspector();
    expect(screen.getByText('Vertical divider')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /angle/i })).toBeInTheDocument();
    // Angle is the only visible numeric field (Shift lives in the collapsed Fine-tune).
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    expect(screen.queryByRole('spinbutton', { name: /Top|Bottom|Left|Right/i })).toBeNull();
  });

  it('clicking a preset commits a tilt for the selected divider', () => {
    setGrid(2, 1);
    render(<DividerTiltSubsection />);
    openInspector();
    fireEvent.click(screen.getByRole('button', { name: '45°' }));
    const overrides = useDesignerStore.getState().params.compartments.dividerOverrides;
    expect(overrides).toHaveLength(1);
    // A positive angle pivots about centre → end > start.
    expect(overrides?.[0].offsetEnd).toBeGreaterThan(overrides?.[0].offsetStart ?? 0);
  });

  it('tilted rows show an angle badge in the list', () => {
    // depth 1u → vertical segment ≈ 39.1mm, so ±19.55mm offsets read as ~45°.
    useDesignerStore.setState((s) => ({ params: { ...s.params, depth: 1 } }));
    setGrid(2, 1);
    useDesignerStore.getState().setDividerOverride(0, 1, -19.55, 19.55);
    render(<DividerTiltSubsection />);
    expect(screen.getByText('45°')).toBeInTheDocument();
  });

  it('Back returns from inspector to the list', () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    openInspector();
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('button', { name: /Edit divider between Comp/i })).toBeInTheDocument();
  });

  it('Reset to straight removes the override and stays in the inspector', () => {
    setGrid(1, 2);
    useDesignerStore.getState().setDividerOverride(0, 1, 7, -7);
    render(<DividerTiltSubsection />);
    openInspector();
    fireEvent.click(screen.getByRole('button', { name: /Reset to straight/i }));
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
    expect(screen.getByText('Horizontal divider')).toBeInTheDocument();
  });

  it('Reset all clears every override and only renders when any exist', async () => {
    setGrid(1, 2);
    render(<DividerTiltSubsection />);
    expect(screen.queryByRole('button', { name: /^reset all$/i })).not.toBeInTheDocument();
    useDesignerStore.getState().setDividerOverride(0, 1, 8, -8);
    const resetBtn = await screen.findByRole('button', { name: /^reset all$/i });
    fireEvent.click(resetBtn);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  it('shows the conflict notice when a tilted divider strips an enabled feature', () => {
    setGrid(2, 1);
    useDesignerStore.setState((s) => ({
      params: { ...s.params, scoop: { ...s.params.scoop, enabled: true } },
    }));
    useDesignerStore.getState().setDividerOverride(0, 1, -10, 10);
    render(<DividerTiltSubsection />);
    openInspector();
    expect(screen.getByText(/removed along tilted dividers/i)).toBeInTheDocument();
  });

  it('hides the conflict notice for a straight divider', () => {
    setGrid(2, 1);
    useDesignerStore.setState((s) => ({
      params: { ...s.params, scoop: { ...s.params.scoop, enabled: true } },
    }));
    render(<DividerTiltSubsection />);
    openInspector();
    expect(screen.queryByText(/removed along tilted dividers/i)).toBeNull();
  });

  describe('advanced opt-in toggle', () => {
    const disableAngledDividers = (): void => {
      useSettingsStore.getState().updateSetting('angledDividersEnabled', false);
    };

    it('shows the opt-in toggle but hides the editing list when disabled', () => {
      disableAngledDividers();
      setGrid(2, 2); // 4 eligible dividers
      render(<DividerTiltSubsection />);
      expect(
        screen.getByRole('switch', { name: /enable diagonal divider editing/i })
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Edit divider between Comp/i })).toBeNull();
    });

    it('enabling the toggle reveals the divider list and persists the preference', () => {
      disableAngledDividers();
      setGrid(2, 2);
      render(<DividerTiltSubsection />);
      fireEvent.click(screen.getByRole('switch', { name: /enable diagonal divider editing/i }));
      expect(useSettingsStore.getState().settings.angledDividersEnabled).toBe(true);
      expect(screen.getAllByRole('button', { name: /Edit divider between Comp/i })).toHaveLength(4);
    });

    it('preserves existing tilts when the feature is disabled (render-only, not editable)', () => {
      setGrid(2, 1);
      useDesignerStore.getState().setDividerOverride(0, 1, -8, 8);
      disableAngledDividers();
      render(<DividerTiltSubsection />);
      // Editing UI is gone…
      expect(screen.queryByRole('button', { name: /Edit divider between Comp/i })).toBeNull();
      // …but the override data survives so the 3D model still generates the tilt.
      expect(useDesignerStore.getState().params.compartments.dividerOverrides).toHaveLength(1);
    });

    it('clears active selection, hover, and in-flight preview when toggled off', () => {
      setGrid(2, 1);
      render(<DividerTiltSubsection />);
      openInspector();
      // Seed every transient divider-UI key so toggling off must clear them all.
      useDesignerStore.setState((s) => ({
        ui: {
          ...s.ui,
          hoveredDividerKey: '0-1',
          dividerTiltPreview: { key: '0-1', offsetStart: -5, offsetEnd: 5 },
        },
      }));
      expect(useDesignerStore.getState().ui.selectedDividerKey).not.toBeNull();
      fireEvent.click(screen.getByRole('switch', { name: /enable diagonal divider editing/i }));
      const ui = useDesignerStore.getState().ui;
      expect(ui.selectedDividerKey).toBeNull();
      expect(ui.hoveredDividerKey).toBeNull();
      expect(ui.dividerTiltPreview).toBeNull();
    });
  });
});
