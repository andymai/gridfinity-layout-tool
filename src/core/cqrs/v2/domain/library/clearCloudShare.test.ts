import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { CloudShareInfo } from '@/core/types';
import { clearCloudShare } from './clearCloudShare';
import { makeLibrary, makeEntry } from './_testHelpers';

const sampleShare: CloudShareInfo = {
  id: 'share_abc',
  deleteToken: 'token',
  sharedAt: 1000,
  permission: 'view',
};

describe('v2 library.clearCloudShare', () => {
  it('emits library.cloudShareCleared with the layoutId', () => {
    const library = makeLibrary();
    const result = clearCloudShare.handle({ layoutId: 'layout_1' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.layoutId).toBe('layout_1');
  });

  it('apply() clears cloudShare on the matching entry', () => {
    const entry = makeEntry('layout_1');
    entry.cloudShare = sampleShare;
    const library = makeLibrary({ entries: [entry] });

    const result = clearCloudShare.handle({ layoutId: 'layout_1' }, { aggregate: library });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      clearCloudShare.apply(
        { type: 'library.cloudShareCleared', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.entries[0].cloudShare).toBeUndefined();
  });
});
