import { useEffect, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/core/store';

const MQ = '(prefers-color-scheme: light)';

function subscribeToColorScheme(callback: () => void): () => void {
  const mq = window.matchMedia(MQ);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia(MQ).matches ? 'light' : 'dark';
}

/**
 * Returns the resolved theme ('light' | 'dark'), accounting for 'system' preference.
 * Use this in components that need to react to theme changes (e.g. Three.js scenes).
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useSettingsStore((state) => state.settings.theme);
  const systemTheme = useSyncExternalStore(
    subscribeToColorScheme,
    getSystemTheme,
    () => 'dark' as const
  );
  if (theme === 'system') return systemTheme;
  if (theme === 'light') return 'light';
  return 'dark';
}

/** Hardcoded color palettes for Three.js scenes (CSS vars don't work in WebGL). */
export const THREE_COLORS = {
  dark: {
    canvasBg: '#0a0a0f',
    floorPlane: '#2a2a3e',
    gridLine: '#ffffff',
    gridLineOpacity: 0.12,
    gridEdgeOpacity: 0.08,
    groundBounce: '#1a1a2e',
    gradientTop: '#2a2a3e',
    gradientMid: '#252535',
    gradientBottom: '#2a2a3e',
    labelColor: '#ffffff',
    lineColor: '#ffffff',
    lineOpacity: 0.5,
    footprintLine: '#ffffff',
    groundPlane: '#1e1e2e',
    contactShadowColor: '#000000',
  },
  light: {
    canvasBg: '#edecea',
    floorPlane: '#e4e2de',
    gridLine: '#000000',
    gridLineOpacity: 0.1,
    gridEdgeOpacity: 0.06,
    groundBounce: '#d6d3cc',
    gradientTop: '#f0efec',
    gradientMid: '#eceae6',
    gradientBottom: '#e8e6e1',
    labelColor: '#1c1b18',
    lineColor: '#1c1b18',
    lineOpacity: 0.6,
    footprintLine: '#000000',
    groundPlane: '#e0ddd8',
    contactShadowColor: '#2a2520',
  },
} as const;

export type ThreeColors = (typeof THREE_COLORS)[keyof typeof THREE_COLORS];

/** Returns Three.js-compatible hex colors for the current theme. */
export function useThreeColors(): ThreeColors {
  const resolved = useResolvedTheme();
  return THREE_COLORS[resolved];
}

/**
 * Syncs appearance settings (theme, accent, density, reduce-motion,
 * high-contrast) to data attributes on `<html>`. Mounted once at the app root.
 */
export function useThemeEffect(): void {
  const { accentColor, uiDensity, reduceMotion, highContrast } = useSettingsStore(
    useShallow((state) => ({
      accentColor: state.settings.accentColor,
      uiDensity: state.settings.uiDensity,
      reduceMotion: state.settings.reduceMotion,
      highContrast: state.settings.highContrast,
    }))
  );

  const resolved = useResolvedTheme();

  // Apply data attributes to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = resolved;
    html.dataset.accent = accentColor;
    html.dataset.density = uiDensity;
    html.dataset.reduceMotion = String(reduceMotion);
    html.dataset.highContrast = String(highContrast);
  }, [resolved, accentColor, uiDensity, reduceMotion, highContrast]);
}
