import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { LABS_STORAGE_KEY } from '@/core/store/labs';
import { DEFAULT_SETTINGS, SPACEMOUSE_SETTINGS_STORAGE_KEY } from './constants';
import type {
  SpaceMouseConnectionStatus,
  SpaceMouseInvert,
  SpaceMouseSettings,
  SpaceMouseTransport,
} from './types';

/** Whoever turned this on in Labs stays on until they turn it off here. */
function hadLabsOptIn(): boolean {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LABS_STORAGE_KEY) : null;
    if (raw === null) return false;
    const prefs = JSON.parse(raw) as { enabledFeatures?: Record<string, unknown> };
    return prefs.enabledFeatures?.spacemouse === true;
  } catch {
    return false;
  }
}

interface SpaceMouseState {
  /** Off by default: while off, nothing probes for a driver or a device. */
  enabled: boolean;
  /** Persisted tuning. */
  settings: SpaceMouseSettings;
  /** Transient connection state (never persisted). */
  status: SpaceMouseConnectionStatus;
  deviceName: string | null;
  /** Which transport is active, or null when nothing is connected. */
  transport: SpaceMouseTransport | null;

  setEnabled: (enabled: boolean) => void;
  setSensitivity: (value: number) => void;
  setTranslateSpeed: (value: number) => void;
  setRotateSpeed: (value: number) => void;
  toggleInvert: (axis: keyof SpaceMouseInvert) => void;
  resetSettings: () => void;
  setConnection: (status: SpaceMouseConnectionStatus, deviceName?: string | null) => void;
  setTransport: (transport: SpaceMouseTransport | null) => void;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useSpaceMouseStore = create<SpaceMouseState>()(
  persist(
    (set) => ({
      enabled: false,
      settings: DEFAULT_SETTINGS,
      status: 'idle',
      deviceName: null,
      transport: null,

      setEnabled: (enabled) => set({ enabled }),
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
      setTransport: (transport) => set({ transport }),
    }),
    {
      name: SPACEMOUSE_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof localStorage !== 'undefined' ? localStorage : noopStorage
      ),
      // Connection state is per-session; only the opt-in and tuning are durable.
      partialize: (s) => ({ enabled: s.enabled, settings: s.settings }),
      merge: (persisted, current) => {
        const p = persisted as
          { enabled?: unknown; settings?: Partial<SpaceMouseSettings> } | undefined;
        return {
          ...current,
          enabled: typeof p?.enabled === 'boolean' ? p.enabled : hadLabsOptIn(),
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
  transport: SpaceMouseTransport | null;
} {
  return useSpaceMouseStore(
    useShallow((s) => ({ status: s.status, deviceName: s.deviceName, transport: s.transport }))
  );
}
