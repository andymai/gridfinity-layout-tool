import type { DesignId } from '@/core/types';

export type DesignerEvent =
  | { type: 'put'; id: DesignId; updatedAt: string }
  | { type: 'delete'; id: DesignId; deletedAt: string };

type Listener = (event: DesignerEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emit(event: DesignerEvent): void {
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
