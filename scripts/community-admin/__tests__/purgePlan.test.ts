import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { planPurgeCleanup } from '../lib/purgePlan';
import { communityDesignBlobPath } from '../../../api/lib/communityStore';
import type { CommunityCardRecord, CommunityDesignRecord } from '../../../api/lib/communityStore';

beforeEach(() => {
  vi.stubEnv('TOKEN_SALT', 'test-salt');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const DESIGN_ID = 'abc123DEF456';

function makeRecord(overrides: Partial<CommunityDesignRecord> = {}): CommunityDesignRecord {
  return {
    id: DESIGN_ID,
    authorPublicId: 'author-pub-id',
    authorName: 'Jane',
    name: 'Screwdriver tray',
    description: '',
    category: 'tools',
    techniques: [],
    params: {},
    metrics: { width: 2, depth: 2, height: 2, gridUnitMm: 42 },
    lineage: null,
    thumbnails: ['https://blob.example/community/thumbs/abc123DEF456-1-0.webp'],
    meshUrl: 'https://blob.example/community/meshes/abc123DEF456-1.glb',
    photos: [],
    featured: false,
    createdAt: 1,
    updatedAt: 1,
    status: 'live',
    ...overrides,
  };
}

function makeCard(overrides: Partial<CommunityCardRecord> = {}): CommunityCardRecord {
  return {
    id: DESIGN_ID,
    name: 'Screwdriver tray',
    parentId: '',
    authorPublicId: 'author-pub-id',
    authorName: 'Jane',
    category: 'tools',
    techniques: [],
    width: 2,
    depth: 2,
    height: 2,
    gridUnitMm: 42,
    thumbnailUrl: 'https://blob.example/community/thumbs/abc123DEF456-1-0.webp',
    isRemix: false,
    featured: false,
    createdAt: 1,
    updatedAt: 1,
    status: 'live',
    likes: 0,
    remixes: 0,
    exports: 0,
    ...overrides,
  };
}

describe('planPurgeCleanup', () => {
  it('enumerates the design blob, every thumbnail, and the mesh', () => {
    const record = makeRecord({
      thumbnails: [
        'https://blob.example/community/thumbs/abc123DEF456-1-0.webp',
        'https://blob.example/community/thumbs/abc123DEF456-1-1.webp',
      ],
    });
    const plan = planPurgeCleanup(DESIGN_ID, record, makeCard());

    expect(plan.blobPaths).toEqual([
      communityDesignBlobPath(DESIGN_ID),
      'https://blob.example/community/thumbs/abc123DEF456-1-0.webp',
      'https://blob.example/community/thumbs/abc123DEF456-1-1.webp',
      'https://blob.example/community/meshes/abc123DEF456-1.glb',
    ]);
  });

  it('enumerates the card hash, all three sort indexes, likes, reports, and children keys', () => {
    const plan = planPurgeCleanup(DESIGN_ID, makeRecord(), makeCard());

    expect(plan.hashKey).toBe('community:design:abc123DEF456');
    expect(plan.indexKeys.sort()).toEqual(
      ['community:index:likes', 'community:index:newest', 'community:index:remixes'].sort()
    );
    expect(plan.likesKey).toBe('community:likes:abc123DEF456');
    expect(plan.reportsKey).toBe('community:reports:abc123DEF456');
    // A15: the reason-tally hash is enumerated so a purge doesn't orphan it.
    expect(plan.reportReasonKey).toBe('community:reportReasons:abc123DEF456');
    expect(plan.childrenKey).toBe('community:children:abc123DEF456');
  });

  it('resolves the author key from the blob record', () => {
    const plan = planPurgeCleanup(DESIGN_ID, makeRecord({ authorPublicId: 'pub-xyz' }), null);
    expect(plan.authorKey).toBe('community:author:pub-xyz');
  });

  it('falls back to the card for the author key when the blob is missing', () => {
    const plan = planPurgeCleanup(DESIGN_ID, null, makeCard({ authorPublicId: 'pub-from-card' }));
    expect(plan.authorKey).toBe('community:author:pub-from-card');
    // Without the blob there are no known thumbnails/mesh to enumerate.
    expect(plan.blobPaths).toEqual([communityDesignBlobPath(DESIGN_ID)]);
  });

  it('leaves the author key null when neither the blob nor the card resolved', () => {
    const plan = planPurgeCleanup(DESIGN_ID, null, null);
    expect(plan.authorKey).toBeNull();
  });

  it('adds the parent children key only when this design is a remix', () => {
    const original = planPurgeCleanup(DESIGN_ID, makeRecord({ lineage: null }), makeCard());
    expect(original.parentChildKey).toBeNull();

    const remix = planPurgeCleanup(
      DESIGN_ID,
      makeRecord({
        lineage: {
          parentId: 'parent123ABC',
          rootId: 'parent123ABC',
          parentName: 'Original tray',
          parentAuthorName: 'Alan',
          rootAuthorName: 'Alan',
        },
      }),
      makeCard()
    );
    expect(remix.parentChildKey).toBe('community:children:parent123ABC');
  });

  it('never enumerates the child design ids that reference this design as their parent', () => {
    // "children keep snapshots": purging a design must not reach into
    // community:children:{thisId}'s members, only delete the bookkeeping set itself.
    const plan = planPurgeCleanup(DESIGN_ID, makeRecord(), makeCard());
    expect(plan.childrenKey).toBe(`community:children:${DESIGN_ID}`);
    expect(Object.keys(plan)).not.toContain('childDesignIds');
  });
});
