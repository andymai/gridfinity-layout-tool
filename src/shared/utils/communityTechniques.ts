/**
 * Derive `ExampleTechnique` tags from `BinParams`: auto-tags
 * community-published designs (curated bin-designer examples stay
 * hand-authored; see `src/features/bin-designer/types/exampleGallery.ts`).
 *
 * MIRROR: `deriveCommunityTechniques` in `api/lib/communityValidation.ts`
 * duplicates this logic (api/ cannot import from src/) over
 * sanitized-but-untyped params, after `validateDesignerShare`. Update both
 * sides together, in the same predicate order; the cross-boundary equality
 * test in `communityTechniques.crossBoundary.test.ts` guards against drift.
 *
 * Every predicate is the exact gate the generation pipeline checks before
 * building the feature. Two traps: `walls`/`handles` per-side sub-objects ship
 * `enabled: true` in the defaults, so only the master `enabled` flag is
 * authoritative; and `slotConfig` is populated even on standard bins, so
 * `slotted` keys off `style` alone, never `slotConfig`.
 */
import { isPartialMask } from '@/shared/utils/cellMask';
import type { BinParams } from '@/shared/types/bin';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';

function getCompartmentCount(compartments: BinParams['compartments']): number {
  return new Set(compartments.cells).size;
}

export function deriveTechniques(params: BinParams): ExampleTechnique[] {
  const techniques: ExampleTechnique[] = [];
  if (getCompartmentCount(params.compartments) > 1) techniques.push('compartments');
  if (params.walls.enabled) techniques.push('wallCutouts');
  if (params.scoop.enabled) techniques.push('scoop');
  if (params.label.enabled) techniques.push('labelTab');
  if (params.style === 'slotted') techniques.push('slotted');
  if (params.lid.enabled) techniques.push('lid');
  if (params.handles.enabled) techniques.push('handles');
  if (isPartialMask(params.cellMask)) techniques.push('customShape');
  if (params.wallPattern.enabled) techniques.push('wallPattern');
  return techniques;
}
