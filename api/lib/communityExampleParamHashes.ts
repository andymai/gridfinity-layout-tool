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
  '1c033b512773affcd0ae4a17ab296e62',
  '1c5606f2bea0eb795c984c8211ad0c4e',
  '39a07497d7d54f5bd90578282acd82e2',
  '53028c2bc8753de1b0c05a90f3fe0e48',
  '845316589e5c99d2e6a9bb23535c292f',
  'a57371e89ffc0fca241a866aad748361',
  'a7e8da3b841e4a8ce32c588523246b8f',
  'c38f33cce55539075ade956476316463',
  'eb5ee1d5351138292f3f6bd9506c6136',
  'eb8c404dd28d549846320dac2b1eb616',
  'f881bef5b52dd484887ac1cf47f57ed2',
]);
