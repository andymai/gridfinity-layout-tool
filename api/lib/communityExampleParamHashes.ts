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
  '0bfb453f4ce70d438c9ef8969c9652c8',
  '0d9afca1b8f2595d8e4349d355e14cfc',
  '1be15a6b96549df3e223e9df9f94bc91',
  '2dcbfed572c9549049b629abb663a7fa',
  '361d9ba3c16030a30617ba8707142bc7',
  '4120e6735d3604f7f482219698f96755',
  '4d9740e13d79c3bd87ce6bb81efc284f',
  '8420f1dddb699e159865ce5304b86cb9',
  '898c829bbb5e2e99ed94071d0ead9f76',
  '901971f6237bf5f3d0724fc7aea128c2',
  '96a67af831671e6d0dcf7bc0a46941c0',
  '9d1b512d62aa5fa86030908435b8178a',
]);
