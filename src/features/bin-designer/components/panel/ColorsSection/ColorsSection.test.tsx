import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsSection } from './ColorsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

const SINGLE = '#d4d8dc';

function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: true,
    body: SINGLE,
    lip: { frontLeft: SINGLE, frontRight: SINGLE, backRight: SINGLE, backLeft: SINGLE },
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
    text: SINGLE,
    ...overrides,
  };
}

describe('ColorsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: false },
        featureColors: colors({
          body: '#3b82f6',
          lip: {
            frontLeft: '#ef4444',
            frontRight: '#ef4444',
            backRight: '#ef4444',
            backLeft: '#ef4444',
          },
          labelTab: '#22c55e',
        }),
      },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders Body, Lip, Base, and Label Tab rows when active', () => {
    render(<ColorsSection />);
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getByText('Stacking Lip')).toBeDefined();
    expect(screen.getByText('Base')).toBeDefined();
    expect(screen.getByText('Label Tab')).toBeDefined();
  });

  it('hides Lip row when stacking lip is off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        featureColors: colors(),
      },
    });
    render(<ColorsSection />);
    expect(screen.queryByText('Stacking Lip')).toBeNull();
  });

  it('hides Label Tab row when labels are off', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
        featureColors: colors(),
      },
    });
    render(<ColorsSection />);
    expect(screen.queryByText('Label Tab')).toBeNull();
  });

  it('hides the Interior group entirely when neither scoop nor dividers are active', () => {
    render(<ColorsSection />);
    // No scoop, no multi-cell compartments → no Interior section
    expect(screen.queryByText('Interior')).toBeNull();
  });

  it('shows the Interior group with Scoop row when scoop is enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
        featureColors: colors(),
      },
    });
    render(<ColorsSection />);
    expect(screen.getByText('Interior')).toBeDefined();
    expect(screen.getByText('Scoop')).toBeDefined();
  });

  it('shows the Dividers row when compartments contain multiple groups', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
        featureColors: colors(),
      },
    });
    render(<ColorsSection />);
    expect(screen.getByText('Dividers')).toBeDefined();
  });

  describe('single lip color', () => {
    it('does not expose per-corner sub-rows (per-corner UI is rolled back)', () => {
      render(<ColorsSection />);
      // Whichever way the user interacts with the lip row, none of the
      // four corner labels should ever appear in the panel.
      fireEvent.click(screen.getByRole('button', { name: /Stacking Lip/ }));
      expect(screen.queryByText('Front-left')).toBeNull();
      expect(screen.queryByText('Front-right')).toBeNull();
      expect(screen.queryByText('Back-right')).toBeNull();
      expect(screen.queryByText('Back-left')).toBeNull();
    });

    it("mirrors the picker's hex into all four lip corners on change", () => {
      // Seed with mismatched corners so we can prove the writer overwrites
      // every corner — not just the canonical one the picker reads from.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          featureColors: colors({
            lip: {
              frontLeft: '#aaaaaa',
              frontRight: '#bbbbbb',
              backRight: '#cccccc',
              backLeft: '#dddddd',
            },
          }),
        },
      });
      render(<ColorsSection />);

      // Drive a real color commit through the rendered ColorZoneRow →
      // ColorPicker pipeline so the section's inline onChange handler is
      // actually exercised. A direct store call would still pass even if
      // the handler regressed to writing a single corner — the whole
      // point of the mirror is the section, not the store action.
      fireEvent.click(screen.getByRole('button', { name: /Stacking Lip/ }));
      // The picker renders 'Red' (#ef4444) as a preset filament swatch;
      // clicking it routes through ColorsSection's onChange.
      fireEvent.click(screen.getByTitle('Red'));

      const after = useDesignerStore.getState().params.featureColors;
      expect(after.lip.frontLeft).toBe('#ef4444');
      expect(after.lip.frontRight).toBe('#ef4444');
      expect(after.lip.backRight).toBe('#ef4444');
      expect(after.lip.backLeft).toBe('#ef4444');
    });
  });

  describe('enable toggle', () => {
    it('hides zone editors and shows the hint when featureColors.enabled is false', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
          featureColors: colors({ enabled: false }),
        },
      });
      render(<ColorsSection />);
      // Toggle is off → zone rows and the actions menu must not appear.
      expect(screen.queryByText('Body')).toBeNull();
      expect(screen.queryByText('Stacking Lip')).toBeNull();
      expect(screen.queryByText('Label Tab')).toBeNull();
      // The hint copy should be visible to explain the off state.
      expect(screen.getByText(/multi-color 3MF/)).toBeDefined();
    });

    it('exposes the toggle with aria-checked reflecting enabled state', () => {
      useDesignerStore.setState({
        params: { ...DEFAULT_BIN_PARAMS, featureColors: colors({ enabled: false }) },
      });
      render(<ColorsSection />);
      const sw = screen.getByRole('switch');
      expect(sw.getAttribute('aria-checked')).toBe('false');
    });

    it('flips featureColors.enabled and preserves zone colors when toggled', () => {
      // Seed with diverged colors + enabled:true so we can verify that toggling
      // off doesn't reset them — the toggle is a gate, not a reset button.
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          featureColors: colors({
            body: '#3b82f6',
            labelTab: '#22c55e',
            enabled: true,
          }),
        },
      });
      render(<ColorsSection />);
      fireEvent.click(screen.getByRole('switch'));
      const after = useDesignerStore.getState().params.featureColors;
      expect(after.enabled).toBe(false);
      expect(after.body).toBe('#3b82f6');
      expect(after.labelTab).toBe('#22c55e');
    });
  });
});
