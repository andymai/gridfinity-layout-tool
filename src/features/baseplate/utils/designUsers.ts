import { loadLayoutAsync } from '@/core/storage';
import { useLibraryStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import type { BaseplateDesignId, LayoutEntry, LayoutId } from '@/core/types';
import {
  layoutLinks,
  layoutsUsingDesign,
  ownedCopyId,
  type DesignUser,
  type LiveLayout,
} from './designOwnership';

const storedLinks = new Map<
  LayoutId,
  { readonly modifiedAt: number; readonly link: string | null }
>();

async function readStoredLink(entry: LayoutEntry): Promise<string | null> {
  const cached = storedLinks.get(entry.id);
  if (cached?.modifiedAt === entry.modifiedAt) return cached.link;
  const layout = await loadLayoutAsync(entry.id);
  const link = layout?.activeBaseplateId ?? null;
  storedLinks.set(entry.id, { modifiedAt: entry.modifiedAt, link });
  return link;
}

function liveLayout(): LiveLayout | undefined {
  const { activeLayoutId, layout } = useLayoutStore.getState();
  return activeLayoutId === null
    ? undefined
    : { id: activeLayoutId, name: layout.name, designId: layout.activeBaseplateId ?? null };
}

/** Library layouts that link `designId`, counting the open layout by its live link. */
export function findDesignUsers(designId: string): Promise<DesignUser[]> {
  return layoutsUsingDesign(
    designId,
    useLibraryStore.getState().library.entries,
    readStoredLink,
    liveLayout()
  );
}

/**
 * The id to save a layout's own copy of `designId` under. `ownedCopyId` lets two
 * devices splitting the same pair converge on one design, but once another
 * layout links that design, saving over it would change that layout's plate, so
 * the copy gets a fresh id instead (undefined lets `saveDesign` mint one).
 */
export async function ownedCopyTarget(
  layoutId: LayoutId,
  designId: string
): Promise<BaseplateDesignId | undefined> {
  const candidate = ownedCopyId(layoutId, designId);
  const users = await findDesignUsers(candidate);
  return users.some((u) => u.id !== layoutId) ? undefined : candidate;
}

/** Names of the layouts linking each design. */
export async function designUsage(): Promise<Map<string, string[]>> {
  const usage = new Map<string, string[]>();
  const links = await layoutLinks(
    useLibraryStore.getState().library.entries,
    readStoredLink,
    liveLayout()
  );
  for (const { link, name } of links) {
    if (link === null) continue;
    const names = usage.get(link);
    if (names) names.push(name);
    else usage.set(link, [name]);
  }
  return usage;
}
