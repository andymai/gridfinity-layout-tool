// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppWindowEvents } from './useAppWindowEvents';

function deps() {
  return {
    setIsHelpOpen: vi.fn(),
    setCommandPaletteOpen: vi.fn(),
    setCommandPaletteInitialQuery: vi.fn(),
    navigateToSupporters: vi.fn(),
    navigateToDesigner: vi.fn(),
  };
}

describe('useAppWindowEvents', () => {
  it('opens help on the open-help-modal event', () => {
    const d = deps();
    renderHook(() => useAppWindowEvents(d));
    window.dispatchEvent(new Event('open-help-modal'));
    expect(d.setIsHelpOpen).toHaveBeenCalledWith(true);
  });

  it('opens the command palette pre-filled from open-command-palette', () => {
    const d = deps();
    renderHook(() => useAppWindowEvents(d));
    window.dispatchEvent(new CustomEvent('open-command-palette', { detail: { query: 'foo' } }));
    expect(d.setCommandPaletteInitialQuery).toHaveBeenCalledWith('foo');
    expect(d.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  it('routes on view-supporters and switch-to-designer', () => {
    const d = deps();
    renderHook(() => useAppWindowEvents(d));
    window.dispatchEvent(new Event('view-supporters'));
    expect(d.navigateToSupporters).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('switch-to-designer'));
    expect(d.navigateToDesigner).toHaveBeenCalledTimes(1);
  });

  it('removes its listeners on unmount', () => {
    const d = deps();
    const { unmount } = renderHook(() => useAppWindowEvents(d));
    unmount();
    window.dispatchEvent(new Event('open-help-modal'));
    expect(d.setIsHelpOpen).not.toHaveBeenCalled();
  });
});
