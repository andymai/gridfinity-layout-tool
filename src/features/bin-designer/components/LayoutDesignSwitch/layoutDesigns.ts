import { STAGING_ID } from '@/core/constants';
import type { Bin, BinId, Category, DesignId } from '@/core/types';
import type { CustomBinRef } from '../../store/customBinRegistry';

export interface LayoutDesign {
  readonly design: CustomBinRef;
  /** The placement the designer opens it from. */
  readonly binId: BinId;
  readonly color: string | undefined;
}

/**
 * The saved designs the layout's bins are linked to, one entry per design.
 *
 * A design placed several times opens from a bin on the grid before a
 * stashed one, since only a grid placement has an overhang to show. A link
 * whose design is gone from the registry is dropped: there is nothing to open.
 */
export function layoutDesigns(
  bins: readonly Bin[],
  categories: readonly Category[],
  registry: readonly CustomBinRef[]
): LayoutDesign[] {
  const designsById = new Map(registry.map((design) => [design.id, design]));
  const placements = new Map<DesignId, Bin>();
  for (const bin of bins) {
    if (!bin.linkedDesignId || !designsById.has(bin.linkedDesignId)) continue;
    const chosen = placements.get(bin.linkedDesignId);
    if (!chosen || (chosen.layerId === STAGING_ID && bin.layerId !== STAGING_ID)) {
      placements.set(bin.linkedDesignId, bin);
    }
  }

  const colors = new Map(categories.map((category) => [category.id, category.color]));
  const entries: LayoutDesign[] = [];
  for (const [id, bin] of placements) {
    const design = designsById.get(id);
    if (design) entries.push({ design, binId: bin.id, color: colors.get(bin.category) });
  }
  return entries.sort((a, b) =>
    a.design.name.localeCompare(b.design.name, undefined, { numeric: true })
  );
}
