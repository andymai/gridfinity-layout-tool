/**
 * Local mutation feed for design versions, mirroring `designerEvents`.
 *
 * The sync engine cannot watch IndexedDB, so the service announces its own
 * writes here and the adapter turns them into outbox entries.
 */

export type DesignVersionEvent =
  | { type: 'put'; id: string; modifiedAt: number }
  | { type: 'delete'; id: string; deletedAt: number };

type Listener = (event: DesignVersionEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emit(event: DesignVersionEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* one bad subscriber must not block the others or the emitter */
    }
  }
}

export function __resetForTests(): void {
  listeners.clear();
}
