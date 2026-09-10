/** Store selections, local state and effects behind the publish dialog; the component keeps the guards, handlers and markup. */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useCommunityPublishStore } from '@/core/store/communityPublish';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import { hashBinParams } from '@/shared/utils/binParamsHash';
import { fetchCommunityCapabilities, fetchOwnDesign } from '../../api/client';
import { usePublishDialogStore } from '../../store/publishStore';
import { useOwnDesignPrefill } from './useOwnDesignPrefill';
import type { PublishFormFields } from './PublishForm';

export function usePublishDialog() {
  const t = useTranslation();
  const context = useCommunityPublishStore((s) => s.context);
  const captures = useCommunityPublishStore((s) => s.captures);
  const captureFailed = useCommunityPublishStore((s) => s.captureFailed);
  const sessionStatus = useSessionStore((s) => s.status);
  const sessionUser = useSessionStore((s) => s.user);
  const phase = usePublishDialogStore((s) => s.phase);
  const mode = usePublishDialogStore((s) => s.mode);
  const capabilities = usePublishDialogStore((s) => s.capabilities);
  const storedDisplayName = usePublishDialogStore((s) => s.displayName);
  const error = usePublishDialogStore((s) => s.error);
  const success = usePublishDialogStore((s) => s.success);

  const [lastFields, setLastFields] = useState<PublishFormFields | null>(null);
  const openedForRef = useRef<string | null>(null);
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [parentParamsHash, setParentParamsHash] = useState<string | null>(null);
  /** Null until the user touches the field, so the suggestion stays live. */
  const [editedPublicName, setEditedPublicName] = useState<string | null>(null);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLButtonElement>(null);
  const [ownerMenu, setOwnerMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
  }>({ open: false, position: { x: 0, y: 0 } });
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!context) return;
    if (openedForRef.current === context.designId) return;
    openedForRef.current = context.designId;
    usePublishDialogStore.getState().open({
      mode: context.publishedId !== null ? 'update' : 'create',
    });
  }, [context]);

  // Ask the server what it will actually accept before showing a form. The
  // publish kill switch is a deployment env var with no client-side shadow, so
  // without this the only way to discover publishing is off is to POST a
  // finished design and read the 503.
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;
    void fetchCommunityCapabilities().then((result) => {
      if (cancelled) return;
      const store = usePublishDialogStore.getState();
      if (isOk(result)) store.ready(result.value);
      else store.failProbe(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Derived, not seeded through an effect, so a session that resolves after
  // mount still supplies the suggestion. A GitHub handle is only ever a
  // suggestion for someone who has not chosen a name; a profile display name
  // never is, since it is usually a real name.
  const suggestedName =
    storedDisplayName !== ''
      ? storedDisplayName
      : sessionUser?.provider === 'github'
        ? (sessionUser.handle ?? '')
        : '';
  const publicName = editedPublicName ?? suggestedName;

  // Sign-in is no longer a phase, so the prompt is "the form was shown to
  // someone who will have to authenticate to finish".
  useEffect(() => {
    if (phase !== 'form' || sessionStatus === 'authenticated') return;
    trackEvent('community_signin_prompt_shown', { intent: 'publish' });
  }, [phase, sessionStatus]);

  // The Dialog focus trap places initial focus once at mount, but this dialog
  // stays open while `phase` swaps its whole body (loading -> form ->
  // publishing -> success). Move focus into each new phase so keyboard and
  // screen-reader users land on the fresh content instead of a detached
  // <body>. The aria-live region below announces the transition.
  useEffect(() => {
    if (phase === 'closed') return;
    const raf = requestAnimationFrame(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      const focusable = dialogEl?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const publishedId = context?.publishedId ?? null;
  const ownDesign = useOwnDesignPrefill(publishedId, sessionStatus);

  const parentId = context?.lineage?.parentId ?? null;
  useEffect(() => {
    if (parentId === null) return;
    let cancelled = false;
    void fetchOwnDesign(parentId).then((result) => {
      if (cancelled) return;
      if (isOk(result) && result.value.params !== undefined) {
        // Assembly parents skip the identical-to-parent interstitial: their
        // content hash lives server-side (B4 still rejects an unchanged remix).
        setParentParamsHash(hashBinParams(result.value.params));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  return {
    t,
    context,
    captures,
    captureFailed,
    sessionStatus,
    phase,
    mode,
    capabilities,
    storedDisplayName,
    error,
    success,
    lastFields,
    setLastFields,
    interstitialOpen,
    setInterstitialOpen,
    parentParamsHash,
    setEditedPublicName,
    unpublishOpen,
    setUnpublishOpen,
    ownerMenuRef,
    ownerMenu,
    setOwnerMenu,
    unpublishBusy,
    setUnpublishBusy,
    unpublishError,
    setUnpublishError,
    publicName,
    ownDesign,
  };
}
