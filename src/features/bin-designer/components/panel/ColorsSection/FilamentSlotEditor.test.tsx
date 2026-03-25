import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilamentSlotEditor } from './FilamentSlotEditor';
import { useSettingsStore } from '@/core/store';

describe('FilamentSlotEditor', () => {
  const testSlot = { id: 'slot1' as const, name: 'Primary', color: '#d4d8dc' };

  beforeEach(() => {
    useSettingsStore.getState().updateSetting('filamentPalette', [
      { id: 'slot1', name: 'Primary', color: '#d4d8dc' },
      { id: 'slot2', name: 'Accent', color: '#3b82f6' },
      { id: 'slot3', name: 'Slot 3', color: '#22c55e' },
      { id: 'slot4', name: 'Slot 4', color: '#ef4444' },
    ]);
  });

  it('renders name input with slot name', () => {
    render(<FilamentSlotEditor slot={testSlot} />);
    const nameInput = screen.getByLabelText('Slot name');
    expect(nameInput).toBeDefined();
    expect((nameInput as HTMLInputElement).value).toBe('Primary');
  });

  it('renders preset color buttons', () => {
    render(<FilamentSlotEditor slot={testSlot} />);
    expect(screen.getByLabelText('White')).toBeDefined();
    expect(screen.getByLabelText('Red')).toBeDefined();
    expect(screen.getByLabelText('Blue')).toBeDefined();
  });

  it('renders hex input with current color', () => {
    render(<FilamentSlotEditor slot={testSlot} />);
    const hexInput = screen.getByLabelText('Hex color');
    expect((hexInput as HTMLInputElement).value).toBe('#d4d8dc');
  });

  it('updates slot name on input change', () => {
    render(<FilamentSlotEditor slot={testSlot} />);
    const nameInput = screen.getByLabelText('Slot name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    const palette = useSettingsStore.getState().settings.filamentPalette;
    expect(palette.find((s) => s.id === 'slot1')?.name).toBe('New Name');
  });

  it('updates slot color on preset click', () => {
    render(<FilamentSlotEditor slot={testSlot} />);
    fireEvent.click(screen.getByLabelText('Red'));
    const palette = useSettingsStore.getState().settings.filamentPalette;
    expect(palette.find((s) => s.id === 'slot1')?.color).toBe('#ef4444');
  });

  it('applies valid hex on blur', () => {
    render(<FilamentSlotEditor slot={testSlot} />);
    const hexInput = screen.getByLabelText('Hex color');
    fireEvent.change(hexInput, { target: { value: '#ff0000' } });
    fireEvent.blur(hexInput);
    const palette = useSettingsStore.getState().settings.filamentPalette;
    expect(palette.find((s) => s.id === 'slot1')?.color).toBe('#ff0000');
  });

  it('shows error for invalid hex on blur', () => {
    render(<FilamentSlotEditor slot={testSlot} />);
    const hexInput = screen.getByLabelText('Hex color');
    fireEvent.change(hexInput, { target: { value: 'notahex' } });
    fireEvent.blur(hexInput);
    expect(screen.getByText('Invalid hex color')).toBeDefined();
  });
});
