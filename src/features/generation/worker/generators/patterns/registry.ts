/**
 * Pattern registry — central mapping of pattern types to calculators.
 *
 * Provides factory functions to create pattern calculators based on pattern
 * type, bin height, and normalized scale. Single source of truth for pattern
 * configuration. Typed as `Record<WallPatternType, …>`, so adding a member to
 * `WallPatternType` forces a matching entry here at compile time.
 *
 * To add a new pattern:
 * 1. Create a calculator implementing StampPatternCalculator (or, for complex
 *    tiled motifs, MotifPatternCalculator).
 * 2. Add an entry to PATTERN_REGISTRY with its factory function.
 * 3. Update the WallPatternType union in types/index.ts.
 */

import type { WallPatternType } from '@/shared/types/bin';
import type { PatternCalculator } from './types';
import type { HoneycombPatternCalculator } from './honeycombPattern';
import { createHoneycombCalculator } from './honeycombPattern';
import { createRoundCalculator } from './roundPattern';
import { createDiamondCalculator } from './diamondPattern';
import { createTriangleCalculator } from './trianglePattern';
import { createSlotCalculator } from './slotPattern';
import { createMitsukudeCalculator } from './kumiko/mitsukude';
import { createGomaCalculator } from './kumiko/goma';
import { createAsanohaCalculator } from './kumiko/asanoha';
import { createSakuraCalculator } from './kumiko/sakura';
import { createRindoCalculator } from './kumiko/rindo';
import { createMikadoCalculator } from './kumiko/mikado';
import { createTsumiishiKikkoCalculator } from './kumiko/tsumiishiKikko';

/**
 * Registry entry for a pattern type.
 */
export interface PatternRegistryEntry {
  /** Factory: builds a calculator with size- and scale-adaptive parameters. */
  createCalculator: (binHeight: number, scale: number) => PatternCalculator;
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
  round: {
    createCalculator: createRoundCalculator,
    displayName: 'Round',
  },
  diamond: {
    createCalculator: createDiamondCalculator,
    displayName: 'Diamond',
  },
  triangle: {
    createCalculator: createTriangleCalculator,
    displayName: 'Triangle',
  },
  slots: {
    createCalculator: createSlotCalculator,
    displayName: 'Slots',
  },
  mitsukude: {
    createCalculator: createMitsukudeCalculator,
    displayName: 'Mitsukude',
  },
  goma: {
    createCalculator: createGomaCalculator,
    displayName: 'Goma',
  },
  asanoha: {
    createCalculator: createAsanohaCalculator,
    displayName: 'Asanoha',
  },
  sakura: {
    createCalculator: createSakuraCalculator,
    displayName: 'Sakura',
  },
  rindo: {
    createCalculator: createRindoCalculator,
    displayName: 'Rindo',
  },
  mikado: {
    createCalculator: createMikadoCalculator,
    displayName: 'Mikado',
  },
  'tsumiishi-kikko': {
    createCalculator: createTsumiishiKikkoCalculator,
    displayName: 'Tsumiishi-Kikko',
  },
};

/**
 * Get a pattern calculator for the given pattern type, bin height, and scale.
 *
 * @param pattern - The wall pattern type
 * @param binHeight - Bin height in grid units (affects element size)
 * @param scale - Normalized pattern scale in [0, 1] (0.5 = neutral). Untrusted
 *   values are clamped inside each factory.
 * @returns PatternCalculator instance configured for the pattern
 */
export function getPatternCalculator(
  pattern: WallPatternType,
  binHeight: number,
  scale = 0.5
): PatternCalculator {
  // Runtime guard: pattern may come from saved data that doesn't match current types
  const entry = (PATTERN_REGISTRY as Record<string, PatternRegistryEntry | undefined>)[pattern];
  if (!entry) {
    const available = Object.keys(PATTERN_REGISTRY).join(', ');
    throw new Error(`Unknown wall pattern type: "${pattern}". Available patterns: ${available}`);
  }
  return entry.createCalculator(binHeight, scale);
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
