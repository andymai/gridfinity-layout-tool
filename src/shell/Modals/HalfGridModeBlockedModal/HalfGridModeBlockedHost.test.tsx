import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HalfGridModeBlockedHost } from './HalfGridModeBlockedHost';
import { useKeyboard } from '@/shell/keyboard';
import { useHalfGridModeStore, useLayoutStore, useToastStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { STAGING_ID } from '@/core/constants';
import { gridUnits, heightUnits } from '@/core/types';
import type { BinId } from '@/core/types';
import { resetAllStores, getBinId } from '@/test/testUtils';

function addBin(x: number, width: number): BinId {
  const { layout, addBin: add } = useLayoutStore.getState();
  return getBinId(
    add({
      layerId: layout.layers[0].id,
      x: gridUnits(x),
      y: gridUnits(0),
      width: gridUnits(width),
      depth: gridUnits(1),
      height: heightUnits(3),
      category: layout.categories[0].id,
      label: '',
      notes: '',
    })
  );
}

function layerOf(id: BinId): string | undefined {
  return useLayoutStore.getState().layout.bins.find((b) => b.id === id)?.layerId;
}

function KeyboardHarness() {
  useKeyboard();
  return null;
}

function toastMessages(): string[] {
  return useToastStore.getState().toasts.map((toast) => toast.message);
}

describe('HalfGridModeBlockedHost', () => {
  let layerId: string;

  beforeEach(() => {
    resetAllStores();
    useHalfGridModeStore.getState().setHalfGridMode(true);
    layerId = useLayoutStore.getState().layout.layers[0].id;
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders nothing while no turn-off is blocked', () => {
    render(<HalfGridModeBlockedHost />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from the H key with the same dialog the switch opens', () => {
    addBin(0, 1.5);
    addBin(3, 2.5);
    render(
      <>
        <KeyboardHarness />
        <HalfGridModeBlockedHost />
      </>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }));
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Turn off half-grid mode?');
    expect(dialog).toHaveTextContent(
      '2 bins have a half-unit size or position. To turn off half-grid mode, move them to the stash.'
    );
    expect(screen.getByRole('button', { name: 'Move to stash and turn off' })).toBeInTheDocument();
    expect(toastMessages()).toEqual([]);
  });

  it('moves the half-unit bins to the stash and turns the mode off', () => {
    const half = addBin(0, 1.5);
    const halfAgain = addBin(3, 2.5);
    const whole = addBin(6, 2);
    useHalfGridModeStore.getState().requestHalfGridToggle();
    render(<HalfGridModeBlockedHost />);

    fireEvent.click(screen.getByRole('button', { name: 'Move to stash and turn off' }));

    expect(layerOf(half)).toBe(STAGING_ID);
    expect(layerOf(halfAgain)).toBe(STAGING_ID);
    expect(layerOf(whole)).toBe(layerId);
    expect(useHalfGridModeStore.getState().halfGridMode).toBe(false);
    expect(useHalfGridModeStore.getState().blockedViolation).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toastMessages()).toEqual(['Moved 2 bins to stash']);
  });

  it('brings both bins back with one undo', () => {
    const half = addBin(0, 1.5);
    const halfAgain = addBin(3, 2.5);
    useHalfGridModeStore.getState().requestHalfGridToggle();
    render(<HalfGridModeBlockedHost />);

    fireEvent.click(screen.getByRole('button', { name: 'Move to stash and turn off' }));
    act(() => {
      useHistoryStore.getState().undo();
    });

    expect(layerOf(half)).toBe(layerId);
    expect(layerOf(halfAgain)).toBe(layerId);
  });

  it('keeps the mode on and the bins in place on Cancel', () => {
    const half = addBin(0, 1.5);
    useHalfGridModeStore.getState().requestHalfGridToggle();
    render(<HalfGridModeBlockedHost />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel and keep half-grid mode enabled' }));

    expect(layerOf(half)).toBe(layerId);
    expect(useHalfGridModeStore.getState().halfGridMode).toBe(true);
    expect(useHalfGridModeStore.getState().blockedViolation).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toastMessages()).toEqual([]);
  });

  it('moves only the bins still on half units when the dialog confirms', () => {
    const deleted = addBin(0, 1.5);
    const resized = addBin(3, 2.5);
    const kept = addBin(6, 1.5);
    useHalfGridModeStore.getState().requestHalfGridToggle();
    render(<HalfGridModeBlockedHost />);

    act(() => {
      useLayoutStore.getState().deleteBin(deleted);
      useLayoutStore.getState().updateBin(resized, { width: gridUnits(2) });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move to stash and turn off' }));

    expect(layerOf(resized)).toBe(layerId);
    expect(layerOf(kept)).toBe(STAGING_ID);
    expect(toastMessages()).toEqual(['Moved 1 bin to stash']);
  });

  it('turns the mode off without a toast when no bin is left on a half unit', () => {
    const half = addBin(0, 1.5);
    useHalfGridModeStore.getState().requestHalfGridToggle();
    render(<HalfGridModeBlockedHost />);

    act(() => {
      useLayoutStore.getState().deleteBin(half);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move to stash and turn off' }));

    expect(useHalfGridModeStore.getState().halfGridMode).toBe(false);
    expect(toastMessages()).toEqual([]);
  });
});
