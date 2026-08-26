import type { BinRecommenderModel } from './types';

// `?url` keeps Vite resolving and content-hashing the file at build time — a
// rename is a build error rather than a production 404 — while keeping the
// ~270 kB payload out of the JS module graph entirely. Fetched on demand and
// runtime-cached by the service worker.
import modelUrl from './model.json?url';
import { isRecord } from '@/shared/utils/isRecord';

let modelPromise: Promise<BinRecommenderModel> | null = null;

/** Arrays are objects, and an array would silently miss every key lookup. */

// Structural only: `recommendBinSize` already rejects an unsupported
// schemaVersion, so duplicating that check here would fork the supported range.
function isBinRecommenderModel(value: unknown): value is BinRecommenderModel {
  if (!isRecord(value)) return false;
  return (
    typeof value.schemaVersion === 'number' &&
    isRecord(value.byLabelHash) &&
    isRecord(value.byEmbedBucket) &&
    isRecord(value.byDrawer)
  );
}

/**
 * Lazily fetch the committed model, shared across mounts. Rejections are not
 * cached — a transient failure would otherwise disable suggestions for the rest
 * of the session.
 */
export function loadBinRecommenderModel(): Promise<BinRecommenderModel> {
  if (!modelPromise) {
    modelPromise = fetch(modelUrl)
      .then((res): Promise<unknown> => {
        if (!res.ok) throw new Error(`model fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data): BinRecommenderModel => {
        if (!isBinRecommenderModel(data)) throw new Error('model payload malformed');
        return data;
      })
      .catch((err: unknown) => {
        modelPromise = null;
        throw err;
      });
  }
  return modelPromise;
}
