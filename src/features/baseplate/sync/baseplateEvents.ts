import type { BaseplateDesignId } from '@/core/types';

export type BaseplateSyncEvent =
  | { type: 'put'; id: BaseplateDesignId; updatedAt: string }
  | { type: 'delete'; id: BaseplateDesignId; deletedAt: string };

type Listener = (event: BaseplateSyncEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emit(event: BaseplateSyncEvent): void {
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
