import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SETTINGS, SPACEMOUSE_SETTINGS_STORAGE_KEY } from './constants';
import type { SpaceMouseConnectionStatus, SpaceMouseInvert, SpaceMouseSettings } from './types';

interface SpaceMouseState {
  /** Persisted tuning. */
  settings: SpaceMouseSettings;
  /** Transient connection state (never persisted). */
  status: SpaceMouseConnectionStatus;
  deviceName: string | null;

  setSensitivity: (value: number) => void;
  setTranslateSpeed: (value: number) => void;
  setRotateSpeed: (value: number) => void;
  toggleInvert: (axis: keyof SpaceMouseInvert) => void;
  resetSettings: () => void;
  setConnection: (status: SpaceMouseConnectionStatus, deviceName?: string | null) => void;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useSpaceMouseStore = create<SpaceMouseState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      status: 'idle',
      deviceName: null,

      setSensitivity: (value) => set((s) => ({ settings: { ...s.settings, sensitivity: value } })),
      setTranslateSpeed: (value) =>
        set((s) => ({ settings: { ...s.settings, translateSpeed: value } })),
      setRotateSpeed: (value) => set((s) => ({ settings: { ...s.settings, rotateSpeed: value } })),
      toggleInvert: (axis) =>
        set((s) => ({
          settings: {
            ...s.settings,
            invert: { ...s.settings.invert, [axis]: !s.settings.invert[axis] },
          },
        })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      setConnection: (status, deviceName) =>
        set((s) => ({ status, deviceName: deviceName === undefined ? s.deviceName : deviceName })),
    }),
    {
      name: SPACEMOUSE_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof localStorage !== 'undefined' ? localStorage : noopStorage
      ),
      // Only the tuning is durable; connection state is per-session.
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => {
        const p = persisted as { settings?: Partial<SpaceMouseSettings> } | undefined;
        return {
          ...current,
          settings: {
            ...current.settings,
            ...p?.settings,
            invert: { ...current.settings.invert, ...p?.settings?.invert },
          },
        };
      },
    }
  )
);

export function useSpaceMouseSettings(): SpaceMouseSettings {
  return useSpaceMouseStore((s) => s.settings);
}

export function useSpaceMouseConnection(): {
  status: SpaceMouseConnectionStatus;
  deviceName: string | null;
} {
  return useSpaceMouseStore(useShallow((s) => ({ status: s.status, deviceName: s.deviceName })));
}
