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
  '1683be0c51d49f0b79582e0a24f96768',
  '216fa5337ad5cce7af1afe58e19a073c',
  '2f6f4e2e866e48e956c6bc7ab4cefb36',
  '7efb91a03ef12bde6ccafa4ac66cb7a8',
  '85dce6b57d865c15df94666e796e4a74',
  '8c5fb2e5cf6bb5e60b7d11812758a252',
  '92647368e2a80820a30d513d6f1ab8e3',
  '9681dfc923e20308d78468efdfa2c8e6',
  'ac25de9a9a4a13e9123d2ce275f4d997',
  'b5859d9f1a655e86f097f560ccc32298',
  'c93011cf9a3a893096deef922075628e',
  'd0e9a93e732ca9d2694d17048e76c233',
]);
