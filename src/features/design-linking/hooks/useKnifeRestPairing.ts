/**
 * Keeps knife-block pairs whole: every layout bin linked to a design whose
 * registry entry carries a companion handle rest gets a paired `rest` bin
 * beside it, and a rest bin whose design lost its companion is removed.
 *
 * A reconciler rather than per-flow wiring, so URL placement, manual linking,
 * community imports and design re-saves all converge on the same invariant.
 * Creation runs once per (bin, design) per session: if the user undoes the
 * auto-placement or deletes the rest alone, we respect that rather than
 * fighting the undo stack.
 */

import { useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { batch } from '@/core/cqrs';
import { isOk } from '@/core/result';
import { STAGING_ID } from '@/core/constants';
import { gridUnits, heightUnits, type Bin, type GridUnits } from '@/core/types';
import { pairPartner } from '@/shared/utils/binPairs';
import { useCustomBins, type CustomBinRef } from '@/features/bin-designer';
import { generateUUID } from '@/shared/utils/uuid';

type RestMeta = NonNullable<CustomBinRef['knifeRest']>;

/** Rest footprint in layout grid units, oriented for its side. */
function restFootprint(meta: RestMeta): { w: number; d: number } {
  return meta.side === 'left' || meta.side === 'right'
    ? { w: meta.alongU, d: meta.crossU }
    : { w: meta.crossU, d: meta.alongU };
}

/** Preferred rest position beside the block, gap included (may be off-grid). */
function restPosition(
  block: Bin,
  meta: RestMeta,
  gapU: number,
  rest: { w: number; d: number }
): { x: number; y: number } {
  switch (meta.side) {
    case 'right':
      return { x: block.x + block.width + gapU, y: block.y };
    case 'left':
      return { x: block.x - gapU - rest.w, y: block.y };
    case 'back':
      return { x: block.x, y: block.y + block.depth + gapU };
    case 'front':
      return { x: block.x, y: block.y - gapU - rest.d };
  }
}

export function useKnifeRestPairing(): void {
  const registry = useCustomBins();
  const bins = useLayoutStore((state) => state.layout.bins);
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    const { layout, addBin, updateBin, deleteBin } = useLayoutStore.getState();
    const byDesign = new Map(registry.map((ref) => [ref.id, ref]));

    for (const bin of layout.bins) {
      if (bin.linkedDesignId === undefined) continue;
      const meta = byDesign.get(bin.linkedDesignId)?.knifeRest;

      // A rest whose design no longer has a companion is stale geometry.
      if (bin.pairRole === 'rest' && byDesign.has(bin.linkedDesignId) && meta === undefined) {
        const block = pairPartner(bin, layout.bins);
        batch(() => {
          deleteBin(bin.id);
          if (block) updateBin(block.id, { pairId: undefined, pairRole: undefined });
        });
        continue;
      }

      if (meta === undefined || bin.pairId !== undefined || bin.pairRole === 'rest') continue;
      const key = `${bin.id}:${bin.linkedDesignId}`;
      if (attempted.current.has(key)) continue;
      attempted.current.add(key);

      const rest = restFootprint(meta);
      const gapU = Math.max(0, Math.round((meta.gapMm / layout.gridUnitMm) * 2) / 2);
      const at = restPosition(bin, meta, gapU, rest);
      const pairId = generateUUID();
      batch(() => {
        const base = {
          width: gridUnits(rest.w),
          depth: gridUnits(rest.d),
          height: heightUnits(meta.heightU),
          category: bin.category,
          label: '',
          notes: '',
          linkedDesignId: bin.linkedDesignId,
          pairId,
          pairRole: 'rest' as const,
        };
        const placed =
          bin.layerId !== STAGING_ID && at.x >= 0 && at.y >= 0
            ? addBin({
                ...base,
                layerId: bin.layerId,
                x: at.x as GridUnits,
                y: at.y as GridUnits,
              })
            : undefined;
        const landed =
          placed !== undefined && isOk(placed)
            ? placed
            : addBin({ ...base, layerId: STAGING_ID, x: gridUnits(0), y: gridUnits(0) });
        if (isOk(landed)) {
          updateBin(bin.id, { pairId, pairRole: 'block' });
        }
      });
    }
  }, [bins, registry]);
}
