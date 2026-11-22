import { describe, it, expect, vi } from 'vitest';
import { sharedRead } from './sharedRead';

/** A read whose runs the test settles by hand, in the order they started. */
function controlledRead() {
  const runs: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const read = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        runs.push({ resolve, reject });
      })
  );
  return { read, runs };
}

const settled = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('sharedRead', () => {
  it('gives the calls made during a run one shared run after it', async () => {
    const { read, runs } = controlledRead();
    const refresh = sharedRead(read);
    const done: string[] = [];

    void refresh().then(() => done.push('first'));
    void refresh().then(() => done.push('second'));
    void refresh().then(() => done.push('third'));
    expect(read).toHaveBeenCalledTimes(1);

    runs[0].resolve();
    await settled();
    // The callers that came during the first run wait for a run that started after them.
    expect(done).toEqual(['first']);
    expect(read).toHaveBeenCalledTimes(2);

    runs[1].resolve();
    await settled();
    expect(done).toEqual(['first', 'second', 'third']);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('starts a new run once it is idle again', async () => {
    const { read, runs } = controlledRead();
    const refresh = sharedRead(read);
    const first = refresh();
    runs[0].resolve();
    await first;
    void refresh();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('fails only the callers of a failed run, and the next callers still get theirs', async () => {
    const { read, runs } = controlledRead();
    const refresh = sharedRead(read);

    const failed = refresh();
    const waiting = refresh();
    runs[0].reject(new Error('read failed'));
    await expect(failed).rejects.toThrow('read failed');
    await settled();

    expect(read).toHaveBeenCalledTimes(2);
    runs[1].resolve();
    await expect(waiting).resolves.toBeUndefined();
  });
});
