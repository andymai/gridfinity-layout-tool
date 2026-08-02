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

const upsertRegistryEntry = vi.fn();
const registryEdgeFields = vi.fn((_params: unknown) => ({}));
vi.mock('@/features/bin-designer/store/customBinRegistry', () => ({
  upsertRegistryEntry: (...a: unknown[]) => upsertRegistryEntry(...a),
  registryEdgeFields: (params: unknown) => registryEdgeFields(params),
}));

import {
  editOriginalCommunityDesign,
  openPublishForActiveDesign,
  placeCommunityDesignInLayout,
  remixCommunityDesign,
} from './communityDesignerBridge';
import { createDefaultLayout } from '@/core/constants';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore, INITIAL_SELECTION_STATE } from '@/core/store/selection';
import { useGapFitStore } from '@/core/store/gapFit';
import { binId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';
import type { GapFitConstraint } from '@/core/store/gapFit';

const params = {
  width: 2,
  depth: 3,
  height: 6,
  gridUnitMm: 42,
  heightUnitMm: 7,
} as unknown as BinParams;

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

  describe('placeCommunityDesignInLayout', () => {
    const constraintFor = (layout = useLayoutStore.getState().layout): GapFitConstraint => ({
      maxWidth: gridUnits(3),
      maxDepth: gridUnits(3),
      maxHeight: heightUnits(12),
      gridUnitMm: layout.gridUnitMm,
      gridUnitMmY: layout.gridUnitMmY ?? layout.gridUnitMm,
      heightUnitMm: layout.heightUnitMm,
      targetPosition: { x: gridUnits(0), y: gridUnits(0), layerId: layout.layers[0].id },
    });

    const blockerAt = (x: number, y: number, width: number, depth: number): Bin => {
      const layout = useLayoutStore.getState().layout;
      return {
        id: binId('blocker'),
        layerId: layout.layers[0].id,
        x: gridUnits(x),
        y: gridUnits(y),
        width: gridUnits(width),
        depth: gridUnits(depth),
        height: heightUnits(3),
        category: layout.categories[0].id,
        label: '',
        notes: '',
      };
    };

    beforeEach(() => {
      upsertRegistryEntry.mockReset();
      registryEdgeFields.mockReset();
      registryEdgeFields.mockReturnValue({});
      const layout = createDefaultLayout();
      useLayoutStore.setState({ layout });
      useSelectionStore.setState({
        ...INITIAL_SELECTION_STATE,
        activeLayerId: layout.layers[0].id,
        activeCategoryId: layout.categories[0].id,
      });
      useGapFitStore.setState({ constraint: null });
      communityToDesign.mockResolvedValue(
        ok({ id: 'design_new', name: 'Screw Bin', updatedAt: '2026-08-02T00:00:00.000Z' })
      );
    });

    it('places the design at the gap, links it, selects it, and clears the handoff', async () => {
      useGapFitStore.getState().setConstraint(constraintFor());

      await expect(placeCommunityDesignInLayout(design)).resolves.toBe('placed');

      expect(communityToDesign).toHaveBeenCalledWith(design);
      expect(upsertRegistryEntry).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'design_new', width: 2, depth: 3, height: 6 })
      );
      const bins = useLayoutStore.getState().layout.bins;
      expect(bins).toHaveLength(1);
      expect(bins[0]).toMatchObject({
        x: 0,
        y: 0,
        width: 2,
        depth: 3,
        height: 6,
        linkedDesignId: 'design_new',
      });
      expect(useSelectionStore.getState().selectedBinIds).toEqual([bins[0].id]);
      expect(useGapFitStore.getState().constraint).toBeNull();
    });

    it('falls back to the swapped orientation when only the rotation fits', async () => {
      // Blocks the as-published 2w x 3d footprint at (0,0) but not 3w x 2d:
      // the blocker sits at y >= 2, which only the deeper orientation reaches.
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({ layout: { ...layout, bins: [blockerAt(0, 2, 2, 1)] } });
      useGapFitStore.getState().setConstraint(constraintFor());

      await expect(placeCommunityDesignInLayout(design)).resolves.toBe('placed');

      const placedBin = useLayoutStore.getState().layout.bins.find((b) => b.id !== 'blocker');
      expect(placedBin).toMatchObject({ x: 0, y: 0, width: 3, depth: 2 });
    });

    it('returns no-fit without saving anything when neither orientation fits', async () => {
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({ layout: { ...layout, bins: [blockerAt(0, 0, 1, 1)] } });
      useGapFitStore.getState().setConstraint(constraintFor());

      await expect(placeCommunityDesignInLayout(design)).resolves.toBe('no-fit');

      expect(communityToDesign).not.toHaveBeenCalled();
      expect(upsertRegistryEntry).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
      // The handoff survives a no-fit so the user can pick another design.
      expect(useGapFitStore.getState().constraint).not.toBeNull();
    });

    it('returns error when opened outside a fits-gap context', async () => {
      await expect(placeCommunityDesignInLayout(design)).resolves.toBe('error');
      expect(communityToDesign).not.toHaveBeenCalled();
    });

    it('returns error and places nothing when the local save fails', async () => {
      communityToDesign.mockResolvedValue(err({ code: 'STORAGE_WRITE_FAILED', message: 'nope' }));
      useGapFitStore.getState().setConstraint(constraintFor());

      await expect(placeCommunityDesignInLayout(design)).resolves.toBe('error');

      expect(upsertRegistryEntry).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('returns error-copy-saved when a step after the local save throws', async () => {
      upsertRegistryEntry.mockImplementation(() => {
        throw new Error('registry boom');
      });
      useGapFitStore.getState().setConstraint(constraintFor());

      await expect(placeCommunityDesignInLayout(design)).resolves.toBe('error-copy-saved');

      expect(communityToDesign).toHaveBeenCalledTimes(1);
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
      // The handoff survives so the user can place the saved copy manually.
      expect(useGapFitStore.getState().constraint).not.toBeNull();
    });

    it('returns no-fit without saving when the design uses a different height unit scale', async () => {
      const scaled: CommunityDesign = {
        ...design,
        params: { ...params, heightUnitMm: 10 },
      };
      useGapFitStore.getState().setConstraint(constraintFor());

      await expect(placeCommunityDesignInLayout(scaled)).resolves.toBe('no-fit');

      expect(communityToDesign).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
    });

    it('returns no-fit without saving when the design uses a different grid unit scale', async () => {
      const scaled: CommunityDesign = {
        ...design,
        params: { ...params, gridUnitMm: 22 },
      };
      useGapFitStore.getState().setConstraint(constraintFor());

      await expect(placeCommunityDesignInLayout(scaled)).resolves.toBe('no-fit');

      expect(communityToDesign).not.toHaveBeenCalled();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);
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
