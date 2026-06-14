import type { SettingsTabId } from './types';

/**
 * A searchable settings section. `id` must match the DOM `id` of the section's
 * anchor element so search results can scroll it into view. That anchor is
 * usually a `<SettingSection id=...>`, but any element with a matching `id`
 * works too (e.g. AccountTab's wrapper `<div id="account">`).
 */
export interface SettingsRegistryEntry {
  id: string;
  tabId: SettingsTabId;
  /** i18n key for the section's display label (its title). */
  labelKey: string;
  /**
   * i18n key for a comma-separated list of extra search terms (synonyms users
   * might type that don't appear in the label). Optional.
   */
  keywordsKey?: string;
}

/**
 * Flat index of every searchable settings section, grouped conceptually by tab.
 * Keep `id` values in sync with the `<SettingSection id=...>` anchors.
 */
export const SETTINGS_REGISTRY: SettingsRegistryEntry[] = [
  // General
  {
    id: 'language',
    tabId: 'general',
    labelKey: 'settings.language',
    keywordsKey: 'settings.search.keywords.language',
  },
  // Appearance
  {
    id: 'theme',
    tabId: 'appearance',
    labelKey: 'settings.theme',
    keywordsKey: 'settings.search.keywords.theme',
  },
  { id: 'accent', tabId: 'appearance', labelKey: 'settings.accentColor' },
  { id: 'density', tabId: 'appearance', labelKey: 'settings.uiDensity' },
  {
    id: 'motion',
    tabId: 'appearance',
    labelKey: 'settings.reduceMotion',
    keywordsKey: 'settings.search.keywords.motion',
  },
  // Layout Defaults
  {
    id: 'layout-dimensions',
    tabId: 'defaults',
    labelKey: 'settings.defaultPreferences',
    keywordsKey: 'settings.search.keywords.layout',
  },
  // Print & Material
  {
    id: 'print-estimates',
    tabId: 'print',
    labelKey: 'settings.printEstimates',
    keywordsKey: 'settings.search.keywords.print',
  },
  // Categories & Bins
  { id: 'default-categories', tabId: 'categories', labelKey: 'settings.defaultCategories' },
  { id: 'bin-defaults', tabId: 'categories', labelKey: 'settings.binDefaults.title' },
  // Account
  {
    id: 'account',
    tabId: 'account',
    labelKey: 'settings.tabs.account',
    keywordsKey: 'settings.search.keywords.account',
  },
  // Privacy
  {
    id: 'privacy-analytics',
    tabId: 'privacy',
    labelKey: 'settings.privacy',
    keywordsKey: 'settings.search.keywords.privacy',
  },
  // Storage
  { id: 'storage-status', tabId: 'storage', labelKey: 'settings.storage.status' },
  {
    id: 'storage-danger',
    tabId: 'storage',
    labelKey: 'settings.storage.dangerZone',
    keywordsKey: 'settings.search.keywords.storageDanger',
  },
  // Integrations
  {
    id: 'stl-search',
    tabId: 'integrations',
    labelKey: 'settings.stlSearch',
    keywordsKey: 'settings.search.keywords.stl',
  },
  // Labs
  {
    id: 'labs',
    tabId: 'labs',
    labelKey: 'settings.labs',
    keywordsKey: 'settings.search.keywords.labs',
  },
];
