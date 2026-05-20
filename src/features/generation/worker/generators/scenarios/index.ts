/**
 * Aggregated scenario definitions for bin generation tests.
 *
 * Each category file exports an array of ScenarioCase objects. The
 * historical categories below preserve their original definition order;
 * new categories are appended to the end of `ALL_SCENARIOS`.
 */
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

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
import { handles } from './handles';
import { honeycombJunction } from './honeycombJunction';
import { customShapes } from './customShape';
import { permutationMatrix } from './permutationMatrix';
import { regressions } from './regressions';
import { solidCutoutMatrix } from './solidCutoutMatrix';

export type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

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
  ...handles,
  ...honeycombJunction,
  ...customShapes,
  ...permutationMatrix,
  ...regressions,
  ...solidCutoutMatrix,
];
