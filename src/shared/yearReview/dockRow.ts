import { YEAR_REVIEW_YEAR } from './window';

const KEY = `gridfinity-year-review-${YEAR_REVIEW_YEAR}`;

export interface DockRowState {
  /** The user opened the review, so the row drops its dot. */
  readonly seen: boolean;
  readonly hidden: boolean;
  /** A cached yes from the audience check; a no is never cached. */
  readonly hasWork: boolean;
}

const EMPTY: DockRowState = { seen: false, hidden: false, hasWork: false };

const listeners = new Set<() => void>();
let cached: DockRowState | null = null;

function read(): DockRowState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const value = parsed as Record<string, unknown>;
    return {
      seen: value.seen === true,
      hidden: value.hidden === true,
      hasWork: value.hasWork === true,
    };
  } catch {
    return EMPTY;
  }
}

/** Stable between changes, as `useSyncExternalStore` needs. */
export function readDockRowState(): DockRowState {
  cached ??= read();
  return cached;
}

function write(change: Partial<DockRowState>): void {
  const next = { ...readDockRowState(), ...change };
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota: the change still holds for this session.
  }
  listeners.forEach((listener) => listener());
}

export function markYearReviewSeen(): void {
  if (!readDockRowState().seen) write({ seen: true });
}

export function hideYearReviewRow(): void {
  write({ hidden: true });
}

export function rememberYearWork(): void {
  if (!readDockRowState().hasWork) write({ hasWork: true });
}

export function subscribeDockRow(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** For tests: forget the in-memory copy so the next read goes to storage. */
export function resetDockRowCache(): void {
  cached = null;
}
