import { processLabel, VOCAB_VERSION } from '@/shared/analytics/labelVocabulary';
import { gridUnits, heightUnits } from '@/core/types';
import type { BinRecommenderModel, BinSize, BinSizePrediction } from './types';

const MIN_SAMPLES_FOR_LABEL = 10;
const MIN_SAMPLES_FOR_BUCKET = 20;
const MIN_SAMPLES_FOR_DRAWER = 50;
const SUPPORTED_SCHEMA_VERSION = 1;
const SIZE_PATTERN = /^(\d+)x(\d+)x(\d+)$/;

const warnedVersionPairs = new Set<string>();

export interface DrawerDims {
  width: number;
  depth: number;
  height: number;
}

/**
 * Predict a bin size for a given label. Returns `null` when no source in the
 * cascade has enough support — the caller should show nothing rather than a
 * low-confidence ghost.
 *
 * Resolution order mirrors the telemetry's PRIMARY → ENRICHMENT → FALLBACK
 * tiering:
 *   1. byLabelHash[hash]      — exact label match (handles any language)
 *   2. byEmbedBucket[bucket]  — semantic-bucket fallback for OOV labels
 *   3. byDrawer["WxDxH"]      — drawer-size prior when nothing else hits
 */
export function recommendBinSize(args: {
  label: string;
  drawer: DrawerDims;
  model: BinRecommenderModel;
}): BinSizePrediction | null {
  const { label, drawer, model } = args;

  if (model.schemaVersion !== SUPPORTED_SCHEMA_VERSION) return null;
  if (model.vocabVersion !== VOCAB_VERSION) {
    const pairKey = `${model.vocabVersion}->${VOCAB_VERSION}`;
    if (!warnedVersionPairs.has(pairKey)) {
      warnedVersionPairs.add(pairKey);
      console.warn(
        `[bin-recommender] vocab mismatch: model=${model.vocabVersion} runtime=${VOCAB_VERSION}; suppressing predictions until retrain`
      );
    }
    return null;
  }

  const trimmed = label.trim();
  if (trimmed) {
    const { hash, embedding_bucket } = processLabel(trimmed);

    const labelHit = pickTop(model.byLabelHash[hash], MIN_SAMPLES_FOR_LABEL);
    if (labelHit) return { ...labelHit, source: 'label' };

    if (embedding_bucket) {
      const embedHit = pickTop(model.byEmbedBucket[embedding_bucket], MIN_SAMPLES_FOR_BUCKET);
      if (embedHit) return { ...embedHit, source: 'embed' };
    }
  }

  const drawerKey = `${drawer.width}x${drawer.depth}x${drawer.height}`;
  const drawerHit = pickTop(model.byDrawer[drawerKey], MIN_SAMPLES_FOR_DRAWER);
  if (drawerHit) return { ...drawerHit, source: 'drawer' };

  return null;
}

function pickTop(
  entries: Array<{ size: string; p: number; n: number }> | undefined,
  minSamples: number
): { size: BinSize; p: number; n: number } | null {
  if (!entries || entries.length === 0) return null;
  const top = entries[0];
  if (top.n < minSamples) return null;
  const size = parseSize(top.size);
  if (!size) return null;
  return { size, p: top.p, n: top.n };
}

function parseSize(raw: string): BinSize | null {
  const match = raw.match(SIZE_PATTERN);
  if (!match) return null;
  const w = Number(match[1]);
  const d = Number(match[2]);
  const h = Number(match[3]);
  if (!w || !d || !h) return null;
  return { width: gridUnits(w), depth: gridUnits(d), height: heightUnits(h) };
}
