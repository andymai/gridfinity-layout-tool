/**
 * The slices of app modules the capture scripts reach inside the page. They
 * load through Vite's module graph by URL, which TypeScript cannot resolve, so
 * each import is cast to the part it uses.
 */

import type { Theme } from './stage';

export interface DesignerStoreModule {
  useDesignerStore: {
    getState(): {
      params: Record<string, unknown>;
      generation: {
        status: string;
        isDraft: boolean;
        mesh: {
          labelPlates?: { plates: { seatX: number; seatY: number; seatZ: number }[] } | null;
        } | null;
      };
      setParams(params: Record<string, unknown>): void;
      newDesign(kind: 'bin'): void;
    };
  };
}

export interface DefaultsModule {
  DEFAULT_BIN_PARAMS: Record<string, unknown>;
}

export interface SettingsStoreModule {
  useSettingsStore: {
    getState(): { updateSetting(key: 'theme', value: Theme): void };
  };
}

export interface ThemeColorsModule {
  THREE_COLORS: Record<Theme, { groundBounce: string }>;
}
