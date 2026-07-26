/**
 * Trained label-suggester model: a privacy-preserving, hash-keyed prior learned
 * from aggregate telemetry (see scripts/train-label-suggester/). It never stores
 * raw label text — only one-way `simpleHash` values — so the client can only look
 * up hashes it can compute itself (candidate text + the current bin's neighbors).
 *
 * Regenerate with:
 *   uv run scripts/train-label-suggester/train.py --redis-url "$REDIS_URL" \
 *     --out src/features/bin-inspector/labelSuggest/labelSuggester.model.json
 */
export interface LabelSuggesterModel {
  schemaVersion: number;
  vocabVersion: string;
  trainedAt: string;
  sampleCount: number;
  /** Full pre-trim keyspace sizes — training metadata (growth-gate baseline). */
  labelKeyCount?: number;
  cooccurKeyCount?: number;
  /** label hash → global popularity (0..1). */
  popularity: Record<string, number>;
  /** label hash → { co-occurring neighbor hash → P(this | neighbor), 0..1 }. */
  cooccur: Record<string, Record<string, number>>;
}

export const MODEL_SCHEMA_VERSION = 1;

/** Inert default: contributes nothing until a trained model is committed. */
export const EMPTY_MODEL: LabelSuggesterModel = {
  schemaVersion: MODEL_SCHEMA_VERSION,
  vocabVersion: 'v1',
  trainedAt: '1970-01-01T00:00:00Z',
  sampleCount: 0,
  popularity: {},
  cooccur: {},
};

// Deliberately gentle: the model is a prior that nudges ranking, it must not
// override strong literal text signals. Tune against real telemetry.
const W_POPULARITY = 0.2;
const W_COOCCUR = 0.5;

/** Whether a model carries usable training data at the expected schema. */
export function isModelUsable(
  model: LabelSuggesterModel | null | undefined
): model is LabelSuggesterModel {
  return !!model && model.schemaVersion === MODEL_SCHEMA_VERSION && model.sampleCount > 0;
}

/**
 * Learned score for a candidate given the current bin's neighbor labels: a
 * global popularity prior plus co-occurrence with the neighbors. Hashes are the
 * candidate's and neighbors' `processLabel().hash` values.
 */
export function modelScore(
  model: LabelSuggesterModel,
  candidateHash: string,
  neighborHashes: readonly string[]
): number {
  // `Object.hasOwn` guards (not `??`/`?.`): the maps are typed with non-optional
  // index signatures, so a missing key is undefined at runtime but `number` to
  // the type system — the presence checks keep it safe without a dead condition.
  const popularity = Object.hasOwn(model.popularity, candidateHash)
    ? model.popularity[candidateHash]
    : 0;
  let cooccur = 0;
  for (const hash of neighborHashes) {
    if (!Object.hasOwn(model.cooccur, hash)) continue;
    const row = model.cooccur[hash];
    if (Object.hasOwn(row, candidateHash)) cooccur += row[candidateHash];
  }
  return popularity * W_POPULARITY + Math.min(cooccur, 1) * W_COOCCUR;
}
