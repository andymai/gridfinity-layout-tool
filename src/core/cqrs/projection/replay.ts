/**
 * Event Replay — Rebuild state from an event stream.
 *
 * Primarily a debugging/dev tool for v1. Applies domain events
 * to a base layout state to reconstruct what happened.
 */

import type { BinId, Layout } from '@/core/types';
import { gridUnits, heightUnits, mm } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import type { DomainEvent } from '../events';

/**
 * Apply a single domain event to a layout, producing a new layout.
 * Pure function — does not mutate the input.
 */
export function applyEvent(layout: Layout, event: DomainEvent): Layout {
  const next = structuredClone(layout);

  switch (event.type) {
    case 'bin.added':
      next.bins.push(event.payload.bin);
      break;

    case 'bin.updated': {
      const bin = next.bins.find((b) => b.id === event.payload.id);
      if (bin) Object.assign(bin, event.payload.changes);
      break;
    }

    case 'bin.deleted':
      next.bins = next.bins.filter((b) => b.id !== event.payload.bin.id);
      break;

    case 'bin.batchDeleted': {
      const ids = new Set(event.payload.bins.map((b) => b.id));
      next.bins = next.bins.filter((b) => !ids.has(b.id));
      break;
    }

    case 'bin.duplicated':
      next.bins.push(event.payload.newBin);
      break;

    case 'bin.movedToStaging': {
      const bin = next.bins.find((b) => b.id === event.payload.id);
      if (bin) bin.layerId = STAGING_ID;
      break;
    }

    case 'bin.movedFromStaging': {
      const bin = next.bins.find((b) => b.id === event.payload.id);
      if (bin) {
        bin.layerId = event.payload.layerId;
        bin.x = gridUnits(event.payload.x);
        bin.y = gridUnits(event.payload.y);
        // height was added to the payload in v2 (defineCommand migration).
        // v1-era persisted events have no height — leave it untouched in
        // that case (preserves prior replay behavior).
        if (event.payload.height !== undefined) {
          bin.height = heightUnits(event.payload.height);
        }
      }
      break;
    }

    case 'bin.layerFilled':
      next.bins.push(...event.payload.bins);
      break;

    case 'bin.layerCleared': {
      const clearedIds = new Set(event.payload.bins.map((b) => b.id));
      next.bins = next.bins.filter((b) => !clearedIds.has(b.id));
      break;
    }

    case 'layer.added':
      next.layers.push(event.payload.layer);
      break;

    case 'layer.updated': {
      const layer = next.layers.find((l) => l.id === event.payload.id);
      if (layer) Object.assign(layer, event.payload.changes);
      break;
    }

    case 'layer.deleted': {
      const deletedLayerId = event.payload.layer.id;
      next.layers = next.layers.filter((l) => l.id !== deletedLayerId);
      // v2 events carry the exact displacedBinIds — use them when present
      // so replay reproduces the cascade even if the layout has diverged.
      // v1 events fall back to the "all bins on the deleted layer" heuristic
      // (matches layerActions.ts and the prior replay behavior).
      // Local annotation: TS doesn't always narrow optional fields cleanly
      // through the DomainEvent discriminated union, so be explicit here.
      const ids: ReadonlyArray<BinId> | undefined = event.payload.displacedBinIds;
      if (ids !== undefined) {
        const idSet = new Set<BinId>(ids);
        next.bins = next.bins.map((b) => (idSet.has(b.id) ? { ...b, layerId: STAGING_ID } : b));
      } else {
        next.bins = next.bins.map((b) =>
          b.layerId === deletedLayerId ? { ...b, layerId: STAGING_ID } : b
        );
      }
      break;
    }

    case 'layer.reordered': {
      const { fromIndex, toIndex } = event.payload;
      const [moved] = next.layers.splice(fromIndex, 1);
      next.layers.splice(toIndex, 0, moved);
      break;
    }

    case 'category.added':
      next.categories.push(event.payload.category);
      break;

    case 'category.updated': {
      const cat = next.categories.find((c) => c.id === event.payload.id);
      if (cat) Object.assign(cat, event.payload.changes);
      break;
    }

    case 'category.deleted':
      next.categories = next.categories.filter((c) => c.id !== event.payload.category.id);
      break;

    case 'drawer.updated':
      Object.assign(next.drawer, event.payload.changes);
      break;

    case 'layout.nameSet':
      next.name = event.payload.name;
      break;

    case 'layout.printBedSizeSet':
      next.printBedSize = mm(event.payload.size);
      next.printBedDepth = event.payload.depth !== undefined ? mm(event.payload.depth) : undefined;
      break;

    case 'layout.gridUnitMmSet':
      next.gridUnitMm = mm(event.payload.mm);
      break;

    case 'layout.heightUnitMmSet':
      next.heightUnitMm = mm(event.payload.mm);
      break;

    case 'layout.baseplateParamsSet':
      next.baseplateParams = event.payload.params;
      break;
  }

  return next;
}

/**
 * Replay a sequence of events onto a base layout state.
 */
export function replayEvents(baseLayout: Layout, events: ReadonlyArray<DomainEvent>): Layout {
  return events.reduce<Layout>((layout, event) => applyEvent(layout, event), baseLayout);
}
