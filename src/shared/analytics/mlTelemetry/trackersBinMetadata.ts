/**
 * Bin metadata trackers — label updates and category changes. Both feed the
 * label-vocabulary models that drive purpose inference and size suggestions.
 */

import type { Bin } from '@/core/types';
import type { LabelUpdateEvent, CategoryChangeEvent } from './types';
import { bufferEvent } from './eventBuffer';
import { isDefaultCategoryName, hashCategoryName } from './computations';
import { processLabel, VOCAB_VERSION } from '../labelVocabulary';
import { isEnabled } from './trackersHelpers';

/** Track a label update event. */
export function trackLabelUpdate(
  bin: Bin,
  oldLabel: string | undefined | null,
  newLabel: string | undefined | null
): void {
  if (!isEnabled()) return;

  const oldTrimmed = oldLabel?.trim() || '';
  const newTrimmed = newLabel?.trim() || '';
  if (oldTrimmed === newTrimmed) return;

  let oldLabelHash: string | null = null;
  let oldLabelNormalized: string | null = null;
  if (oldTrimmed) {
    const oldData = processLabel(oldTrimmed);
    oldLabelHash = oldData.hash;
    oldLabelNormalized = oldData.normalized;
  }

  let newLabelHash: string | null = null;
  let newLabelNormalized: string | null = null;
  let newLabelDomain: string | null = null;
  let newLabelEmbeddingBucket: string | null = null;
  if (newTrimmed) {
    const newData = processLabel(newTrimmed);
    newLabelHash = newData.hash;
    newLabelNormalized = newData.normalized;
    newLabelDomain = newData.domain;
    newLabelEmbeddingBucket = newData.embedding_bucket;
  }

  const event: LabelUpdateEvent = {
    type: 'label_updated',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    old_label_hash: oldLabelHash,
    old_label_normalized: oldLabelNormalized,
    new_label_hash: newLabelHash,
    new_label_normalized: newLabelNormalized,
    new_label_domain: newLabelDomain,
    new_label_embedding_bucket: newLabelEmbeddingBucket,
    vocab_version: VOCAB_VERSION,
  };

  bufferEvent(event);
}

/** Track a category change event. */
export function trackCategoryChange(bin: Bin, categoryName: string, batchSize: number = 1): void {
  if (!isEnabled()) return;

  if (isDefaultCategoryName(categoryName)) return;

  let labelHash: string | null = null;
  let labelDomain: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelHash = labelData.hash;
    labelDomain = labelData.domain;
  }

  const event: CategoryChangeEvent = {
    type: 'category_changed',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    category_name_hash: hashCategoryName(categoryName),
    batch_size: batchSize,
    label_hash: labelHash,
    label_domain: labelDomain,
    vocab_version: VOCAB_VERSION,
  };

  bufferEvent(event);
}
