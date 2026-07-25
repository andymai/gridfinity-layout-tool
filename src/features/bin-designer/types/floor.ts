import { DEFAULT_PATTERN_SCALE, type WallPatternType } from './walls';

/**
 * Patterns the bin floor can carry.
 *
 * A subset of {@link WallPatternType}: only the `stamp` calculators tile a
 * bounded 2D area. The kumiko wrapped lattices are authored in unrolled
 * perimeter coordinates and only exist as a continuous band around the walls,
 * so they have no meaning on a floor.
 */
export const FLOOR_PATTERN_TYPES = [
  'round',
  'honeycomb',
  'diamond',
  'triangle',
  'slots',
] as const satisfies readonly WallPatternType[];

export type FloorPatternType = (typeof FLOOR_PATTERN_TYPES)[number];

/**
 * Floor pattern configuration — perforates the bin floor AND the base socket
 * beneath it, so the holes drain rather than leaving a blind pocket (#2816).
 *
 * Deliberately independent of {@link WallPatternConfig}: a drainer bin wants an
 * open floor behind solid walls, and the element size that reads well on a
 * 4mm-thick floor is not the one that reads well on a wall band.
 */
export interface FloorPatternConfig {
  readonly enabled: boolean;
  readonly pattern: FloorPatternType;
  /**
   * Normalized element scale in [0, 1] — finer (0) to bolder (1); 0.5 is
   * neutral. Optional so a persisted config can omit it; migration backfills it
   * and the geometry layer defaults + clamps untrusted values.
   */
  readonly scale?: number;
}

/**
 * Default floor pattern: disabled, round holes.
 *
 * Lives beside the type (rather than in `constants/defaults.ts`) so the shared
 * constraint engine can reach it through `@/shared/types/bin` without importing
 * across the feature boundary.
 */
export const DEFAULT_FLOOR_PATTERN_CONFIG: FloorPatternConfig = {
  enabled: false,
  pattern: 'round',
  scale: DEFAULT_PATTERN_SCALE,
} as const;
