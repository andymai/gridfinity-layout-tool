import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilamentSwatchRow } from './FilamentSwatchRow';
import { useSettingsStore } from '@/core/store';

describe('FilamentSwatchRow', () => {
  const onChangeMock = vi.fn();
  const onHoverMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.getState().updateSetting('filamentPalette', [
      { id: 'slot1', name: 'Primary', color: '#d4d8dc' },
      { id: 'slot2', name: 'Accent', color: '#3b82f6' },
      { id: 'slot3', name: 'Slot 3', color: '#22c55e' },
      { id: 'slot4', name: 'Slot 4', color: '#ef4444' },
    ]);
  });

  it('renders zone label and 4 swatch buttons', () => {
    render(
      <FilamentSwatchRow
        zone="body"
        label="Body"
        value="slot1"
        onChange={onChangeMock}
        onHover={onHoverMock}
      />
    );
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('marks selected swatch with aria-pressed', () => {
    render(
      <FilamentSwatchRow
        zone="body"
        label="Body"
        value="slot2"
        onChange={onChangeMock}
        onHover={onHoverMock}
      />
    );
    const accentBtn = screen.getByLabelText('Body: Accent');
    expect(accentBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onChange when swatch clicked', () => {
    render(
      <FilamentSwatchRow
        zone="body"
        label="Body"
        value="slot1"
        onChange={onChangeMock}
        onHover={onHoverMock}
      />
    );
    fireEvent.click(screen.getByLabelText('Body: Accent'));
    expect(onChangeMock).toHaveBeenCalledWith('slot2');
  });

  it('calls onHover on pointer enter/leave', () => {
    const { container } = render(
      <FilamentSwatchRow
        zone="lip"
        label="Lip"
        value="slot1"
        onChange={onChangeMock}
        onHover={onHoverMock}
      />
    );
    const row = container.firstChild as HTMLElement;
    fireEvent.pointerEnter(row);
    expect(onHoverMock).toHaveBeenCalledWith('lip');
    fireEvent.pointerLeave(row);
    expect(onHoverMock).toHaveBeenCalledWith(null);
  });

  it('applies disabled styling when disabled', () => {
    const { container } = render(
      <FilamentSwatchRow
        zone="lip"
        label="Lip"
        value="slot1"
        onChange={onChangeMock}
        onHover={onHoverMock}
        disabled
      />
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('opacity-40');
    expect(row.className).toContain('pointer-events-none');
  });
});
