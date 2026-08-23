import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok, err, storageNotFound } from '@/core/result';
import { designId } from '@/core/types';
import {
  INITIAL_COMMUNITY_PUBLISH_STATE,
  useCommunityPublishStore,
} from '@/core/store/communityPublish';
import { useLabsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useSessionStore } from '@/core/sync/session/useSession';
import { hashBinParams } from '@/shared/utils/binParamsHash';
import { savePendingPublishAction } from '@/shared/utils/communityPendingAction';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '../constants';
import { useDesignerStore } from '../store/designer';
import type { SavedDesign } from '../types';
import {
  clearDesignPublishedId,
  loadDesign,
  setDesignPublishedId,
} from '../storage/DesignerStorage';
import { captureCommunityThumbnails, exportCommunityGlb } from '../utils';
import {
  openCommunityPublish,
  useCommunityPublishEntry,
  useCommunityPublishLifecycle,
} from './useCommunityPublish';

vi.mock('../storage/DesignerStorage', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    loadDesign: vi.fn(),
    setDesignPublishedId: vi.fn(),
    clearDesignPublishedId: vi.fn(),
  };
});

vi.mock('../utils', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    captureCommunityThumbnails: vi.fn(),
    exportCommunityGlb: vi.fn(),
  };
});

const readyMesh = {
  error: null,
  vertices: new Float32Array([0, 0, 0]),
  normals: new Float32Array([0, 0, 1]),
} as unknown as ReturnType<typeof useDesignerStore.getState>['generation']['mesh'];

function savedDesign(overrides: Partial<SavedDesign> = {}): SavedDesign {
  return {
    id: 'design-1',
    name: 'Screw Bin',
    params: DEFAULT_BIN_PARAMS,
    thumbnail: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    exportFileNameConfig: null,
    ...overrides,
  } as SavedDesign;
}

const qualifyingCutout = {
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
} as unknown as (typeof DEFAULT_BIN_PARAMS.cutouts)[number];

function setDesignerReady(): void {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, cutouts: [qualifyingCutout] },
    itemKind: 'bin',
    currentDesignId: 'design-1',
    designName: 'Screw Bin',
    generation: { ...DEFAULT_GENERATION_STATE, mesh: readyMesh },
  });
}

function enableFlag(enabled: boolean): void {
  useLabsStore.setState((s) => ({
    preferences: {
      ...s.preferences,
      enabledFeatures: { ...s.preferences.enabledFeatures, community_showcase: enabled },
    },
  }));
}

describe('useCommunityPublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useCommunityPublishStore.setState(INITIAL_COMMUNITY_PUBLISH_STATE);
    useToastStore.setState({ toasts: [] });
    useSessionStore.setState({ status: 'anonymous', user: null });
    setDesignerReady();
    enableFlag(true);
    vi.mocked(loadDesign).mockResolvedValue(ok(savedDesign()));
    vi.mocked(setDesignPublishedId).mockResolvedValue(ok(savedDesign()));
    vi.mocked(clearDesignPublishedId).mockResolvedValue(ok(savedDesign()));
    vi.mocked(captureCommunityThumbnails).mockResolvedValue(['data:image/webp;base64,AA==']);
    vi.mocked(exportCommunityGlb).mockResolvedValue('Z2xURg==');
  });

  describe('openCommunityPublish', () => {
    it('opens the core store with the design context and captures', async () => {
      await openCommunityPublish(null);
      const state = useCommunityPublishStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.context?.designId).toBe('design-1');
      expect(state.context?.designName).toBe('Screw Bin');
      expect(state.context?.paramsHash).toBe(
        hashBinParams({ ...DEFAULT_BIN_PARAMS, cutouts: [qualifyingCutout] })
      );
      expect(state.context?.publishedId).toBeNull();
      await waitFor(() =>
        expect(useCommunityPublishStore.getState().captures).toEqual({
          thumbnails: ['data:image/webp;base64,AA=='],
          glb: 'Z2xURg==',
        })
      );
    });

    it('opens with assembly content and frames captures from the envelope', async () => {
      useDesignerStore.setState({
        itemKind: 'assembly',
        envelope: {
          width: 2,
          depth: 2,
          gridUnitMm: 42,
          heightUnitMm: 7,
        } as unknown as ReturnType<typeof useDesignerStore.getState>['envelope'],
        structure: {
          kind: 'assembly',
          schemaVersion: 1,
          base: { floorThickness: 2 },
          mirrorAxis: 'x',
          parts: [
            {
              id: 'p1',
              type: 'post',
              params: { diameter: 8, height: 40 },
              transform: { x: 42, y: 42, seatZ: 0, rotZDeg: 0 },
              children: [],
            },
          ],
        } as unknown as ReturnType<typeof useDesignerStore.getState>['structure'],
      });

      await openCommunityPublish(null);

      const context = useCommunityPublishStore.getState().context;
      expect(context?.kind).toBe('assembly');
      expect(context?.params).toBeUndefined();
      expect(context?.envelope).toMatchObject({ width: 2, depth: 2 });
      expect(context?.structure).toMatchObject({ kind: 'assembly' });
      expect(context?.paramsHash).toMatch(/^[0-9a-f]{8}$/);
      // 40mm post + socket + 2mm floor = 7 units frames the capture height.
      expect(vi.mocked(captureCommunityThumbnails)).toHaveBeenCalledWith(
        expect.objectContaining({ width: 2, depth: 2, height: 7 })
      );
    });

    it('still refuses kinds with no publishable content', async () => {
      useDesignerStore.setState({ itemKind: 'importedMesh' });
      await openCommunityPublish(null);
      expect(useCommunityPublishStore.getState().isOpen).toBe(false);
    });

    it('reads publishedId and lineage from the saved design', async () => {
      const lineage = {
        parentId: 'Parent123456',
        rootId: 'Parent123456',
        parentName: 'Parent',
        parentAuthorName: 'Alice',
        rootAuthorName: 'Alice',
      };
      vi.mocked(loadDesign).mockResolvedValue(
        ok(savedDesign({ publishedId: 'Pub123456789', lineage }))
      );
      await openCommunityPublish(null);
      const context = useCommunityPublishStore.getState().context;
      expect(context?.publishedId).toBe('Pub123456789');
      expect(context?.lineage).toEqual(lineage);
    });

    it('handlers persist and clear the publishedId on the local design', async () => {
      await openCommunityPublish(null);
      const handlers = useCommunityPublishStore.getState().handlers;
      await expect(handlers?.onPublished('NewId1234567')).resolves.toBe(true);
      expect(setDesignPublishedId).toHaveBeenCalledWith('design-1', 'NewId1234567');
      handlers?.onUnpublished();
      expect(clearDesignPublishedId).toHaveBeenCalledWith('design-1');
    });

    it('onPublished retries a failed local save once and reports persistent failure', async () => {
      await openCommunityPublish(null);
      const handlers = useCommunityPublishStore.getState().handlers;
      vi.mocked(setDesignPublishedId)
        .mockResolvedValueOnce(err(storageNotFound('design-1')))
        .mockResolvedValueOnce(ok(savedDesign()));
      await expect(handlers?.onPublished('NewId1234567')).resolves.toBe(true);
      expect(setDesignPublishedId).toHaveBeenCalledTimes(2);

      vi.mocked(setDesignPublishedId).mockResolvedValue(err(storageNotFound('design-1')));
      await expect(handlers?.onPublished('NewId1234567')).resolves.toBe(false);
    });

    it('flags a capture fault instead of leaving the preview pending forever', async () => {
      vi.mocked(exportCommunityGlb).mockResolvedValue(null);
      await openCommunityPublish(null);
      await waitFor(() => expect(useCommunityPublishStore.getState().captureFailed).toBe(true));
      expect(useCommunityPublishStore.getState().captures).toBeNull();
    });

    it('drops a late capture taken for a different design', async () => {
      let resolveGlb: (value: string | null) => void = () => undefined;
      vi.mocked(exportCommunityGlb).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGlb = resolve;
        })
      );
      await openCommunityPublish(null);

      useDesignerStore.setState({ currentDesignId: 'design-2', designName: 'Other Bin' });
      vi.mocked(loadDesign).mockResolvedValue(ok(savedDesign({ id: designId('design-2') })));
      vi.mocked(exportCommunityGlb).mockResolvedValue('T3RoZXI=');
      await openCommunityPublish(null);
      await waitFor(() =>
        expect(useCommunityPublishStore.getState().captures?.glb).toBe('T3RoZXI=')
      );

      resolveGlb('Z2xURg==');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(useCommunityPublishStore.getState().captures?.glb).toBe('T3RoZXI=');
    });

    it('drops a stale capture from a previous open of the same design', async () => {
      let resolveGlb: (value: string | null) => void = () => undefined;
      vi.mocked(exportCommunityGlb).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGlb = resolve;
        })
      );
      await openCommunityPublish(null);

      useCommunityPublishStore.getState().close();
      vi.mocked(exportCommunityGlb).mockResolvedValue('RnJlc2g=');
      await openCommunityPublish(null);
      await waitFor(() =>
        expect(useCommunityPublishStore.getState().captures?.glb).toBe('RnJlc2g=')
      );

      resolveGlb('U3RhbGU=');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(useCommunityPublishStore.getState().captures?.glb).toBe('RnJlc2g=');
    });

    it('does not capture while the designer shows a different design', async () => {
      await openCommunityPublish(null);
      await waitFor(() => expect(useCommunityPublishStore.getState().captures).not.toBeNull());
      vi.mocked(captureCommunityThumbnails).mockClear();

      useDesignerStore.setState({ currentDesignId: 'design-2' });
      useCommunityPublishStore.getState().handlers?.requestRecapture();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(captureCommunityThumbnails).not.toHaveBeenCalled();
    });

    it('requestRecapture re-runs the capture pipeline', async () => {
      await openCommunityPublish(null);
      await waitFor(() => expect(captureCommunityThumbnails).toHaveBeenCalledTimes(1));
      useCommunityPublishStore.getState().handlers?.requestRecapture();
      await waitFor(() => expect(captureCommunityThumbnails).toHaveBeenCalledTimes(2));
    });

    it('does nothing without a current design id', async () => {
      useDesignerStore.setState({ currentDesignId: null });
      await openCommunityPublish(null);
      expect(useCommunityPublishStore.getState().isOpen).toBe(false);
    });

    it('leaves captures null when the mesh is not ready', async () => {
      useDesignerStore.setState({ generation: { ...DEFAULT_GENERATION_STATE, mesh: null } });
      await openCommunityPublish(null);
      expect(useCommunityPublishStore.getState().isOpen).toBe(true);
      expect(useCommunityPublishStore.getState().captures).toBeNull();
      expect(captureCommunityThumbnails).not.toHaveBeenCalled();
    });
  });

  describe('useCommunityPublishEntry', () => {
    it('is visible with the flag on and publishable with a ready mesh', () => {
      const { result } = renderHook(() => useCommunityPublishEntry());
      expect(result.current.publishVisible).toBe(true);
      expect(result.current.canPublish).toBe(true);
    });

    it('is hidden when the flag is off', () => {
      enableFlag(false);
      const { result } = renderHook(() => useCommunityPublishEntry());
      expect(result.current.publishVisible).toBe(false);
    });

    it('cannot publish while the mesh is missing', () => {
      useDesignerStore.setState({ generation: { ...DEFAULT_GENERATION_STATE, mesh: null } });
      const { result } = renderHook(() => useCommunityPublishEntry());
      expect(result.current.canPublish).toBe(false);
    });

    it('publishes a bin that uses no particular feature', () => {
      // The showcase takes any bin the designer can make; nothing about which
      // features it uses is a gate.
      useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, cutouts: [] } });
      const { result } = renderHook(() => useCommunityPublishEntry());
      expect(result.current.canPublish).toBe(true);
    });
  });

  describe('useCommunityPublishLifecycle', () => {
    it('captures automatically when the dialog is open without captures and the mesh is ready', async () => {
      useCommunityPublishStore.getState().open({
        designId: 'design-1',
        designName: 'Screw Bin',
        params: DEFAULT_BIN_PARAMS,
        paramsHash: 'x',
        publishedId: null,
        lineage: null,
        draft: null,
      });
      renderHook(() => useCommunityPublishLifecycle());
      await waitFor(() => expect(useCommunityPublishStore.getState().captures).not.toBeNull());
    });

    it('resumes a pending publish after OAuth when authenticated', async () => {
      savePendingPublishAction({
        designId: 'design-1',
        returnSurface: 'designer',
        draft: { name: 'Draft Bin', description: 'notes', category: 'tools' },
      });
      useSessionStore.setState({
        status: 'authenticated',
        user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
      });
      renderHook(() => useCommunityPublishLifecycle());
      await waitFor(() => expect(useCommunityPublishStore.getState().isOpen).toBe(true));
      expect(useCommunityPublishStore.getState().context?.draft?.name).toBe('Draft Bin');
    });

    it('drops the pending action with a toast when the session resolves anonymous', async () => {
      savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
      useSessionStore.setState({ status: 'anonymous', user: null });
      renderHook(() => useCommunityPublishLifecycle());
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(useCommunityPublishStore.getState().isOpen).toBe(false);
      expect(sessionStorage.getItem('gridfinity-community-pending-publish-v1')).toBeNull();
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('drops the pending action with a toast when the design no longer exists locally', async () => {
      savePendingPublishAction({ designId: 'design-gone', returnSurface: 'designer' });
      useSessionStore.setState({
        status: 'authenticated',
        user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
      });
      vi.mocked(loadDesign).mockResolvedValue(err(storageNotFound('design-gone')));
      renderHook(() => useCommunityPublishLifecycle());
      await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
      expect(useCommunityPublishStore.getState().isOpen).toBe(false);
    });

    it('keeps waiting when the design exists but has not loaded yet', async () => {
      savePendingPublishAction({ designId: 'design-later', returnSurface: 'designer' });
      useSessionStore.setState({
        status: 'authenticated',
        user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
      });
      vi.mocked(loadDesign).mockResolvedValue(ok(savedDesign({ id: designId('design-later') })));
      renderHook(() => useCommunityPublishLifecycle());
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(useToastStore.getState().toasts).toHaveLength(0);
      expect(useCommunityPublishStore.getState().isOpen).toBe(false);

      useDesignerStore.setState({ currentDesignId: 'design-later' });
      await waitFor(() => expect(useCommunityPublishStore.getState().isOpen).toBe(true));
    });

    it('does not consume the pending action while the flag is off', () => {
      enableFlag(false);
      savePendingPublishAction({ designId: 'design-1', returnSurface: 'designer' });
      useSessionStore.setState({
        status: 'authenticated',
        user: { userId: 'u1', provider: 'google', email: 'a@b.c' },
      });
      renderHook(() => useCommunityPublishLifecycle());
      expect(sessionStorage.getItem('gridfinity-community-pending-publish-v1')).not.toBeNull();
      expect(useCommunityPublishStore.getState().isOpen).toBe(false);
    });
  });
});
