import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetForTests, announce, subscribe, subscribeChanges } from './libraryEvents';

describe('libraryEvents', () => {
  beforeEach(() => __resetForTests());

  it('tells sync and views about a user write', () => {
    const sync = vi.fn();
    const views = vi.fn();
    subscribe(sync);
    subscribeChanges(views);
    announce({ kind: 'item', type: 'put', id: 'clib_1', modifiedAt: 1 });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(views).toHaveBeenCalledTimes(1);
  });

  it('reloads the views of another tab, and never its sync', async () => {
    const sync = vi.fn();
    const views = vi.fn();
    subscribe(sync);
    subscribeChanges(views);
    const other = new BroadcastChannel('gflt-cutout-library');
    other.postMessage('changed');
    await vi.waitFor(() => expect(views).toHaveBeenCalled());
    expect(sync).not.toHaveBeenCalled();
    other.close();
  });
});
