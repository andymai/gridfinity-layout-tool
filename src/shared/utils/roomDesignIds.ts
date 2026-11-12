import type { Layout } from '@/core/types';
import { designId } from '@/core/types';

/**
 * Moves a layout between a collab room and this browser's copy of it.
 *
 * The room holds the owner's design ids, because the owner's browser saves the
 * room to the share and can only collect designs that it has. A visitor holds
 * the share's designs under ids of its own (`sharedDesignIds`), so its copy
 * uses those, or its bins show no model.
 */
export interface RoomDesignIds {
  readonly toLocal: (roomLayout: Layout) => Layout;
  readonly toRoom: (localLayout: Layout) => Layout;
}

const SAME_IDS: RoomDesignIds = { toLocal: (layout) => layout, toRoom: (layout) => layout };

function relink(layout: Layout, ids: ReadonlyMap<string, string>): Layout {
  const bins = layout.bins.map((bin) => {
    const next = bin.linkedDesignId ? ids.get(bin.linkedDesignId) : undefined;
    return next === undefined ? bin : { ...bin, linkedDesignId: designId(next) };
  });
  return bins.some((bin, i) => bin !== layout.bins[i]) ? { ...layout, bins } : layout;
}

/**
 * @param ownerToLocal - Each design of the share: the owner's id mapped to this
 *   browser's id. Undefined or empty for the owner, whose ids are the room's.
 */
export function roomDesignIds(
  ownerToLocal: Readonly<Record<string, string>> | undefined
): RoomDesignIds {
  // The local id is a 32-bit hash, so two owner ids can share one. Neither
  // moves: a shared local id would lose which owner design each bin had, and
  // the owner's browser cannot load it.
  const owners = new Map<string, string | null>();
  for (const [owner, local] of Object.entries(ownerToLocal ?? {})) {
    owners.set(local, owners.has(local) ? null : owner);
  }
  const toLocalIds = new Map<string, string>();
  const toRoomIds = new Map<string, string>();
  for (const [local, owner] of owners) {
    if (owner === null) continue;
    toLocalIds.set(owner, local);
    toRoomIds.set(local, owner);
  }
  if (toLocalIds.size === 0) return SAME_IDS;
  return {
    toLocal: (roomLayout) => relink(roomLayout, toLocalIds),
    toRoom: (localLayout) => relink(localLayout, toRoomIds),
  };
}
