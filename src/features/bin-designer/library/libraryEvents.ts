/**
 * Two feeds from the library store. `subscribe` carries the user's own writes,
 * which sync turns into outbox entries; `subscribeChanges` fires on every
 * write, a pulled one included, so open views reload. Other tabs hear of each
 * write through a BroadcastChannel and reload their views only: their sync
 * must not push a write this tab already queued.
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

const CHANNEL_NAME = 'gflt-cutout-library';

const listeners = new Set<Listener>();
const changeListeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;

function notifyViews(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch {
      /* one bad subscriber must not block the others */
    }
  }
}

function tabChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  if (channel) {
    channel.onmessage = notifyViews;
    // Node keeps a process alive while a channel is open; a browser has no unref.
    (channel as { unref?: () => void }).unref?.();
  }
  return channel;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeChanges(listener: () => void): () => void {
  tabChannel();
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function notifyChanged(): void {
  notifyViews();
  try {
    tabChannel()?.postMessage('changed');
  } catch {
    /* a closed channel only costs the other tabs a reload */
  }
}

export function announce(event: LibraryEvent): void {
  announceAll([event]);
}

/** Several writes at once: each reaches sync, and the views reload one time. */
export function announceAll(events: readonly LibraryEvent[]): void {
  for (const event of events) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        /* one bad subscriber must not block the others or the writer */
      }
    }
  }
  notifyChanged();
}

export function __resetForTests(): void {
  listeners.clear();
  changeListeners.clear();
  channel?.close();
  channel = undefined;
}
