import type { FolderKind } from '@/core/types';

const KIND_ORDER: readonly FolderKind[] = ['place', 'area', 'unit'];

export const FOLDER_KIND_ACTION: Record<FolderKind, string> = {
  place: 'places.kind.makePlace',
  area: 'places.kind.makeArea',
  unit: 'places.kind.makeUnit',
};

/** The kinds a folder can change to: not its own, and a place only at the top of the tree. */
export function offeredKinds(current: FolderKind, topLevel: boolean): FolderKind[] {
  return KIND_ORDER.filter((kind) => kind !== current && (kind !== 'place' || topLevel));
}
