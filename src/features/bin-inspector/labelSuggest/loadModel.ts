import { EMPTY_MODEL, MODEL_SCHEMA_VERSION, type LabelSuggesterModel } from './model';

// `?url` keeps Vite resolving and content-hashing the file at build time — a
// rename is a build error rather than a production 404 — while keeping the
// ~250 kB payload out of the JS module graph entirely. Fetched on demand and
// runtime-cached by the service worker.
import modelUrl from './labelSuggester.model.json?url';

let modelPromise: Promise<LabelSuggesterModel> | null = null;

/** Shallow shape check — the payload is a build asset we emit, not user input. */
function isLabelSuggesterModel(value: unknown): value is LabelSuggesterModel {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    m.schemaVersion === MODEL_SCHEMA_VERSION &&
    typeof m.popularity === 'object' &&
    m.popularity !== null &&
    typeof m.cooccur === 'object' &&
    m.cooccur !== null
  );
}

/**
 * Lazily fetch the committed model. Cached after the first call; a transient
 * failure clears the cache so it can retry, and always resolves — falling back
 * to the inert EMPTY_MODEL.
 */
export function loadLabelSuggesterModel(): Promise<LabelSuggesterModel> {
  if (!modelPromise) {
    modelPromise = fetch(modelUrl)
      .then((res): Promise<unknown> => {
        if (!res.ok) throw new Error(`model fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data): LabelSuggesterModel => {
        if (!isLabelSuggesterModel(data)) throw new Error('model payload malformed');
        return data;
      })
      .catch(() => {
        modelPromise = null;
        return EMPTY_MODEL;
      });
  }
  return modelPromise;
}
