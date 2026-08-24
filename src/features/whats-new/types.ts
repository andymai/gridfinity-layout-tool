import type { FeatureId } from '@/core/labs';
import type { Locale } from '@/i18n/types';
import type { ICON_PATHS } from '@/shared/constants/iconPaths';

/**
 * Entry copy lives outside the i18n key system on purpose. Routing it through
 * `en.ts` would put every announced change behind `check:i18n:values`, which
 * blocks a commit until all 14 non-English locales are filled in. Translations
 * are welcome here but never required: a missing locale falls back to English.
 */
export type LocalizedText = { en: string } & Partial<Record<Locale, string>>;

export type WhatsNewKind = 'new' | 'improved' | 'fixed';

/**
 * Destinations are a closed union rather than a route string so a two-month-old
 * entry cannot quietly point at a surface that no longer exists: removing a
 * destination breaks the exhaustive switch that resolves it.
 */
export type WhatsNewAction =
  | { kind: 'openTool'; tool: 'layout' | 'designer' | 'baseplate' }
  | { kind: 'openModal'; modal: 'baseplateLibrary' | 'print' | 'designGallery' };

export interface WhatsNewEntry {
  /** Stable, never reused. Doubles as the seen-marker written to localStorage. */
  id: string;
  /** ISO date (YYYY-MM-DD) the change shipped. */
  date: string;
  title: LocalizedText;
  kind?: WhatsNewKind;
  body?: LocalizedText;
  /** Overrides the glyph derived from `kind`. */
  icon?: keyof typeof ICON_PATHS;
  /** Marks the entry as an opt-in Labs feature and points its action at Labs. */
  labs?: FeatureId;
  action?: WhatsNewAction;
}
