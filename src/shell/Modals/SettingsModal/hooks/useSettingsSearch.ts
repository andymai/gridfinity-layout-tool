import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { SETTINGS_REGISTRY } from '../settingsRegistry';
import { TAB_DEFINITIONS } from '../tabDefinitions';
import type { SettingsTabId } from '../types';

export interface SettingsSearchResult {
  id: string;
  tabId: SettingsTabId;
  label: string;
  tabLabel: string;
}

/**
 * Filters the settings registry by a free-text query, matching against each
 * section's translated label and optional keyword synonyms. Results are ranked
 * label-prefix > word-prefix > substring. Empty query returns no results.
 */
export function useSettingsSearch(query: string): SettingsSearchResult[] {
  const t = useTranslation();

  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    const tabLabel = (tabId: SettingsTabId): string => {
      const def = TAB_DEFINITIONS.find((tab) => tab.id === tabId);
      return def ? t(def.labelKey) : tabId;
    };

    const scored = SETTINGS_REGISTRY.map((entry) => {
      const label = t(entry.labelKey);
      const keywords = entry.keywordsKey ? t(entry.keywordsKey) : '';
      const haystack = `${label} ${keywords}`.toLowerCase();
      const labelLower = label.toLowerCase();

      let score = -1;
      if (labelLower.startsWith(needle)) score = 3;
      else if (labelLower.split(/\s+/).some((word) => word.startsWith(needle))) score = 2;
      else if (haystack.includes(needle)) score = 1;

      return { entry, label, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    return scored.map(({ entry, label }) => ({
      id: entry.id,
      tabId: entry.tabId,
      label,
      tabLabel: tabLabel(entry.tabId),
    }));
  }, [query, t]);
}
