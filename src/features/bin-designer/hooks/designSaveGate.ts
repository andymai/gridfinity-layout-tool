/**
 * Lets a design switch wait for the open design's edits to reach storage
 * before it reads the next design.
 *
 * Storage reads do not wait for writes, and a write to a parent also rewrites
 * its variants, so a read that starts first can come back without the edit
 * the user just made, or a variant without its parent's change. Writes are
 * held here rather than by the autosave hook because the hook's unmount flush
 * outlives it: leaving the designer and reopening it must still wait on that
 * write.
 */

import type { BinParams, ExportFileNameConfig } from '../types';

const MAX_SETTLE_ROUNDS = 5;

interface HeldEdit {
  readonly designId: string;
  readonly params: BinParams;
  readonly config: ExportFileNameConfig;
}

let flushOpenDesign: (() => void) | null = null;
/** Each resolves false when its edit did not reach storage. */
const pendingWrites = new Set<Promise<boolean>>();
let heldEdit: HeldEdit | null = null;

/** Starts a write of the open design's unsaved edit, through {@link trackDesignWrite}. */
export function registerOpenDesignFlush(flush: () => void): () => void {
  flushOpenDesign = flush;
  return () => {
    if (flushOpenDesign === flush) flushOpenDesign = null;
  };
}

export function trackDesignWrite(write: Promise<boolean>): void {
  pendingWrites.add(write);
  const settled = () => pendingWrites.delete(write);
  void write.then(settled, settled);
}

/**
 * Keeps an edit whose write failed after the designer closed. The store still
 * shows it, so a reopened designer would otherwise take it for stored and
 * never retry it.
 */
export function holdUnsavedEdit(edit: HeldEdit): void {
  heldEdit = edit;
  // A designer already open on the edit retries it now; otherwise the next
  // one to open takes it.
  flushOpenDesign?.();
}

export function takeUnsavedEdit(): HeldEdit | null {
  const edit = heldEdit;
  heldEdit = null;
  return edit;
}

/**
 * Resolves true once no edit is left to write, false when one could not be
 * written and the switch must not go ahead.
 *
 * The editor stays live while a write lands, so an edit made meanwhile gets
 * its own round. Only a round that finds nothing to write is settled, and a
 * failure stays reported even if a later round succeeds: the write that failed
 * may belong to a design no longer open to retry.
 */
export async function settleDesignSaves(): Promise<boolean> {
  let saved = true;
  for (let round = 0; ; round += 1) {
    flushOpenDesign?.();
    if (pendingWrites.size === 0) return saved;
    if (round === MAX_SETTLE_ROUNDS) return false;
    const results = await Promise.allSettled([...pendingWrites]);
    saved = saved && results.every((r) => r.status === 'fulfilled' && r.value);
  }
}

/** @internal Test isolation: each test's unmount flush would otherwise land in the next. */
export function _resetDesignSaveGate(): void {
  pendingWrites.clear();
  flushOpenDesign = null;
  heldEdit = null;
}
