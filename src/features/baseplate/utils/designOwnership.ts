import { baseplateDesignId } from '@/core/types';
import type { BaseplateDesignId, LayoutEntry, LayoutId } from '@/core/types';

const MAX_DESIGN_NAME_LENGTH = 64;

export interface DesignUser {
  readonly id: LayoutId;
  readonly name: string;
  readonly createdAt: number;
}

export interface LiveLayout {
  readonly id: LayoutId;
  readonly name: string;
  readonly designId: string | null;
}

/**
 * Each library layout with the design it links. An entry's preview records its
 * link once the layout is saved; an entry saved before that is read through
 * `readLink`. `live` stands in for the open layout, whose entry trails its edits.
 */
export function layoutLinks(
  entries: readonly LayoutEntry[],
  readLink: (entry: LayoutEntry) => Promise<string | null>,
  live?: LiveLayout
): Promise<Array<DesignUser & { readonly link: string | null }>> {
  return Promise.all(
    entries.map(async (entry) => {
      const isLive = live !== undefined && entry.id === live.id;
      const recorded = entry.preview.baseplateId;
      const link = isLive
        ? live.designId
        : recorded !== undefined
          ? recorded
          : await readLink(entry);
      return {
        id: entry.id,
        name: isLive ? live.name : entry.name,
        createdAt: entry.createdAt,
        link,
      };
    })
  );
}

export async function layoutsUsingDesign(
  designId: string,
  entries: readonly LayoutEntry[],
  readLink: (entry: LayoutEntry) => Promise<string | null>,
  live?: LiveLayout
): Promise<DesignUser[]> {
  return (await layoutLinks(entries, readLink, live))
    .filter((l) => l.link === designId)
    .map(({ id, name, createdAt }) => ({ id, name, createdAt }));
}

/**
 * The oldest layout keeps a shared design, so a duplicate copies and its source
 * keeps the original. `createdAt` is local: a layout pulled from sync is stamped
 * with its last edit, so two devices can name different owners. If both split
 * before syncing, each layout still ends up with its own copy, and the original
 * is left unused.
 */
export function designOwner(users: readonly DesignUser[]): DesignUser | undefined {
  return [...users].sort(
    (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )[0];
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The same id on every device, so two devices giving one layout its own copy
 * of a design converge on one synced design instead of minting two.
 */
export function ownedCopyId(layoutId: LayoutId, designId: string): BaseplateDesignId {
  const seed = `${layoutId}:${designId}`;
  return baseplateDesignId(
    `baseplate_${fnv1a(seed)}_${fnv1a(`${seed}#`).toString(36).slice(0, 8)}`
  );
}

export function ownedCopyName(designName: string, layoutName: string): string {
  const name = `${designName} (${layoutName})`;
  return name.length <= MAX_DESIGN_NAME_LENGTH
    ? name
    : `${name.slice(0, MAX_DESIGN_NAME_LENGTH - 1)}…`;
}
