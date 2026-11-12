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
  const pairs = Object.entries(ownerToLocal ?? {});
  if (pairs.length === 0) return SAME_IDS;
  const toLocalIds = new Map(pairs);
  const toRoomIds = new Map(pairs.map(([owner, local]) => [local, owner]));
  return {
    toLocal: (roomLayout) => relink(roomLayout, toLocalIds),
    toRoom: (localLayout) => relink(localLayout, toRoomIds),
  };
}
