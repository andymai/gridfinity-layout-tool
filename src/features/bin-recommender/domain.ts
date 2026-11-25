import { gridUnits, heightUnits } from '@/core/types';
import model from './model.json';
import { recommendBinSize } from './recommender';
import type { BinRecommenderModel, BinSizePrediction } from './types';

/**
 * The React-free entry of this feature for the agent tools, which run in a
 * Vercel function. It holds the 605 KB model, so it is for the server: the
 * app loads the model on demand through loadModel.ts, and the boundary rules
 * keep other features from importing this file.
 */
const NO_DRAWER = { width: gridUnits(0), depth: gridUnits(0), height: heightUnits(0) };

/**
 * The size that makers most often gave bins with this label, or a similar
 * one. The drawer prior is left out, as the app hides it too: it says
 * nothing about what the bin holds.
 */
export function suggestBinSize(label: string): BinSizePrediction | null {
  const prediction = recommendBinSize({
    label,
    drawer: NO_DRAWER,
    model: model as BinRecommenderModel,
  });
  return prediction?.source === 'drawer' ? null : prediction;
}
