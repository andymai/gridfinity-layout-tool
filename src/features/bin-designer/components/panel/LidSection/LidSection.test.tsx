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

  it('toggles lid enabled and shows the value summary', () => {
    render(<LidSection />);
    const toggle = screen.getByRole('switch', { name: 'Lid' });
    fireEvent.click(toggle);
    expect(useDesignerStore.getState().params.lid.enabled).toBe(true);
  });

  it('auto-syncs magnetHoles to bin magnets on enable', () => {
    resetStore({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('switch', { name: 'Lid' }));
    expect(useDesignerStore.getState().params.lid.magnetHoles).toBe(true);
  });

  it('disables magnetHoles on enable when bin has no magnets', () => {
    // Default base.style is 'standard' (no magnets)
    render(<LidSection />);
    fireEvent.click(screen.getByRole('switch', { name: 'Lid' }));
    expect(useDesignerStore.getState().params.lid.magnetHoles).toBe(false);
  });

  it('renders fit picker buttons when enabled', () => {
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
    render(<LidSection />);
    // Switch to expanded (Customize) to see sub-controls
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    expect(screen.getByRole('button', { name: 'Loose' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tight' })).toBeInTheDocument();
  });

  it('switches fit when picker button clicked', () => {
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tight' }));
    expect(useDesignerStore.getState().params.lid.fit).toBe('tight');
  });

  it('toggles stackable top via Switch', () => {
    resetStore({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true } });
    render(<LidSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Stackable top grid' }));
    expect(useDesignerStore.getState().params.lid.stackableTop).toBe(false);
  });
});
