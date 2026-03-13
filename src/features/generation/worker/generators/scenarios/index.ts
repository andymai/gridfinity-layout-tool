/**
 * Aggregated scenario definitions for bin generation tests.
 *
 * Each category file exports an array of ScenarioCase objects.
 * This index re-exports them as a single ordered array matching the
 * original `binGenerator.scenarios.ts` order exactly.
 */
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

import { dimensions } from './dimensions';
import { baseStyles } from './baseStyles';
import { binStyles } from './binStyles';
import { heightVariations } from './heights';
import { wallThickness } from './wallThickness';
import { compartments } from './compartments';
import { scoop, scoopLipInteraction } from './scoops';
import { labelTabs } from './labelTabs';
import { inserts, multipleInserts } from './inserts';
import { solidCutouts } from './solidCutouts';
import { halfSockets } from './halfSockets';
import { slottedVariations } from './slotted';
import { exportMode, largeBin, asymmetric } from './exportAndLarge';
import { combinedFeatures } from './combinedFeatures';
import { integration } from './integration';
import { edgeCases } from './edgeCases';
import { solidMode } from './solidMode';
import { wallCutouts } from './wallCutouts';
import { cutoutOffset } from './cutoutOffset';
import { groupedScoop } from './groupedScoop';
import { lipWall } from './lipWall';

export type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const ALL_SCENARIOS: readonly ScenarioCase[] = [
  ...dimensions,
  ...baseStyles,
  ...binStyles,
  ...heightVariations,
  ...wallThickness,
  ...compartments,
  ...scoop,
  ...scoopLipInteraction,
  ...labelTabs,
  ...inserts,
  ...multipleInserts,
  ...solidCutouts,
  ...halfSockets,
  ...slottedVariations,
  ...exportMode,
  ...largeBin,
  ...asymmetric,
  ...combinedFeatures,
  ...integration,
  ...edgeCases,
  ...solidMode,
  ...wallCutouts,
  ...cutoutOffset,
  ...groupedScoop,
  ...lipWall,
];
