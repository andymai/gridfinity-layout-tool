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
  /** Warning messages to show in the UI */
  readonly warnings: readonly string[];
  /** Extra gusset reinforcement available */
  readonly hasGussets: boolean;
}

const STYLE_CONSTRAINTS: Record<BinStyle, StyleConstraints> = {
  standard: {
    disabledFeatures: [],
    warnings: [],
    hasGussets: false,
  },
  lite: {
    disabledFeatures: [],
    warnings: ['Thinner walls may reduce structural integrity with heavy items'],
    hasGussets: false,
  },
  solid: {
    disabledFeatures: [],
    warnings: [],
    hasGussets: true,
  },
};

/**
 * Returns constraint information for the given style.
 * Used by UI to disable/warn about incompatible features.
 */
export function getStyleConstraints(style: BinStyle): StyleConstraints {
  return STYLE_CONSTRAINTS[style];
}

/**
 * Checks if a specific feature is disabled for a given style.
 */
export function isFeatureDisabled(style: BinStyle, feature: ConstrainedFeature): boolean {
  return STYLE_CONSTRAINTS[style].disabledFeatures.includes(feature);
}
