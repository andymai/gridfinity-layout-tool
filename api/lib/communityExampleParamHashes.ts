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
  '01cf7c32873072d9d1c7441b904a1974',
  '26813b30744ba1314d8964851726968c',
  '2d41437b5a47af6eade5488b59a7b1c3',
  '39ed62d6238459a928cc73e03648509a',
  '3c6c5f3fefe5e9d63984eb82f1fd21fd',
  '860d2998b89859b0b384196a174830a9',
  '912981088c6b9be528d29d0432a54a77',
  'b1c20331183614aefae7dd264cbf5660',
  'b503cc054635b3da0a342471046326e4',
  'd2b2f74797be17800fce8229ef505f56',
  'e334b4e7de65c54f0bf58fa868c11c06',
]);
