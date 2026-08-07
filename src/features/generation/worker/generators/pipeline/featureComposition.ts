/**
 * Composition root for bin feature builders.
 *
 * Explicit, typed array wiring all feature builders into the pipeline.
 * Adding a new feature: create the builder, import here, add to array.
 *
 * Pattern: Composition Root (not registry). Two lines per feature.
 *
 * NOTE: Wall patterns are NOT included — handled as a special case
 * in featuresStage due to per-wall caching and cutout clipping.
 */

import type { FeatureBuilder } from './featureBuilder';
import { compartmentWallsFeature } from '../compartmentBuilder';
import { insertCutsFeature } from '../insertBuilder';
import { slotCutsFeature } from '../slotBuilder';
import { labelTabsFeature } from '../labelTabBuilder';
import { handlesFeature } from '../handleBuilder';
import { scoopRampsFeature } from '../scoopRampBuilder';
import { wallCutoutsFeature } from '../wallCutoutBuilder';
import { slideRailsFeature } from '../slideRailBuilder';
import { dividerBlendFeature } from '../dividerBlendBuilder';
import { wallTextCutFeature, wallTextEmbossFeature } from '../wallTextBuilder';

export const BIN_FEATURE_BUILDERS: readonly FeatureBuilder[] = [
  compartmentWallsFeature,
  insertCutsFeature,
  slotCutsFeature,
  labelTabsFeature,
  handlesFeature,
  scoopRampsFeature,
  wallCutoutsFeature,
  slideRailsFeature,
  dividerBlendFeature,
  wallTextCutFeature,
  wallTextEmbossFeature,
] as const;
