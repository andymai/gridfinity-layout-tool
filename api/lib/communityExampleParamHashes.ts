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
  '04308a0c6e05bf847cfd4d2e64d5e005',
  '0a40ce08205f857f392b089d90220824',
  '1aaaa78536762bc12ce70a5ad9e8f940',
  '2b4812ce4f7bac49fd85327063a721e4',
  '375da2d076519af4fce2fdd9ff05d457',
  '63620b6ac10eb331db4f6538404e5a17',
  '7e3fb1cf74b52b80e507565affbcedfb',
  'b9104ed037b8b0edb2e8b3dc6a7c919c',
  'de0eceaa3d1f21ed8728c43d61bd2d7f',
  'f57c1b5decb6128ccea2f3e65d611ced',
  'f8668e5e0d7593a6d78fb6675f5871a3',
]);
