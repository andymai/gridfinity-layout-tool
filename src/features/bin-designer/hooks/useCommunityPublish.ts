/**
 * Designer-side wiring for the community publish dialog. The dialog itself
 * lives in features/community and is mounted at app level; this hook only
 * fills the core communityPublish store (context, captures, handlers), so
 * neither feature imports the other.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useCommunityPublishStore } from '@/core/store/communityPublish';
import { useToastStore } from '@/core/store/toast';
import type { CommunityPublishDraft } from '@/shared/types/community';
import { designId } from '@/core/types';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { hashBinParams, hashDesignContent } from '@/shared/utils/binParamsHash';
import { assemblyHeightUnits } from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { loadPendingPublishAction } from '@/shared/utils/communityPendingAction';
import type { PendingPublishAction } from '@/shared/utils/communityPendingAction';
import { useDesignerStore } from '../store/designer';
import type { DesignerState } from '../types';
import {
  clearDesignPublishedId,
  loadDesign,
  setDesignPublishedId,
} from '../storage/DesignerStorage';
import { captureCommunityThumbnails, exportCommunityGlb } from '../utils';

function isMeshReady(state: DesignerState): boolean {
  return (
    state.generation.mesh !== null &&
    state.generation.mesh.error === null &&
    state.generation.mesh.vertices !== null &&
    state.generation.mesh.normals !== null
  );
}

async function capturePublishAssets(): Promise<void> {
  const state = useDesignerStore.getState();
  if (!isMeshReady(state)) return;
  // Captures are async (GLB export can take seconds) and read the live
  // designer scene: capture only while the designer still shows the design
  // the dialog was opened for (browser Back can swap designs under an open
  // dialog), and deliver results only if no newer open/capture superseded
  // this attempt (epoch) and the context still matches.
  const targetDesignId = useCommunityPublishStore.getState().context?.designId ?? null;
  if (targetDesignId === null || state.currentDesignId !== targetDesignId) return;
  const epoch = useCommunityPublishStore.getState().beginCapture();
  const { params, envelope, structure } = state;
  const frame =
    state.itemKind === 'assembly' && envelope !== null && structure?.kind === 'assembly'
      ? {
          width: envelope.width,
          depth: envelope.depth,
          height: assemblyHeightUnits(
            structure,
            envelope.heightUnitMm,
            GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness
          ),
          gridUnitMm: envelope.gridUnitMm,
          heightUnitMm: envelope.heightUnitMm,
        }
      : {
          width: params.width,
          depth: params.depth,
          height: params.height,
          gridUnitMm: params.gridUnitMm,
          gridUnitMmY: params.gridUnitMmY,
          heightUnitMm: params.heightUnitMm,
        };
  const thumbnails = await captureCommunityThumbnails(frame);
  const glb = await exportCommunityGlb();
  const publish = useCommunityPublishStore.getState();
  if (!publish.isOpen) return;
  if (publish.captureEpoch !== epoch) return;
  if (publish.context === null || publish.context.designId !== targetDesignId) return;
  if (useDesignerStore.getState().currentDesignId !== targetDesignId) return;
  if (!thumbnails || !glb) {
    publish.setCaptureFailed();
    return;
  }
  publish.setCaptures({ thumbnails, glb });
}

export async function openCommunityPublish(draft: CommunityPublishDraft | null): Promise<void> {
  const state = useDesignerStore.getState();
  const assembly =
    state.itemKind === 'assembly' && state.envelope !== null && state.structure?.kind === 'assembly'
      ? { envelope: state.envelope, structure: state.structure }
      : null;
  if (state.itemKind !== 'bin' && assembly === null) return;
  const currentId = state.currentDesignId;
  if (currentId === null) return;

  let publishedId: string | null = null;
  let lineage = null;
  const saved = await loadDesign(designId(currentId));
  if (isOk(saved)) {
    publishedId = saved.value.publishedId ?? null;
    lineage = saved.value.lineage ?? null;
  }

  useCommunityPublishStore.getState().open(
    {
      designId: currentId,
      designName: state.designName,
      ...(assembly !== null
        ? { kind: 'assembly' as const, ...assembly, paramsHash: hashDesignContent(assembly) }
        : { params: state.params, paramsHash: hashBinParams(state.params) }),
      publishedId,
      lineage,
      draft,
    },
    undefined,
    {
      onPublished: async (id) => {
        const first = await setDesignPublishedId(designId(currentId), id);
        if (isOk(first)) return true;
        const retry = await setDesignPublishedId(designId(currentId), id);
        return isOk(retry);
      },
      onUnpublished: () => {
        void clearDesignPublishedId(designId(currentId));
      },
      requestRecapture: () => {
        void capturePublishAssets();
      },
    }
  );
  void capturePublishAssets();
}

export interface CommunityPublishEntry {
  publishVisible: boolean;
  canPublish: boolean;
  openPublish: () => void;
}

/**
 * Any bin the designer can produce is publishable. The gate is only that there
 * IS a bin with a ready mesh, never a judgement about which features it uses,
 * and never a disabled button explained by a `title` tooltip that does not
 * exist on touch.
 */
export function useCommunityPublishEntry(): CommunityPublishEntry {
  const publishVisible = useFeatureFlag('community_showcase');
  const canPublish = useDesignerStore(
    (s) => (s.itemKind === 'bin' || s.itemKind === 'assembly') && isMeshReady(s)
  );
  const openPublish = useCallback(() => {
    void openCommunityPublish(null);
  }, []);
  return { publishVisible, canPublish, openPublish };
}

/**
 * Mounted once by DesignerPage. Recaptures publish assets whenever the
 * dialog is open without captures and the mesh (re)becomes ready, and
 * resumes a publish that was interrupted by the OAuth redirect.
 */
export function useCommunityPublishLifecycle(): void {
  const t = useTranslation();
  const enabled = useFeatureFlag('community_showcase');
  const meshReady = useDesignerStore((s) => isMeshReady(s));
  const needsCapture = useCommunityPublishStore((s) => s.isOpen && s.captures === null);
  const contextDesignId = useCommunityPublishStore((s) => s.context?.designId ?? null);
  const sessionStatus = useSessionStore((s) => s.status);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  // undefined = not read yet; the sessionStorage record is one-shot, so it is
  // read exactly once and held here until the session status resolves.
  const pendingRef = useRef<PendingPublishAction | null | undefined>(undefined);
  const missingProbeRef = useRef(false);

  useEffect(() => {
    if (enabled && meshReady && needsCapture && currentDesignId === contextDesignId) {
      void capturePublishAssets();
    }
  }, [enabled, meshReady, needsCapture, currentDesignId, contextDesignId]);

  useEffect(() => {
    if (!enabled) return;
    if (sessionStatus === 'unknown') return;
    if (pendingRef.current === undefined) {
      pendingRef.current = loadPendingPublishAction();
    }
    const pending = pendingRef.current;
    if (pending === null) return;
    if (sessionStatus !== 'authenticated') {
      // The user came back from the OAuth redirect without a session (consent
      // cancelled); dropping the pending publish silently would look like the
      // dialog just never reopened.
      pendingRef.current = null;
      useToastStore.getState().addToast({
        message: t('community.toast.signinIncomplete'),
        type: 'info',
      });
      return;
    }
    if (currentDesignId !== pending.designId) {
      // The design may simply not have loaded yet (the return hook navigates
      // asynchronously), so keep waiting unless storage proves it is gone.
      if (!missingProbeRef.current) {
        missingProbeRef.current = true;
        void loadDesign(designId(pending.designId)).then((result) => {
          if (isOk(result)) return;
          if (result.error.code !== 'STORAGE_NOT_FOUND') return;
          if (pendingRef.current === null) return;
          pendingRef.current = null;
          useToastStore.getState().addToast({
            message: t('community.toast.publishDesignMissing'),
            type: 'error',
          });
        });
      }
      return;
    }
    pendingRef.current = null;
    void openCommunityPublish(pending.draft ?? null);
  }, [enabled, sessionStatus, currentDesignId, t]);
}
