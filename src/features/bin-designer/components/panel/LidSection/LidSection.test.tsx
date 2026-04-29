import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LidSection } from './LidSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

function resetStore(overrides: Partial<typeof DEFAULT_BIN_PARAMS> = {}) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, ...overrides },
    ui: { ...DEFAULT_UI_STATE },
  });
}

describe('LidSection', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders the master Lid toggle', () => {
    render(<LidSection />);
    expect(screen.getByRole('switch', { name: 'Lid' })).toBeInTheDocument();
  });

  it('disables the Lid toggle when stacking lip is off', () => {
    resetStore({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
    render(<LidSection />);
    expect(screen.getByText('Requires stacking lip')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Lid' })).toBeDisabled();
  });

  it('toggles lid enabled', () => {
    render(<LidSection />);
    const toggle = screen.getByRole('switch', { name: 'Lid' });
    fireEvent.click(toggle);
    expect(useDesignerStore.getState().params.lid.enabled).toBe(true);
  });

  it('auto-syncs magnetHoles + stackableTop on enable when bin has magnets', () => {
    // Magnets only do anything with a stack grid above — the auto-sync
    // turns ON both at once so the assembly's natural use case lights up.
    resetStore({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('switch', { name: 'Lid' }));
    const lid = useDesignerStore.getState().params.lid;
    expect(lid.magnetHoles).toBe(true);
    expect(lid.stackableTop).toBe(true);
  });

  it('leaves magnetHoles off on enable when bin has no magnets', () => {
    // Default base.style is 'standard' (no magnets)
    render(<LidSection />);
    fireEvent.click(screen.getByRole('switch', { name: 'Lid' }));
    expect(useDesignerStore.getState().params.lid.magnetHoles).toBe(false);
  });

  it('toggles stackable top via Switch', () => {
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true } });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Stackable top grid' }));
    expect(useDesignerStore.getState().params.lid.stackableTop).toBe(false);
  });

  it('disables the magnet switch when stackable top is off', () => {
    // Magnet pockets need a stack grid above to mate with — gated.
    resetStore({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: false, magnetHoles: false },
    });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    expect(screen.getByRole('switch', { name: 'Magnet pockets' })).toBeDisabled();
  });

  it('clears magnetHoles when stackableTop is turned off', () => {
    resetStore({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, magnetHoles: true },
    });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Stackable top grid' }));
    const lid = useDesignerStore.getState().params.lid;
    expect(lid.stackableTop).toBe(false);
    expect(lid.magnetHoles).toBe(false);
  });
});
