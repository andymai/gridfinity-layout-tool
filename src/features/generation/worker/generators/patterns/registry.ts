/**
 * Pattern registry — central mapping of pattern types to calculators.
 *
 * Provides factory functions to create pattern calculators based on pattern type
 * and bin dimensions. This is the single source of truth for pattern configuration.
 */

import type { WallPatternType } from '@/shared/types/bin';
import type { PatternCalculator } from './types';
import type { HoneycombPatternCalculator } from './honeycombPattern';
import { createHoneycombCalculator } from './honeycombPattern';
import type { GothicPatternCalculator } from './gothicPattern';
import { createGothicCalculator } from './gothicPattern';

/**
 * Registry entry for a pattern type.
 */
export interface PatternRegistryEntry {
  /** Factory function to create calculator with size-adaptive parameters */
  createCalculator: (binHeight: number) => PatternCalculator;
  /** Human-readable display name (for debugging) */
  displayName: string;
}

/**
 * Pattern registry mapping pattern types to their calculator factories.
 *
 * To add a new pattern:
 * 1. Create a new calculator class implementing PatternCalculator
 * 2. Add an entry here with its factory function
 * 3. Update WallPatternType union in types/index.ts
 */
export const PATTERN_REGISTRY: Record<WallPatternType, PatternRegistryEntry> = {
  honeycomb: {
    createCalculator: createHoneycombCalculator,
    displayName: 'Honeycomb',
  },
  gothic: {
    createCalculator: createGothicCalculator,
    displayName: 'Gothic',
  },
};

/**
 * Get a pattern calculator for the given pattern type and bin height.
 *
 * @param pattern - The wall pattern type
 * @param binHeight - Bin height in grid units (affects pattern element size)
 * @returns PatternCalculator instance configured for the pattern
 */
export function getPatternCalculator(
  pattern: WallPatternType,
  binHeight: number
): PatternCalculator {
  const entry = PATTERN_REGISTRY[pattern];
  return entry.createCalculator(binHeight);
}

/**
 * Type guard to check if a calculator is a HoneycombPatternCalculator.
 */
export function isHoneycombCalculator(
  calculator: PatternCalculator
): calculator is HoneycombPatternCalculator {
  return calculator.getPatternType() === 'honeycomb';
}

/**
 * Type guard to check if a calculator is a GothicPatternCalculator.
 */
export function isGothicCalculator(
  calculator: PatternCalculator
): calculator is GothicPatternCalculator {
  return calculator.getPatternType() === 'gothic';
}

/**
 * Get all available pattern types.
 */
export function getAvailablePatterns(): WallPatternType[] {
  return Object.keys(PATTERN_REGISTRY) as WallPatternType[];
}
