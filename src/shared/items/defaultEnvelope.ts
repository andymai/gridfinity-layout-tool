import type { FeatureColorConfig } from '@/shared/types/bin';
import type { ItemEnvelope } from '@/shared/types/item';

/** Default shared envelope for a freshly-created non-bin item. */
export function createDefaultEnvelope(featureColors: FeatureColorConfig): ItemEnvelope {
  return {
    width: 4,
    depth: 2,
    gridUnitMm: 42,
    heightUnitMm: 7,
    attachment: {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2.4,
      screwHoles: false,
      screwDiameter: 3,
    },
    featureColors,
  };
}
