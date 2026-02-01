import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EcoSection } from './EcoSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('EcoSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders eco feature toggles', () => {
    render(<EcoSection />);
    expect(screen.getByText('Honeycomb floor')).toBeInTheDocument();
    expect(screen.getByText('Honeycomb walls')).toBeInTheDocument();
    expect(screen.getByText('Wave walls')).toBeInTheDocument();
  });

  it('renders eco preset button', () => {
    render(<EcoSection />);
    expect(screen.getByText('⚡ Apply Eco Preset')).toBeInTheDocument();
  });

  it('applies eco preset on button click', () => {
    render(<EcoSection />);
    fireEvent.click(screen.getByText('⚡ Apply Eco Preset'));

    const state = useDesignerStore.getState();
    expect(state.params.wallThickness).toBe(0.8);
    expect(state.params.eco.honeycombFloor.enabled).toBe(true);
    expect(state.params.eco.honeycombWall.mode).toBe('pocketed');
  });

  it('shows savings display when eco features are active', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        eco: {
          ...DEFAULT_BIN_PARAMS.eco,
          honeycombFloor: { ...DEFAULT_BIN_PARAMS.eco.honeycombFloor, enabled: true },
        },
      },
    });
    render(<EcoSection />);
    // Should show some savings percentage
    expect(screen.getByText(/Saves ~\d+% filament/)).toBeInTheDocument();
  });

  it('toggles honeycomb floor on click', () => {
    render(<EcoSection />);
    // Find the toggle for honeycomb floor
    const toggle = screen.getByRole('switch', { name: 'Honeycomb floor' });
    fireEvent.click(toggle);

    const state = useDesignerStore.getState();
    expect(state.params.eco.honeycombFloor.enabled).toBe(true);
  });

  it('shows disabled reason for honeycomb walls when wave walls active', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        eco: {
          ...DEFAULT_BIN_PARAMS.eco,
          sinusoidalWall: { ...DEFAULT_BIN_PARAMS.eco.sinusoidalWall, enabled: true },
        },
      },
    });
    render(<EcoSection />);
    expect(screen.getByText('Disabled when wave walls are active')).toBeInTheDocument();
  });
});
