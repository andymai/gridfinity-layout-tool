import { useSyncExternalStore } from 'react';
import { LATEST_ENTRY_ID } from './latest';

const STORAGE_KEY = 'gridfinity-whats-new-v1';

/** Minimum gap between automatic openings. */
const AUTO_OPEN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface SeenState {
  /** Id of the newest entry the user has been shown. */
  lastSeenId: string;
  /** Epoch ms of the last automatic opening, 0 if never. */
  lastAutoOpenAt: number;
}

const EMPTY: SeenState = { lastSeenId: '', lastAutoOpenAt: 0 };

function read(): SeenState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const { lastSeenId, lastAutoOpenAt } = parsed as Partial<SeenState>;
    return {
      lastSeenId: typeof lastSeenId === 'string' ? lastSeenId : '',
      lastAutoOpenAt: typeof lastAutoOpenAt === 'number' ? lastAutoOpenAt : 0,
    };
  } catch {
    return EMPTY;
  }
}

function write(state: SeenState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  cache = state;
  for (const listener of listeners) listener();
}

let cache: SeenState = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SeenState {
  return cache;
}

export function useSeenState(): SeenState {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** Current value outside React, reflecting writes made earlier in the same tick. */
export function getSeenState(): SeenState {
  return cache;
}

/** True when the newest entry has never been shown to this browser. */
export function hasUnseen(state: SeenState): boolean {
  return state.lastSeenId !== LATEST_ENTRY_ID;
}

/**
 * A browser with no marker at all has nothing to catch up on, so record the
 * current position without showing anything. Returns true if it seeded, which
 * also means no digest should open on this load.
 */
export function seedIfFirstRun(): boolean {
  if (cache.lastSeenId !== '') return false;
  write({ lastSeenId: LATEST_ENTRY_ID, lastAutoOpenAt: Date.now() });
  return true;
}

export function markAllSeen(): void {
  write({ ...cache, lastSeenId: LATEST_ENTRY_ID });
}

export function recordAutoOpen(): void {
  write({ ...cache, lastAutoOpenAt: Date.now() });
}

export function isCooldownElapsed(state: SeenState): boolean {
  return Date.now() - state.lastAutoOpenAt >= AUTO_OPEN_COOLDOWN_MS;
}

/** Test seam — re-hydrates the cache from whatever localStorage currently holds. */
export function reloadSeenState(): void {
  cache = read();
  for (const listener of listeners) listener();
}
