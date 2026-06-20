import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';

/**
 * Cohesive gallery palette — a graphite body plus a small set of harmonious
 * accents, reused across the colored hero examples so the gallery reads as
 * designed rather than random.
 */
export const PALETTE = {
  /** Light neutral body — reads clearly against the dark gallery backdrop. */
  body: '#c2c7cd',
  amber: '#e0a82e',
  teal: '#2ea3a3',
  coral: '#e0552e',
  graphite: '#3a3f44',
} as const;

type ZoneOverrides = Partial<Omit<FeatureColorConfig, 'enabled' | 'lip'>> & {
  /** Uniform lip color (gallery examples don't use the per-cell grid). */
  readonly lip?: string;
};

/**
 * Build an enabled {@link FeatureColorConfig} from the gallery palette.
 * Unspecified zones fall back to the body color so a single accent pops; body
 * defaults to graphite. Spreads designer defaults to stay forward-compatible.
 */
export function coloredFeatures(overrides: ZoneOverrides = {}): FeatureColorConfig {
  const base = DEFAULT_BIN_PARAMS.featureColors;
  const body = overrides.body ?? PALETTE.body;
  return {
    ...base,
    enabled: true,
    body,
    base: overrides.base ?? body,
    labelTab: overrides.labelTab ?? body,
    scoop: overrides.scoop ?? body,
    dividers: overrides.dividers ?? body,
    text: overrides.text ?? body,
    lid: overrides.lid ?? body,
    lip: {
      corners: 1,
      bands: 1,
      cells: makeUniformLipCells(overrides.lip ?? body),
    },
  };
}
