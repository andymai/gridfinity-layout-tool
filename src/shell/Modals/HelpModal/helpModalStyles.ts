/**
 * Shared style objects, key-formatting helpers, and shortcut interfaces
 * used by both `HelpModal` and `HelpModalSections`.
 *
 * Extracted so the React components can stay focused on layout and the
 * data layer (`helpModalShortcutData`) can pull in the types without
 * dragging the rest of the modal along.
 */

import type { CSSProperties } from 'react';

// Style constants to avoid recreating objects on each render
export const STYLES = {
  // Overlay and modal
  overlay: { backgroundColor: 'var(--overlay-dark)' } as CSSProperties,
  modal: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-xl)',
  } as CSSProperties,
  // Typography
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 'var(--font-bold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionHeader: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as CSSProperties,
  textPrimary: { color: 'var(--text-primary)' } as CSSProperties,
  colorPrimary: { color: 'var(--color-primary)' } as CSSProperties,
  // Containers
  tipsList: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  } as CSSProperties,
  blockedZonesContent: {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  } as CSSProperties,
  // Button
  buttonCompact: { minWidth: 'auto', minHeight: 'auto' } as CSSProperties,
} as const;

// Shortcut categories with their shortcuts
export interface ShortcutItem {
  keys: string | readonly string[];
  descriptionKey: string; // Translation key
  modifier?: boolean; // Whether to show Ctrl/⌘ prefix
  shift?: boolean; // Whether to show Shift prefix
}

export interface ShortcutCategory {
  id: string;
  nameKey: string; // Translation key
  icon: React.ReactNode;
  shortcuts: ShortcutItem[];
}

export const KEY_SEPARATOR = '+';

export const getModifierKey = (): string => {
  if (typeof navigator === 'undefined') return 'Ctrl';
  const isMac = /mac/i.test(navigator.userAgent);
  return isMac ? '⌘' : 'Ctrl';
};

export const formatKey = (key: string | readonly string[]): string => {
  if (Array.isArray(key)) {
    return key.join(' / ');
  }
  return key as string;
};
