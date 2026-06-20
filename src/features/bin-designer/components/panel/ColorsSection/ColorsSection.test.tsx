import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsSection } from './ColorsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import type {
  FeatureColorConfig,
  LipColorConfig,
} from '@/features/bin-designer/types/featureColors';

const SINGLE = '#d4d8dc';

function lip(
  cells: Record<string, string> = {},
  corners: 1 | 2 | 4 = 1,
  bands: 1 | 2 | 4 = 1
): LipColorConfig {
  return { corners, bands, cells: { ...makeUniformLipCells(SINGLE), ...cells } };
}

function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    enabled: true,
    body: SINGLE,
    lip: lip(),
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
    text: SINGLE,
    lid: SINGLE,
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
          lip: lip(makeUniformLipCells('#ef4444')),
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

  describe('lip color grid', () => {
    it('shows a single "Stacking Lip" cell at 1×1 (no corner labels)', () => {
      render(<ColorsSection />);
      expect(screen.queryByText('Front-left')).toBeNull();
      expect(screen.queryByText('Front-right')).toBeNull();
      expect(screen.queryByText('Back-right')).toBeNull();
      expect(screen.queryByText('Back-left')).toBeNull();
    });

    it('exposes the four corner cells at 4 corners', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          featureColors: colors({ lip: lip({}, 4, 1) }),
        },
      });
      render(<ColorsSection />);
      expect(screen.getByText('Front-left')).toBeDefined();
      expect(screen.getByText('Front-right')).toBeDefined();
      expect(screen.getByText('Back-right')).toBeDefined();
      expect(screen.getByText('Back-left')).toBeDefined();
    });

    it('writes the canonical lip cell on change (no mirroring)', () => {
      useDesignerStore.setState({
        params: {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
          featureColors: colors({ lip: lip(makeUniformLipCells('#aaaaaa')) }),
        },
      });
      render(<ColorsSection />);

      // Drive a real commit through the rendered cell → ColorPicker pipeline.
      fireEvent.click(screen.getByRole('button', { name: /Stacking Lip/ }));
      fireEvent.click(screen.getByTitle('Red')); // #ef4444 preset

      const after = useDesignerStore.getState().params.featureColors;
      expect(after.lip.cells['lip:frontLeft:0']).toBe('#ef4444');
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
