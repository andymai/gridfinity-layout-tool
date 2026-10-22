/**
 * Lets a design switch wait for the open design's edits to reach storage
 * before it reads the next design.
 *
 * Storage reads do not wait for writes, and a write to a parent also rewrites
 * its variants, so a read that starts first can come back without the edit
 * the user just made, or a variant without its parent's change.
 */

/** Resolves false when an edit could not be written, so the switch must not go ahead. */
type Settle = () => Promise<boolean>;

let registered: Settle | null = null;

export function registerDesignSaveSettler(settle: Settle): () => void {
  registered = settle;
  return () => {
    if (registered === settle) registered = null;
  };
}

export function settleDesignSaves(): Promise<boolean> {
  return registered ? registered() : Promise.resolve(true);
}
