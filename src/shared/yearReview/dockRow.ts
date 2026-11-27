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

// Every flag only turns on, so the union of two copies loses neither: another
// tab's change survives this tab's next write, and a change storage refused
// survives another tab's write.
function merge(a: DockRowState, b: DockRowState): DockRowState {
  return { seen: a.seen || b.seen, hidden: a.hidden || b.hidden, hasWork: a.hasWork || b.hasWork };
}

function same(a: DockRowState, b: DockRowState): boolean {
  return a.seen === b.seen && a.hidden === b.hidden && a.hasWork === b.hasWork;
}

let watching = false;

// One listener for the module's lifetime: the cache outlives every dock, so it
// must hear another tab's change while no dock is mounted.
function watchOtherTabs(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY && event.key !== null) return;
    const next = merge(read(), cached ?? EMPTY);
    if (cached && same(next, cached)) return;
    cached = next;
    listeners.forEach((listener) => listener());
  });
}

/** Stable between changes, as `useSyncExternalStore` needs. */
export function readDockRowState(): DockRowState {
  watchOtherTabs();
  cached ??= read();
  return cached;
}

function write(change: Partial<DockRowState>): void {
  const next = merge(merge(read(), readDockRowState()), { ...EMPTY, ...change });
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
  watchOtherTabs();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests: forget the in-memory copy so the next read goes to storage. */
export function resetDockRowCache(): void {
  cached = null;
}
