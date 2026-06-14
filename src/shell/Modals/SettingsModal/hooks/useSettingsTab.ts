import { useState, useEffect, useCallback } from 'react';
import { TAB_DEFINITIONS } from '../tabDefinitions';
import type { SettingsTabId } from '../types';

const STORAGE_KEY = 'gridfinity-settings-active-tab';

// Derived from TAB_DEFINITIONS so newly added tabs can never silently fail to
// restore from sessionStorage (the previous hardcoded list omitted several).
const VALID_TABS: SettingsTabId[] = TAB_DEFINITIONS.map((tab) => tab.id);

function isValidTab(value: unknown): value is SettingsTabId {
  return typeof value === 'string' && VALID_TABS.includes(value as SettingsTabId);
}

function getStoredTab(): SettingsTabId | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return isValidTab(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Manages the active settings tab with sessionStorage persistence.
 *
 * Priority: initialTab prop > sessionStorage > 'general'
 * Uses sessionStorage (not localStorage) so tab resets between browser sessions
 * but persists within a session.
 *
 * The modal remounts each time it opens, so initialTab is captured in useState
 * initializer — no effect needed for prop sync.
 */
export function useSettingsTab(initialTab?: SettingsTabId) {
  const [activeTab, setActiveTabState] = useState<SettingsTabId>(
    () => initialTab ?? getStoredTab() ?? 'general'
  );

  const setActiveTab = useCallback((tab: SettingsTabId) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem(STORAGE_KEY, tab);
    } catch {
      // best-effort
    }
  }, []);

  // Sync initial value to sessionStorage on mount
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, activeTab);
    } catch {
      // best-effort
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only sync of initial value to sessionStorage
  }, []);

  return { activeTab, setActiveTab };
}
