import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorsSection } from './ColorsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

const SINGLE = '#d4d8dc';

function colors(overrides: Partial<FeatureColorConfig> = {}): FeatureColorConfig {
  return {
    body: SINGLE,
    lip: { frontLeft: SINGLE, frontRight: SINGLE, backRight: SINGLE, backLeft: SINGLE },
    labelTab: SINGLE,
    base: SINGLE,
    scoop: SINGLE,
    dividers: SINGLE,
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

  describe('Lip per-corner expansion', () => {
    it('does not show corner sub-rows by default', () => {
      render(<ColorsSection />);
      expect(screen.queryByText('Front-left')).toBeNull();
    });

    it('reveals four corner sub-rows after the lip row is clicked', () => {
      render(<ColorsSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Stacking Lip' }));
      expect(screen.getByText('Front-left')).toBeDefined();
      expect(screen.getByText('Front-right')).toBeDefined();
      expect(screen.getByText('Back-right')).toBeDefined();
      expect(screen.getByText('Back-left')).toBeDefined();
    });
  });
});
