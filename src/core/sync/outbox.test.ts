// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  __resetForTests,
  backoffDelayMs,
  clearAll,
  discard,
  enqueue,
  getAll,
  getDue,
  markFailure,
  markSuccess,
  MAX_ATTEMPTS,
  type OutboxEntry,
} from './outbox';

beforeEach(async () => {
  __resetForTests();
  // Drop any indexedDB residue between tests so each test starts from
  // a clean slate. fake-indexeddb persists across tests in the same file.
  // Easiest: clear the outbox store explicitly.
  try {
    await clearAll();
  } catch {
    // First test of the run — DB may not exist yet, ignore.
  }
});

afterEach(() => {
  __resetForTests();
});

describe('backoffDelayMs', () => {
  it('returns 1s for the first failure', () => {
    expect(backoffDelayMs(0)).toBe(1000);
  });

  it('doubles on each subsequent failure', () => {
    expect(backoffDelayMs(1)).toBe(2000);
    expect(backoffDelayMs(2)).toBe(4000);
    expect(backoffDelayMs(3)).toBe(8000);
  });

  it('caps at 5 minutes', () => {
    expect(backoffDelayMs(20)).toBe(5 * 60 * 1000);
  });
});

describe('enqueue / getAll', () => {
  it('persists a new entry', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'layouts',
      id: 'lay-1',
      modifiedAt: 1000,
      op: 'put',
      attempts: 0,
    });
    expect(entries[0].nextAttemptAt).toBeLessThanOrEqual(Date.now());
  });

  it('upserts when re-enqueued for the same (kind, id)', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 2000, op: 'put' });
    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].modifiedAt).toBe(2000);
    // Re-enqueue resets attempts so a stuck retry budget doesn't apply
    // to a fresh user edit.
    expect(entries[0].attempts).toBe(0);
  });

  it('keeps separate entries for different ids', async () => {
    await enqueue({ kind: 'layouts', id: 'a', modifiedAt: 1000, op: 'put' });
    await enqueue({ kind: 'layouts', id: 'b', modifiedAt: 2000, op: 'put' });
    expect((await getAll()).map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps separate entries for the same id across different kinds', async () => {
    await enqueue({ kind: 'layouts', id: 'x', modifiedAt: 1000, op: 'put' });
    await enqueue({ kind: 'designs', id: 'x', modifiedAt: 1000, op: 'put' });
    const entries = await getAll();
    expect(entries).toHaveLength(2);
  });
});

describe('getDue', () => {
  it('only returns entries whose nextAttemptAt has passed', async () => {
    await enqueue({ kind: 'layouts', id: 'now', modifiedAt: 1000, op: 'put' });
    await enqueue({ kind: 'layouts', id: 'later', modifiedAt: 1000, op: 'put' });
    // Bump the second entry's nextAttemptAt into the future via markFailure.
    await markFailure('layouts', 'later');

    const due = await getDue();
    expect(due.map((e) => e.id)).toEqual(['now']);
  });

  it('orders by enqueuedAt (oldest first)', async () => {
    await enqueue({ kind: 'layouts', id: 'a', modifiedAt: 1000, op: 'put' });
    // Force a tick gap so enqueuedAt timestamps differ deterministically.
    await new Promise((r) => setTimeout(r, 5));
    await enqueue({ kind: 'layouts', id: 'b', modifiedAt: 1000, op: 'put' });
    const due = await getDue();
    expect(due.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('markSuccess', () => {
  it('removes the entry on matching modifiedAt', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    await markSuccess('layouts', 'lay-1', 1000);
    expect(await getAll()).toEqual([]);
  });

  it('preserves a newer enqueue that arrived during the push (race)', async () => {
    // Push starts for modifiedAt=1000 — we read this snapshot.
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    // User edits again before our PUT lands — newer enqueue replaces it.
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 2000, op: 'put' });
    // Our PUT for 1000 succeeds. We mark success — but the stored entry
    // is now for 2000 and shouldn't be deleted.
    await markSuccess('layouts', 'lay-1', 1000);
    const entries = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].modifiedAt).toBe(2000);
  });
});

describe('markFailure', () => {
  it('increments attempts and reschedules with backoff', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    const before = (await getAll())[0];
    expect(before.attempts).toBe(0);

    const result = await markFailure('layouts', 'lay-1');
    expect(result).toBe('rescheduled');
    const after = (await getAll())[0];
    expect(after.attempts).toBe(1);
    // First failure → next attempt ~1s away (`backoffDelayMs(0) = 1s`).
    const delay = after.nextAttemptAt - Date.now();
    expect(delay).toBeGreaterThanOrEqual(900);
    expect(delay).toBeLessThan(1500);
  });

  it('gives up after MAX_ATTEMPTS and removes the entry', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    let result: 'rescheduled' | 'gave-up' = 'rescheduled';
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      result = await markFailure('layouts', 'lay-1');
    }
    expect(result).toBe('gave-up');
    expect(await getAll()).toEqual([]);
  });

  it('is a no-op when the entry has been discarded concurrently', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    await discard('layouts', 'lay-1');
    // No throw, no resurrection of the deleted entry.
    await expect(markFailure('layouts', 'lay-1')).resolves.toBe('rescheduled');
    expect(await getAll()).toEqual([]);
  });
});

describe('discard / clearAll', () => {
  it('discard removes a single entry without affecting others', async () => {
    await enqueue({ kind: 'layouts', id: 'a', modifiedAt: 1000, op: 'put' });
    await enqueue({ kind: 'layouts', id: 'b', modifiedAt: 1000, op: 'put' });
    await discard('layouts', 'a');
    expect((await getAll()).map((e) => e.id)).toEqual(['b']);
  });

  it('clearAll empties the store', async () => {
    await enqueue({ kind: 'layouts', id: 'a', modifiedAt: 1000, op: 'put' });
    await enqueue({ kind: 'designs', id: 'b', modifiedAt: 1000, op: 'put' });
    await clearAll();
    expect(await getAll()).toEqual([]);
  });
});

describe('persistence across reload', () => {
  it('survives __resetForTests (simulates tab reload)', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    __resetForTests();
    // Re-opening the DB returns the same data.
    const entries: OutboxEntry[] = await getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('lay-1');
  });
});

describe('getDue with explicit time', () => {
  it('returns entries whose nextAttemptAt has passed when an explicit `now` is provided', async () => {
    await enqueue({ kind: 'layouts', id: 'lay-1', modifiedAt: 1000, op: 'put' });
    await markFailure('layouts', 'lay-1'); // schedules ~1s out

    // `now` argument lets callers (like the engine drainer) probe future
    // states without faking the system clock — useful since IDB doesn't
    // play well with vi.useFakeTimers.
    expect(await getDue(Date.now())).toEqual([]);
    expect(await getDue(Date.now() + 3_000)).toHaveLength(1);
  });
});
