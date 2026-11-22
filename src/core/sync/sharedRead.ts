/**
 * Wraps a refresh so that calls made while it runs share one more run after
 * it. A burst of n calls costs two runs instead of n, each caller still gets
 * a run that starts after its call, and runs never overlap, so an older
 * result cannot land last. A failed run fails only the calls it served.
 */
export function sharedRead(read: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let next: Promise<void> | null = null;
  const run = (): Promise<void> => {
    if (running === null) {
      running = read().finally(() => {
        running = null;
      });
      return running;
    }
    next ??= running
      .catch(() => undefined)
      .then(() => {
        next = null;
        return run();
      });
    return next;
  };
  return run;
}
