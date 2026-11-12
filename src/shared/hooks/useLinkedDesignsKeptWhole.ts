/**
 * The saved designs that turn splitting off (`splitToFitBed: false`).
 *
 * Layout surfaces ask "is this placed bin cut to fit the bed" synchronously,
 * and the switch lives in each design's params in IndexedDB. The bin-designer
 * registry carries it (`CustomBinRef.splitToFitBed`), and the shell registers
 * that registry here (`LinkedRiseRegistration`), so shared code reads it without
 * importing the feature. Unregistered, every design splits.
 */

import { useSyncExternalStore } from 'react';
import type { DesignId } from '@/core/types';

export interface KeptWholeDesignsSource {
  /** The same set until `subscribe` reports a change. */
  readonly read: () => ReadonlySet<DesignId>;
  readonly subscribe: (onChange: () => void) => () => void;
}

const NONE: ReadonlySet<DesignId> = new Set();
const listeners = new Set<() => void>();
let source: KeptWholeDesignsSource | null = null;
let stopSource: (() => void) | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

export function registerKeptWholeDesigns(next: KeptWholeDesignsSource | null): void {
  stopSource?.();
  source = next;
  stopSource = next ? next.subscribe(notify) : null;
  notify();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function read(): ReadonlySet<DesignId> {
  return source?.read() ?? NONE;
}

export function useLinkedDesignsKeptWhole(): ReadonlySet<DesignId> {
  return useSyncExternalStore(subscribe, read, read);
}
