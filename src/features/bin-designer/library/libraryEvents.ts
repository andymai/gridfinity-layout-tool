/**
 * Two feeds from the library store. `subscribe` carries the user's own writes,
 * which sync turns into outbox entries; `subscribeChanges` fires on every
 * write, a pulled one included, so open views reload.
 */

export type LibraryKind = 'item' | 'folder';

export type LibraryEvent =
  | {
      readonly kind: LibraryKind;
      readonly type: 'put';
      readonly id: string;
      readonly modifiedAt: number;
    }
  | {
      readonly kind: LibraryKind;
      readonly type: 'delete';
      readonly id: string;
      readonly deletedAt: number;
    };

type Listener = (event: LibraryEvent) => void;

const listeners = new Set<Listener>();
const changeListeners = new Set<() => void>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeChanges(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function notifyChanged(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch {
      /* one bad subscriber must not block the others */
    }
  }
}

export function announce(event: LibraryEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* one bad subscriber must not block the others or the writer */
    }
  }
  notifyChanged();
}

export function __resetForTests(): void {
  listeners.clear();
  changeListeners.clear();
}
