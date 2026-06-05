import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SideSelector, type SideState } from './SideSelector';

const SIDES: SideState[] = [
  { side: 'left', label: 'Left', active: true },
  { side: 'right', label: 'Right', active: false },
  { side: 'front', label: 'Front', active: false },
  { side: 'back', label: 'Back', active: false, disabled: true, title: 'Blocked' },
];

describe('SideSelector', () => {
  it('renders each side as a switch reflecting its active state', () => {
    render(<SideSelector sides={SIDES} onToggle={() => {}} ariaLabel="Sides" />);
    expect(screen.getByRole('switch', { name: 'Left' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Right' }).getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('disables a side and exposes its tooltip', () => {
    render(<SideSelector sides={SIDES} onToggle={() => {}} ariaLabel="Sides" />);
    const back = screen.getByRole('switch', { name: 'Back' });
    expect((back as HTMLButtonElement).disabled).toBe(true);
    expect(back.getAttribute('title')).toBe('Blocked');
  });

  it('forces a disabled side to read as off even when active is passed true', () => {
    const sides: SideState[] = [
      { side: 'left', label: 'Left', active: false },
      { side: 'right', label: 'Right', active: false },
      { side: 'front', label: 'Front', active: false },
      // Stored as active, but blocked — must announce as off.
      { side: 'back', label: 'Back', active: true, disabled: true },
    ];
    render(<SideSelector sides={sides} onToggle={() => {}} ariaLabel="Sides" />);
    expect(screen.getByRole('switch', { name: 'Back' }).getAttribute('aria-checked')).toBe('false');
  });

  it('toggles a side on click', () => {
    const onToggle = vi.fn();
    render(<SideSelector sides={SIDES} onToggle={onToggle} ariaLabel="Sides" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Right' }));
    expect(onToggle).toHaveBeenCalledWith('right');
  });
});
