// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SPACEMOUSE_SETTINGS_STORAGE_KEY } from './constants';
import { useSpaceMouseStore } from './settingsStore';
import { useSpaceMouseDevice } from './useSpaceMouseDevice';

const device = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('./deviceManager', () => ({
  startSpaceMouse: device.start,
  stopSpaceMouse: device.stop,
}));

function otherTabStores(enabled: boolean): Promise<void> {
  localStorage.setItem(
    SPACEMOUSE_SETTINGS_STORAGE_KEY,
    JSON.stringify({ state: { enabled }, version: 0 })
  );
  window.dispatchEvent(new StorageEvent('storage', { key: SPACEMOUSE_SETTINGS_STORAGE_KEY }));
  return Promise.resolve();
}

describe('useSpaceMouseDevice', () => {
  beforeEach(() => {
    localStorage.clear();
    useSpaceMouseStore.setState({ enabled: false });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not touch the device while the option is off', () => {
    renderHook(() => useSpaceMouseDevice());
    expect(device.start).not.toHaveBeenCalled();
  });

  it('starts when the option turns on and stops when it turns off', () => {
    renderHook(() => useSpaceMouseDevice());

    act(() => useSpaceMouseStore.getState().setEnabled(true));
    expect(device.start).toHaveBeenCalledTimes(1);

    act(() => useSpaceMouseStore.getState().setEnabled(false));
    expect(device.stop).toHaveBeenCalledTimes(1);
  });

  it('follows another tab turning the option off', async () => {
    act(() => useSpaceMouseStore.getState().setEnabled(true));
    renderHook(() => useSpaceMouseDevice());
    expect(device.start).toHaveBeenCalledTimes(1);

    await act(() => otherTabStores(false));

    expect(useSpaceMouseStore.getState().enabled).toBe(false);
    expect(device.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores storage changes to other keys', async () => {
    act(() => useSpaceMouseStore.getState().setEnabled(true));
    renderHook(() => useSpaceMouseDevice());
    const rehydrate = vi.spyOn(useSpaceMouseStore.persist, 'rehydrate');

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
      await Promise.resolve();
    });

    expect(rehydrate).not.toHaveBeenCalled();
    rehydrate.mockRestore();
  });
});
