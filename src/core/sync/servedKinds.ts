import type { SyncKind } from './adapters/types';

/**
 * Kinds the server serves only behind a kill switch. Its manifest lists such a
 * kind while the switch is on and leaves it out while off, and the engine
 * reads that as the switch: nothing of a kind the last manifest left out is
 * pulled, claimed or pushed.
 */
export const GATED_KINDS: readonly SyncKind[] = ['cutoutItems', 'cutoutFolders'];

const served = new Set<SyncKind>();

export function isGatedKind(kind: SyncKind): boolean {
  return GATED_KINDS.includes(kind);
}

/** Whether pushes and pulls of `kind` may run now. Ungated kinds always may. */
export function isKindServed(kind: SyncKind): boolean {
  return !isGatedKind(kind) || served.has(kind);
}

/** Record which gated kinds `manifest` lists, and return those it newly lists. */
export function noteServedKinds(manifest: Partial<Record<SyncKind, unknown>>): SyncKind[] {
  const newly: SyncKind[] = [];
  for (const kind of GATED_KINDS) {
    if (manifest[kind] === undefined) {
      served.delete(kind);
    } else if (!served.has(kind)) {
      served.add(kind);
      newly.push(kind);
    }
  }
  return newly;
}

/**
 * The gated kinds this client reads as served, for the manifest's
 * `X-Sync-Served` header: the server skips its 304 when they differ from its own.
 */
export function servedGatedKinds(): SyncKind[] {
  return GATED_KINDS.filter((kind) => served.has(kind));
}

export function resetServedKinds(): void {
  served.clear();
}
