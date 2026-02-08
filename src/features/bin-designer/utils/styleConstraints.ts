/**
 * Style constraint logic for the bin designer.
 *
 * Different bin styles may disable certain interior features
 * or show warnings about structural limitations.
 */

import type { BinStyle } from '../types';

/** Features that can be constrained by a style */
export type ConstrainedFeature = 'dividers' | 'label';

/** Constraint information for a bin style */
export interface StyleConstraints {
  /** Features disabled by this style */
  readonly disabledFeatures: readonly ConstrainedFeature[];
  /** i18n keys explaining why each feature is disabled */
  readonly disabledReasons: Partial<Record<ConstrainedFeature, string>>;
  /** Warning messages to show in the UI */
  readonly warnings: readonly string[];
  /** Extra gusset reinforcement available */
  readonly hasGussets: boolean;
}

const STYLE_CONSTRAINTS: Record<BinStyle, StyleConstraints> = {
  standard: {
    disabledFeatures: [],
    disabledReasons: {},
    warnings: [],
    hasGussets: false,
  },
  slotted: {
    disabledFeatures: ['dividers', 'label'],
    disabledReasons: {
      label: 'binDesigner.labelTabsUnavailableSlotted',
    },
    warnings: [],
    hasGussets: false,
  },
  solid: {
    disabledFeatures: ['dividers', 'label'],
    disabledReasons: {
      label: 'binDesigner.labelTabsUnavailableSlotted',
    },
    warnings: [],
    hasGussets: false,
  },
};

/**
 * Returns constraint information for the given style.
 * Used by UI to disable/warn about incompatible features.
 * Falls back to 'standard' constraints if the style is invalid.
 */
export function getStyleConstraints(style: BinStyle): StyleConstraints {
  return STYLE_CONSTRAINTS[style] ?? STYLE_CONSTRAINTS.standard;
}

/**
 * Checks if a specific feature is disabled for a given style.
 * Falls back to 'standard' constraints if the style is invalid.
 */
export function isFeatureDisabled(style: BinStyle, feature: ConstrainedFeature): boolean {
  const constraints = STYLE_CONSTRAINTS[style] ?? STYLE_CONSTRAINTS.standard;
  return constraints.disabledFeatures.includes(feature);
}
