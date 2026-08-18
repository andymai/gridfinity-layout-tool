/**
 * Params-only fingerprints (`communityParamsFingerprint`) of every built-in
 * bin-designer example, computed over the sanitized params
 * (`validateDesignerShare`). The exact-duplicate guard rejects a publish whose
 * sanitized params match one of these, so a user cannot re-upload a shipped
 * example as their own community design.
 *
 * GENERATED VALUES: api/ cannot import from src/, so these hashes are committed
 * rather than derived at runtime. The drift test
 * `src/shared/utils/communityExampleParamHashes.drift.test.ts` recomputes them
 * from `EXAMPLE_DESIGNS` and fails if this set is stale; regenerate by copying
 * the values it reports.
 */
export const COMMUNITY_EXAMPLE_PARAM_HASHES: ReadonlySet<string> = new Set<string>([
  '072b2c88ae7ddfefc3fe81f992955e5d',
  '224e19e6861595d8642e5b09345e4486',
  '410f1aee308f30a3968ecdd894815743',
  '4845753dd46c316c7ee27b933619da07',
  '53167645662e9a28da88eab2c202fa50',
  '5b808e566f690d0b5ce3c9386d8541cc',
  '7306898a193f541d3f25ee8dc8aac7c3',
  '8f25848a944e9231bdc96ff646cf2130',
  'a8ec82d3c88424d0daba151a380cff2c',
  'df2ce151112d8aecab91ff33be7ba5b4',
  'f8ab6dac7d929fa4b5782e1784c22f94',
  'fca2409a05549e54c4ec16cad973f573',
]);
