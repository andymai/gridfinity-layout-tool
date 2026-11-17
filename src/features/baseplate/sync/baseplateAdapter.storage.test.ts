// @vitest-environment jsdom
// Real storage: IndexedDB (fake-indexeddb), with no mock between the sync
// adapter and it.
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { closeBaseplateDb } from '@/features/baseplate/storage/BaseplateStorage';
import { baseplateAdapter } from './baseplateAdapter';

beforeEach(async () => {
  closeBaseplateDb();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('gridfinity-baseplate-v1');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('baseplateAdapter.applyRemote with real storage', () => {
  // Sync pulls a baseplate only when its modifiedAt is newer than the local
  // one, so a local copy that took this device's clock would be pulled at
  // every poll while the remote stamp is ahead of that clock.
  it.each([
    ['a new baseplate', false],
    ['a baseplate this device already holds', true],
  ])('keeps the modifiedAt it pulled for %s', async (_label, heldBefore) => {
    const pull = (modifiedAt: number, name: string): Promise<void> =>
      baseplateAdapter.applyRemote({
        id: 'baseplate_1_remote',
        payload: { name, params: DEFAULT_BASEPLATE_PARAMS },
        modifiedAt,
      });
    if (heldBefore) await pull(Date.now() - 60_000, 'Older');
    const pulledAt = Date.now() + 5 * 60 * 60 * 1000;

    await pull(pulledAt, 'Ahead');

    const item = await baseplateAdapter.get('baseplate_1_remote');
    expect(item?.payload.name).toBe('Ahead');
    expect(item?.modifiedAt).toBe(pulledAt);
    expect(
      (await baseplateAdapter.list()).find((b) => b.id === 'baseplate_1_remote')?.modifiedAt
    ).toBe(pulledAt);
  });
});
