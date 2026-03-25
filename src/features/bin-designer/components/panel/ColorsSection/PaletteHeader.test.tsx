import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaletteHeader } from './PaletteHeader';
import { useSettingsStore } from '@/core/store';

describe('PaletteHeader', () => {
  beforeEach(() => {
    useSettingsStore.getState().updateSetting('filamentPalette', [
      { id: 'slot1', name: 'Primary', color: '#d4d8dc' },
      { id: 'slot2', name: 'Accent', color: '#3b82f6' },
      { id: 'slot3', name: 'Slot 3', color: '#22c55e' },
      { id: 'slot4', name: 'Slot 4', color: '#ef4444' },
    ]);
  });

  it('renders all 4 palette swatch buttons', () => {
    render(<PaletteHeader />);
    expect(screen.getByText('Primary')).toBeDefined();
    expect(screen.getByText('Accent')).toBeDefined();
    expect(screen.getByText('Slot 3')).toBeDefined();
    expect(screen.getByText('Slot 4')).toBeDefined();
  });

  it('renders palette label', () => {
    render(<PaletteHeader />);
    expect(screen.getByText('Filament Palette')).toBeDefined();
  });

  it('opens editor popover on swatch click', () => {
    render(<PaletteHeader />);
    fireEvent.click(screen.getByLabelText('Edit Primary'));
    // Popover renders the slot name input
    expect(screen.getByLabelText('Slot name')).toBeDefined();
  });

  it('closes editor popover on second click', () => {
    render(<PaletteHeader />);
    const btn = screen.getByLabelText('Edit Primary');
    fireEvent.click(btn);
    expect(screen.getByLabelText('Slot name')).toBeDefined();
    fireEvent.click(btn);
    expect(screen.queryByLabelText('Slot name')).toBeNull();
  });
});
