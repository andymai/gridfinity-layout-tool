import type { GridUnits, HeightUnits } from '@/core/types';

export interface BinSize {
  width: GridUnits;
  depth: GridUnits;
  height: HeightUnits;
}

export interface RecoSource {
  /** Where the recommendation came from in the resolution cascade. */
  source: 'label' | 'embed' | 'drawer';
}

export interface BinSizePrediction extends RecoSource {
  size: BinSize;
  /** Probability under Laplace smoothing within the chosen source. */
  p: number;
  /** Raw sample count backing this prediction. */
  n: number;
}

interface ModelSizeEntry {
  size: string;
  p: number;
  n: number;
}

export interface BinRecommenderModel {
  schemaVersion: number;
  vocabVersion: string;
  source: 'label_hash_high' | 'label_hash';
  trainedAt: string;
  sampleCount: number;
  byLabelHash: Record<string, ModelSizeEntry[]>;
  byEmbedBucket: Record<string, ModelSizeEntry[]>;
  byDrawer: Record<string, ModelSizeEntry[]>;
}
