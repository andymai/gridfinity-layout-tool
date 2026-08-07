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
  '08590ec503147dcacc26bd0492b24f16',
  '2e90e899614b164af7c494e1cddc9f49',
  '3f7a898e23be63c1d0d048a1e251fa7d',
  '46f30240f7f607d450ca67ad6e555551',
  '641373df514c3b55ad93eb1aa972f9c3',
  '79df1308b334f8756f0fbdd9e4e2e9bb',
  '90260814e555ad7d3aacf6b618be1ff6',
  '9410bb06c213d7636a038ea2ed2b9e31',
  '96f1dab8346b45c013291e9c2e59ba4a',
  'c34becdbe4e1d7073f7da681c5faf6e0',
  'd6f67069955bdd2755ac02b17c9a9cc1',
]);
