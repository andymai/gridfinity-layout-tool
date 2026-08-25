/**
 * One-tap starting points for the Repeat section's empty state.
 *
 * The section used to open with a single "create" button, which asked the user
 * to understand modes, pitch and counts before seeing anything happen. A preset
 * produces a result on the first click instead, and the full controls appear
 * underneath it for tuning.
 *
 * Every preset is checked against `arrayFieldBounds` before it is offered: a
 * chip that would be clamped the moment it is applied is worse than a chip that
 * is visibly unavailable.
 */

import type { RepeatBox } from '@/shared/utils/cutoutArray';
import type { CutoutArrayConfig } from '@/features/bin-designer/types';
import { arrayFieldBounds, defaultArrayConfig } from '@/shared/utils/cutoutArray';

export type RepeatPresetId = 'grid2x2' | 'grid3x2' | 'row5' | 'ring6';

export interface RepeatPreset {
  readonly id: RepeatPresetId;
  /** Ring presets are labelled from i18n; grid presets read as `cols × rows`. */
  readonly cols: number;
  readonly rows: number;
  readonly radial: boolean;
}

export const REPEAT_PRESETS: readonly RepeatPreset[] = [
  { id: 'grid2x2', cols: 2, rows: 2, radial: false },
  { id: 'grid3x2', cols: 3, rows: 2, radial: false },
  { id: 'row5', cols: 5, rows: 1, radial: false },
  { id: 'ring6', cols: 1, rows: 1, radial: true },
];

/** Instances a preset expands to, for its accessible label. */
export function presetInstanceCount(preset: RepeatPreset): number {
  return preset.radial ? 6 : preset.cols * preset.rows;
}

export function buildPresetConfig(preset: RepeatPreset, cutout: RepeatBox): CutoutArrayConfig {
  const base = defaultArrayConfig(cutout.width, cutout.depth);
  if (preset.radial) return { ...base, mode: 'radial', count: presetInstanceCount(preset) };
  return { ...base, mode: 'grid', cols: preset.cols, rows: preset.rows };
}

/** True when the preset fits the bin at the cutout's current position. */
export function presetFits(
  preset: RepeatPreset,
  cutout: RepeatBox,
  binWidth: number,
  binDepth: number
): boolean {
  const config = buildPresetConfig(preset, cutout);
  const bounds = arrayFieldBounds(cutout, binWidth, binDepth, config);
  if (config.mode === 'radial') return config.radius <= bounds.maxRadius;
  return (
    config.cols <= bounds.maxCols &&
    config.rows <= bounds.maxRows &&
    (config.cols === 1 ||
      (config.pitchX >= bounds.minPitchX && config.pitchX <= bounds.maxPitchX)) &&
    (config.rows === 1 || (config.pitchY >= bounds.minPitchY && config.pitchY <= bounds.maxPitchY))
  );
}

/**
 * The default config trimmed to what the bin can actually hold, for the
 * fallback button that stays available when every preset is too big. Returns
 * null when there is not even room for a second instance, so the caller can
 * disable rather than create a one-instance repeat that does nothing.
 */
export function clampedDefaultConfig(
  cutout: RepeatBox,
  binWidth: number,
  binDepth: number
): CutoutArrayConfig | null {
  const base = defaultArrayConfig(cutout.width, cutout.depth);
  const bounds = arrayFieldBounds(cutout, binWidth, binDepth, base);
  const cols = Math.min(base.cols, bounds.maxCols);
  const rows = Math.min(base.rows, bounds.maxRows);
  if (cols * rows < 2) return null;
  return { ...base, cols, rows };
}
