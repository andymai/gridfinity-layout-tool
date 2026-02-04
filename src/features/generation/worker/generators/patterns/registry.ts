/**
 * Pattern registry — central mapping of pattern types to calculators.
 *
 * Provides factory functions to create pattern calculators based on pattern type
 * and bin dimensions. This is the single source of truth for pattern configuration.
 *
 * To add a new pattern:
 * 1. Create a new calculator class implementing PatternCalculator
 * 2. Add an entry to PATTERN_REGISTRY with its factory function
 * 3. Update WallPatternType union in types/index.ts
 */

import type { WallPatternType } from '@/shared/types/bin';
import type { PatternCalculator } from './types';
import type { HoneycombPatternCalculator } from './honeycombPattern';
import { createHoneycombCalculator } from './honeycombPattern';

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
 */
export const PATTERN_REGISTRY: Record<WallPatternType, PatternRegistryEntry> = {
  honeycomb: {
    createCalculator: createHoneycombCalculator,
    displayName: 'Honeycomb',
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
  // Runtime guard: pattern may come from saved data that doesn't match current types
  const entry = (PATTERN_REGISTRY as Record<string, PatternRegistryEntry | undefined>)[pattern];
  if (!entry) {
    const available = Object.keys(PATTERN_REGISTRY).join(', ');
    throw new Error(`Unknown wall pattern type: "${pattern}". Available patterns: ${available}`);
  }
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
 * Get all available pattern types.
 */
export function getAvailablePatterns(): WallPatternType[] {
  return Object.keys(PATTERN_REGISTRY) as WallPatternType[];
}
