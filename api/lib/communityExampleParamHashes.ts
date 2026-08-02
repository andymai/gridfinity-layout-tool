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
  '1586c532e67d27e15457027903459522',
  '1873bc918d6d0c3b6aa00003771bddcd',
  '1d2106d9f0b74fccf1597fcaa772acad',
  '20d09d9dba28f257f8c87a24c7db1957',
  '2e0b0b83f571663233ad2635507dc405',
  '8166e40ab1a21e74c799d5829619abf0',
  '8aa27b0d2f5a3bcab5a24ccd0e1b3425',
  'b54a495e491c412a540e39c95870b92c',
  'b75f8919a120bdcce50c213938b0fd23',
  'c99174bdf28694d8635d45f4de8b5363',
  'd0b7a3cb6c92e8ae4e81b23c11b466be',
]);
