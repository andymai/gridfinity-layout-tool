/**
 * Drift guard for the committed built-in-example fingerprint set.
 *
 * `api/lib/communityExampleParamHashes.ts` is a generated constant (api/ cannot
 * import the example gallery from src/). This test recomputes the set from the
 * live `EXAMPLE_DESIGNS`, through the same sanitizer + fingerprint the publish
 * path uses, and fails if the committed set drifts. On failure, copy the
 * reported hashes into the generated file. Runs in the node `unit` project,
 * which imports both src and api.
 */
import { describe, expect, it } from 'vitest';

import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import { validateDesignerShare } from '../../../api/lib/designerValidation.js';
import { communityParamsFingerprint } from '../../../api/lib/communityStore.js';
import { COMMUNITY_EXAMPLE_PARAM_HASHES } from '../../../api/lib/communityExampleParamHashes.js';

function recomputeExampleHashes(): string[] {
  const hashes = new Set<string>();
  for (const example of EXAMPLE_DESIGNS) {
    const payload = { type: 'designer' as const, version: 1 as const, params: example.params };
    const sizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    const result = validateDesignerShare(payload, sizeBytes);
    // An example that the sanitizer rejects can never be published verbatim
    // either, so it is not a possible duplicate and is skipped.
    if (!result.valid) continue;
    hashes.add(communityParamsFingerprint(result.payload.params));
  }
  return [...hashes].sort();
}

describe('communityExampleParamHashes drift', () => {
  it('matches the fingerprints recomputed from EXAMPLE_DESIGNS', () => {
    const recomputed = recomputeExampleHashes();
    expect([...COMMUNITY_EXAMPLE_PARAM_HASHES].sort()).toEqual(recomputed);
  });

  it('covers every built-in example (none silently dropped by the sanitizer)', () => {
    expect(COMMUNITY_EXAMPLE_PARAM_HASHES.size).toBe(EXAMPLE_DESIGNS.length);
  });
});
