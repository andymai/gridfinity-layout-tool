import { loadLayoutAsync } from '@/core/storage';
import { useLibraryStore } from '@/core/store';
import { useLayoutStore } from '@/core/store/layout';
import type { LayoutId } from '@/core/types';
import {
  layoutLinks,
  layoutsUsingDesign,
  type DesignUser,
  type LiveLayout,
} from './designOwnership';

const storedLinks = new Map<LayoutId, string | null>();

async function readStoredLink(id: LayoutId): Promise<string | null> {
  const cached = storedLinks.get(id);
  if (cached !== undefined) return cached;
  const layout = await loadLayoutAsync(id);
  const link = layout?.activeBaseplateId ?? null;
  storedLinks.set(id, link);
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

/** Names of the layouts linking each design. */
export async function designUsage(): Promise<Map<string, string[]>> {
  const usage = new Map<string, string[]>();
  const links = await layoutLinks(
    useLibraryStore.getState().library.entries,
    readStoredLink,
    liveLayout()
  );
  for (const { link, name } of links) {
    if (link !== null) usage.set(link, [...(usage.get(link) ?? []), name]);
  }
  return usage;
}
