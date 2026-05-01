import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type { CloudShareInfo } from '@/core/types';
import { setCloudShare } from './setCloudShare';
import { makeLibrary, makeEntry } from './_testHelpers';

const sampleShare: CloudShareInfo = {
  id: 'share_abc',
  deleteToken: 'token',
  sharedAt: 1000,
  permission: 'view',
};

describe('v2 library.setCloudShare', () => {
  it('emits library.cloudShareUpdated with the share info', () => {
    const library = makeLibrary();
    const result = setCloudShare.handle(
      { layoutId: 'layout_1', shareInfo: { ...sampleShare, url: 'https://example.com' } },
      { aggregate: library }
    );

    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.shareInfo.id).toBe('share_abc');
  });

  it('apply() sets cloudShare on the matching entry', () => {
    const library = makeLibrary({ entries: [makeEntry('layout_1')] });
    const result = setCloudShare.handle(
      { layoutId: 'layout_1', shareInfo: { ...sampleShare, url: 'https://example.com' } },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      setCloudShare.apply(
        { type: 'library.cloudShareUpdated', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.entries[0].cloudShare?.id).toBe('share_abc');
  });

  it('apply() no-ops when the layoutId is unknown', () => {
    const library = makeLibrary();
    const result = setCloudShare.handle(
      { layoutId: 'layout_gone', shareInfo: { ...sampleShare, url: 'https://example.com' } },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      setCloudShare.apply(
        { type: 'library.cloudShareUpdated', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied).toEqual(library);
  });
});
