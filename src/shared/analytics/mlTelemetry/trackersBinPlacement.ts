/**
 * Bin placement trackers — single placement and bulk (fill) placement.
 *
 * `trackBinPlacement` is sampled when the session is high-volume and the bin
 * is unlabeled, to keep the buffer bounded for power users. The full event
 * captures gap analysis, label hashing, adjacency context, and recent-size
 * history needed by the size-prediction models downstream.
 */

import type { Layout, Bin } from '@/core/types';
import type { BinPlacementEvent, PlacementMethod } from './types';
import { bufferEvent, SAMPLING_THRESHOLD, SAMPLING_RATE } from './eventBuffer';
import { sessionState, layoutSession } from './sessionState';
import { processLabel, VOCAB_VERSION } from '../labelVocabulary';
import { analyzeGaps } from '../gapAnalysis';
import { isEnabled, getAdjacentBinContext } from './trackersHelpers';

/** Track a bin placement event. */
export function trackBinPlacement(bin: Bin, layout: Layout, method: PlacementMethod): void {
  if (!isEnabled()) return;

  // Apply sampling for high-volume sessions
  const shouldSample =
    sessionState.sessionIndex >= SAMPLING_THRESHOLD &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
    !bin.label?.trim() &&
    Math.random() > SAMPLING_RATE;

  if (shouldSample) {
    const binSize = `${bin.width}x${bin.depth}x${bin.height}`;
    sessionState.prevBinSize = binSize;
    sessionState.sessionIndex++;
    if (sessionState.sizeSequence.length < 100) {
      sessionState.sizeSequence.push(binSize);
    }
    if (sessionState.firstBinTime === null) {
      sessionState.firstBinTime = Date.now();
    }
    layoutSession.lastEditTime = Date.now();
    return;
  }

  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  const gapAnalysis = analyzeGaps(layout, bin.layerId, {
    width: bin.width,
    depth: bin.depth,
  });

  let labelHash: string | null = null;
  let labelNormalized: string | null = null;
  let labelDomain: string | null = null;
  let labelEmbeddingBucket: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelHash = labelData.hash;
    labelNormalized = labelData.normalized;
    labelDomain = labelData.domain;
    labelEmbeddingBucket = labelData.embedding_bucket;
  }

  const adjacentContext = getAdjacentBinContext(bin, layout);

  const now = Date.now();
  const lastPlacement = layoutSession.recentPlacements[layoutSession.recentPlacements.length - 1];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- recentPlacements can be empty at runtime
  const timeSinceLastMs = lastPlacement ? now - lastPlacement.timestamp : null;

  const isFirstOfLabel =
    labelHash !== null && !layoutSession.recentPlacements.some((p) => p.labelHash === labelHash);

  const recentSizes = layoutSession.recentPlacements.slice(-3).map((p) => p.size);

  const binSize = `${bin.width}x${bin.depth}x${bin.height}`;

  const event: BinPlacementEvent = {
    type: 'bin_placed',
    bin_size: binSize,
    prev_bin_size: sessionState.prevBinSize,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    position: `${bin.x},${bin.y}`,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    largest_gap: gapAnalysis.largestGap,
    fill_pct: gapAnalysis.fillPct,
    gap_fit: gapAnalysis.gapFit,
    label_hash: labelHash,
    label_normalized: labelNormalized,
    label_domain: labelDomain,
    label_embedding_bucket: labelEmbeddingBucket,
    category_id: bin.category,
    adjacent_label_hashes: adjacentContext.labelHashes,
    adjacent_sizes: adjacentContext.sizes,
    adjacent_count: adjacentContext.count,
    recent_sizes: recentSizes,
    time_since_last_ms: timeSinceLastMs,
    is_first_of_label: isFirstOfLabel,
    method,
    session_index: sessionState.sessionIndex,
    vocab_version: VOCAB_VERSION,
  };

  sessionState.prevBinSize = binSize;
  sessionState.sessionIndex++;

  if (sessionState.sizeSequence.length < 100) {
    sessionState.sizeSequence.push(binSize);
  }

  if (sessionState.firstBinTime === null) {
    sessionState.firstBinTime = Date.now();
  }

  layoutSession.recentPlacements.push({
    size: binSize,
    labelHash,
    position: `${bin.x},${bin.y}`,
    timestamp: now,
  });
  if (layoutSession.recentPlacements.length > 5) {
    layoutSession.recentPlacements.shift();
  }

  layoutSession.lastEditTime = Date.now();

  bufferEvent(event);
}

/** Track multiple bins placed at once (e.g., from fill operation). */
export function trackBulkPlacement(bins: Bin[], layout: Layout, method: PlacementMethod): void {
  if (!isEnabled()) return;
  if (bins.length === 0) return;

  const sampleSize = Math.min(bins.length, 5);
  const stride = Math.max(1, Math.floor(bins.length / sampleSize));
  const sampledBins = bins.filter((_, i) => i % stride === 0).slice(0, sampleSize);

  for (const bin of sampledBins) {
    trackBinPlacement(bin, layout, method);
  }
}
