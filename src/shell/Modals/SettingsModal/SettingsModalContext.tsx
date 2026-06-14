import { createContext, useContext } from 'react';
import type { SettingsTabId } from './types';

export interface SettingsNavValue {
  /**
   * Switch to `tabId` and, once it renders, scroll its `sectionId` anchor into
   * view and briefly highlight it. Used by settings search results.
   */
  navigateToSection: (tabId: SettingsTabId, sectionId?: string) => void;

  /** Section anchor id currently being highlighted (or null). */
  highlightedSectionId: string | null;
}

const SettingsNavContext = createContext<SettingsNavValue | null>(null);

export const SettingsNavProvider = SettingsNavContext.Provider;

/**
 * Access settings navigation. Returns a no-op fallback when used outside the
 * modal (e.g. a section rendered standalone in a test) so consumers never crash.
 */
export function useSettingsNav(): SettingsNavValue {
  return (
    useContext(SettingsNavContext) ?? {
      navigateToSection: () => {},
      highlightedSectionId: null,
    }
  );
}
