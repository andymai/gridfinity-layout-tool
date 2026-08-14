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
  '0a0fa497c469dc0e7f63f25fc80a343e',
  '23c6f60c459567e863d53c729762897c',
  '48c710e85f3cfa1a918c77746b3096cf',
  '5131201b62649b29e599f7dcdc670f55',
  '907f2ec62157e1cd8171eedbcd116d63',
  '92ec0ea12a2ccc3db234680a04fe55b4',
  '9ac091d931667319afd5677f8ffe25b6',
  'acc2d4a9b4e34c018656b3203563c996',
  'b19a42e27bf1a39fc8bc8231c94316a8',
  'e058903aa86262e981f5c6902d1e7ba9',
  'e150a587fc1249fb72c8fb7a43a4b8dd',
]);
