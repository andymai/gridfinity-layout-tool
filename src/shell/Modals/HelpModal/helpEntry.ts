/**
 * Help entry types — the unified shape consumed by the Help modal's search,
 * regardless of whether the entry describes a keyboard shortcut, a feature, or a
 * static tip.
 *
 * Entries are pure data (no closures). Deep-link behavior is resolved at runtime
 * by `helpJumpDispatcher` so this module stays bundle-light and tree-shakable.
 */

import type { ReactNode } from 'react';

export type HelpEntryKind = 'shortcut' | 'feature' | 'tip';

export interface HelpTarget {
  /** Surface identifier the dispatcher knows how to open (e.g. 'sidebar:physical-units'). */
  surface: string;
  /** Value of the `data-help-target` attribute on the destination DOM node. */
  controlId: string;
}

interface BaseHelpEntry {
  id: string;
  kind: HelpEntryKind;
  /** Required i18n key for the entry's display title (used in search + result rendering). */
  titleKey: string;
  /** Required i18n key for the long-form description. */
  descriptionKey: string;
  /**
   * Optional i18n key resolving to a `|`-delimited list of locale-specific
   * synonyms. `|` chosen over `,` because it's vanishingly unlikely to appear
   * inside a synonym phrase.
   */
  keywordsKey?: string;
  /** Category id (matches `SHORTCUT_CATEGORIES`/feature group); used for ordering and badging. */
  category?: string;
  /** Optional decorative icon for result-list rendering. */
  icon?: ReactNode;
}

export interface ShortcutHelpEntry extends BaseHelpEntry {
  kind: 'shortcut';
  keys: string | readonly string[];
  modifier?: boolean;
  shift?: boolean;
}

export interface FeatureHelpEntry extends BaseHelpEntry {
  kind: 'feature';
  target: HelpTarget;
}

export interface TipHelpEntry extends BaseHelpEntry {
  kind: 'tip';
}

export type HelpEntry = ShortcutHelpEntry | FeatureHelpEntry | TipHelpEntry;

export const KEYWORDS_DELIMITER = '|';
