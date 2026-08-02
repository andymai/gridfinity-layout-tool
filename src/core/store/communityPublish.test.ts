import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { INITIAL_COMMUNITY_PUBLISH_STATE, useCommunityPublishStore } from './communityPublish';
import type { CommunityPublishDesignContext, CommunityPublishHandlers } from './communityPublish';

const context: CommunityPublishDesignContext = {
  designId: 'local-1',
  designName: 'Screw Bin',
  params: { width: 2, depth: 2, height: 6 } as unknown as BinParams,
  paramsHash: 'abc123',
  publishedId: null,
  lineage: null,
  draft: null,
};

function handlers(): CommunityPublishHandlers {
  return {
    onPublished: vi.fn().mockResolvedValue(true),
    onUnpublished: vi.fn(),
    requestRecapture: vi.fn(),
  };
}

describe('communityPublish store', () => {
  beforeEach(() => {
    useCommunityPublishStore.setState(INITIAL_COMMUNITY_PUBLISH_STATE);
  });

  it('starts closed with no payload', () => {
    const state = useCommunityPublishStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.context).toBeNull();
    expect(state.captures).toBeNull();
    expect(state.handlers).toBeNull();
  });

  it('open() stores the design context', () => {
    useCommunityPublishStore.getState().open(context);
    const state = useCommunityPublishStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.context).toEqual(context);
    expect(state.captures).toBeNull();
  });

  it('open() accepts an optional capture payload and handlers', () => {
    const captures = { thumbnails: ['data:image/webp;base64,AA=='], glb: 'Z2xURg==' };
    const h = handlers();
    useCommunityPublishStore.getState().open(context, captures, h);
    const state = useCommunityPublishStore.getState();
    expect(state.captures).toEqual(captures);
    expect(state.handlers).toBe(h);
  });

  it('setCaptures() fills captures after open', () => {
    useCommunityPublishStore.getState().open(context);
    const captures = { thumbnails: ['data:image/webp;base64,AA=='], glb: 'Z2xURg==' };
    useCommunityPublishStore.getState().setCaptures(captures);
    expect(useCommunityPublishStore.getState().captures).toEqual(captures);
  });

  it('close() resets to the initial state', () => {
    useCommunityPublishStore
      .getState()
      .open(context, { thumbnails: [], glb: 'Z2xURg==' }, handlers());
    useCommunityPublishStore.getState().close();
    const state = useCommunityPublishStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.context).toBeNull();
    expect(state.captures).toBeNull();
    expect(state.handlers).toBeNull();
  });

  it('reopening replaces the previous context', () => {
    useCommunityPublishStore.getState().open(context);
    const updateContext: CommunityPublishDesignContext = {
      ...context,
      designId: 'local-2',
      publishedId: 'AbCdEf123456',
    };
    useCommunityPublishStore.getState().open(updateContext);
    expect(useCommunityPublishStore.getState().context).toEqual(updateContext);
  });

  it('tracks capture failure and clears it on the next capture or delivery', () => {
    useCommunityPublishStore.getState().open(context);
    useCommunityPublishStore.getState().setCaptureFailed();
    expect(useCommunityPublishStore.getState().captureFailed).toBe(true);
    useCommunityPublishStore.getState().beginCapture();
    expect(useCommunityPublishStore.getState().captureFailed).toBe(false);
    useCommunityPublishStore.getState().setCaptureFailed();
    useCommunityPublishStore.getState().setCaptures({ thumbnails: [], glb: 'Z2xURg==' });
    expect(useCommunityPublishStore.getState().captureFailed).toBe(false);
  });

  it('clearContextPublishedId() drops only the published link', () => {
    useCommunityPublishStore.getState().open({ ...context, publishedId: 'AbCdEf123456' });
    useCommunityPublishStore.getState().clearContextPublishedId();
    const state = useCommunityPublishStore.getState();
    expect(state.context?.publishedId).toBeNull();
    expect(state.context?.designId).toBe('local-1');
  });

  it('carries a restored draft in the context', () => {
    const withDraft: CommunityPublishDesignContext = {
      ...context,
      draft: { name: 'Draft name', description: 'Draft desc', category: 'tools' },
    };
    useCommunityPublishStore.getState().open(withDraft);
    expect(useCommunityPublishStore.getState().context?.draft?.name).toBe('Draft name');
  });
});
