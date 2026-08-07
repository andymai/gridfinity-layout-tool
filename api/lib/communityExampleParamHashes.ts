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
  '076a75bf64aa7169da60eb39fe025def',
  '1c2959aa16ddb948755fa0ada156fb38',
  '25a17b48879500000ffbb2b831f155f2',
  '32b81fd81272d45f03bdae7ab493bdb7',
  '377fd35c7f129ba99970534b3545a18b',
  '3ccc8ef3bbe8c7a079ae53505a7be94e',
  '3f25d10525c5cb7f12bd8534d6b82b97',
  '4bd0d00a6de5f30a5e4d7efba09e34c4',
  '8c202c7af46d89b9edbad5982ed7adc6',
  'b45ab088f8cba120601b20349a2dc55d',
  'c3d63ec153761b588629af18db8930b9',
]);
