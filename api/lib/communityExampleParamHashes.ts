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
  '28078685735286672676175ff4a1d972',
  '31800f576832364961c74d0ae7674f3f',
  '566efbeba99424e854b2c86a4137a5c4',
  '69d5edc3d90ffa8a7440f186f8ba9af4',
  '756165821de1c9cb9d2a904c25092ad5',
  '91837f13f2921ff9d28f3a1deb805d6b',
  'a74a252625bd6c3ecd05309c82b9d585',
  'a846759f7ab6d4a2d1c0bea157d3e524',
  'b97c6a1e436e08d000a4ff9ad77d6543',
  'eece5ec5370898d14f48217341bf60da',
  'ef44561f426b83a15a59bda4d9bc6dca',
]);
