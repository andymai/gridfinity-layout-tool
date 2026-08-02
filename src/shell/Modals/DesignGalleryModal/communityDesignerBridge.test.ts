import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '@/core/result';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesign } from '@/shared/types/community';

const communityToDesign = vi.fn();
vi.mock('@/features/bin-designer/utils/communityToDesign', () => ({
  communityToDesign: (...a: unknown[]) => communityToDesign(...a),
}));

const findLocalDesignByPublishedId = vi.fn();
vi.mock('@/features/bin-designer/utils/findLocalDesignByPublishedId', () => ({
  findLocalDesignByPublishedId: (...a: unknown[]) => findLocalDesignByPublishedId(...a),
}));

const setActiveDesignId = vi.fn();
const getActiveDesignId = vi.fn();
const loadStoredDesign = vi.fn();
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  setActiveDesignId: (...a: unknown[]) => setActiveDesignId(...a),
  getActiveDesignId: (...a: unknown[]) => getActiveDesignId(...a),
  loadDesign: (...a: unknown[]) => loadStoredDesign(...a),
}));

const loadDesign = vi.fn();
vi.mock('@/features/bin-designer/store/designer', () => ({
  useDesignerStore: { getState: () => ({ loadDesign }) },
}));

const openCommunityPublish = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/bin-designer/hooks/useCommunityPublish', () => ({
  openCommunityPublish: (...a: unknown[]) => openCommunityPublish(...a),
}));

import {
  editOriginalCommunityDesign,
  openPublishForActiveDesign,
  remixCommunityDesign,
} from './communityDesignerBridge';

const params = { width: 2, depth: 3, height: 6 } as unknown as BinParams;

const design: CommunityDesign = {
  id: 'Abc123456789',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Jo',
  name: 'Screw Bin',
  description: '',
  category: 'tools',
  techniques: [],
  params,
  metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
  lineage: null,
  thumbnails: [],
  meshUrl: 'https://blob.example/mesh.glb',
  photos: [],
  featured: false,
  createdAt: 1000,
  updatedAt: 1000,
  status: 'live',
};

describe('communityDesignerBridge', () => {
  beforeEach(() => {
    communityToDesign.mockReset();
    findLocalDesignByPublishedId.mockReset();
    setActiveDesignId.mockReset();
    getActiveDesignId.mockReset();
    loadStoredDesign.mockReset();
    loadDesign.mockReset();
    openCommunityPublish.mockClear();
  });

  describe('remixCommunityDesign', () => {
    it('resolves true when the copy saves', async () => {
      communityToDesign.mockResolvedValue(ok({ id: 'design_new' }));
      await expect(remixCommunityDesign(design, { ownDuplicate: true })).resolves.toBe(true);
      expect(communityToDesign).toHaveBeenCalledWith(design, { ownDuplicate: true });
    });

    it('resolves false when the save fails', async () => {
      communityToDesign.mockResolvedValue(err({ code: 'x', message: 'fail' }));
      await expect(remixCommunityDesign(design)).resolves.toBe(false);
    });

    it('resolves false when the designer import throws', async () => {
      communityToDesign.mockRejectedValue(new Error('boom'));
      await expect(remixCommunityDesign(design)).resolves.toBe(false);
    });
  });

  describe('editOriginalCommunityDesign', () => {
    it('returns missing when no local design carries the published id', async () => {
      findLocalDesignByPublishedId.mockResolvedValue(null);
      await expect(editOriginalCommunityDesign(design)).resolves.toBe('missing');
      expect(loadDesign).not.toHaveBeenCalled();
      expect(openCommunityPublish).not.toHaveBeenCalled();
    });

    it('loads the local original and opens the publish dialog', async () => {
      const local = { id: 'design_local', name: 'Screw Bin', publishedId: design.id };
      findLocalDesignByPublishedId.mockResolvedValue(local);
      await expect(editOriginalCommunityDesign(design)).resolves.toBe('opened');
      expect(setActiveDesignId).toHaveBeenCalledWith('design_local');
      expect(loadDesign).toHaveBeenCalledWith(local);
      expect(openCommunityPublish).toHaveBeenCalledWith(null);
    });

    it('returns error when any step throws', async () => {
      findLocalDesignByPublishedId.mockRejectedValue(new Error('boom'));
      await expect(editOriginalCommunityDesign(design)).resolves.toBe('error');
    });
  });

  describe('openPublishForActiveDesign', () => {
    it('loads the active design into the store and opens the publish dialog', async () => {
      const local = { id: 'design_active', name: 'Screw Bin' };
      getActiveDesignId.mockReturnValue('design_active');
      loadStoredDesign.mockResolvedValue(ok(local));
      await expect(openPublishForActiveDesign()).resolves.toBe(true);
      expect(loadStoredDesign).toHaveBeenCalledWith('design_active');
      expect(loadDesign).toHaveBeenCalledWith(local);
      expect(openCommunityPublish).toHaveBeenCalledWith(null);
    });

    it('resolves false when there is no active design', async () => {
      getActiveDesignId.mockReturnValue(null);
      await expect(openPublishForActiveDesign()).resolves.toBe(false);
      expect(openCommunityPublish).not.toHaveBeenCalled();
    });

    it('resolves false when the active design fails to load', async () => {
      getActiveDesignId.mockReturnValue('design_active');
      loadStoredDesign.mockResolvedValue(err({ code: 'STORAGE_NOT_FOUND', message: 'gone' }));
      await expect(openPublishForActiveDesign()).resolves.toBe(false);
      expect(loadDesign).not.toHaveBeenCalled();
      expect(openCommunityPublish).not.toHaveBeenCalled();
    });
  });
});
