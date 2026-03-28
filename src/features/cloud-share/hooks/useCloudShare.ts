/**
 * Hook for managing cloud share state and operations.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLibraryStore } from '@/core/store/library';
import { useLayoutStore } from '@/core/store/layout';
import { useInteractionStore } from '@/core/store/interaction';
import type { SharePermission, CloudShareInfo, LayoutId } from '@/core/types';
import { layoutId as toLayoutId } from '@/core/types';
import {
  createShare,
  updatePermission as updateSharePermission,
  deleteShare,
  type ShareResponse,
} from '@/core/api/share';
import { isOk, getUserMessage } from '@/core/result';
import type { ApiError } from '@/core/result';
import { copyToClipboard } from '@/core/storage';
import { commandBus, createCommand } from '@/core/cqrs';
import { slugify } from '@/shared/utils/slug';
import { mlTracking } from '@/shared/analytics/useMLTracking';

export type CloudShareStatus = 'idle' | 'sharing' | 'updating' | 'deleting' | 'success' | 'error';

interface CloudShareResult {
  id: string;
  url: string;
  deleteToken: string;
  permission: SharePermission;
}

interface CloudShareError {
  message: string;
  code: string;
  retryAfter?: number;
}

interface CloudShareState {
  status: CloudShareStatus;
  result: CloudShareResult | null;
  error: CloudShareError | null;
  existingShare: CloudShareInfo | null;
  hasActiveShare: boolean;
}

interface CloudShareActions {
  share: (permission?: SharePermission) => Promise<boolean>;
  updatePermission: (permission: SharePermission) => Promise<boolean>;
  remove: () => Promise<boolean>;
  copyUrl: () => Promise<boolean>;
  reset: () => void;
}

/**
 * Hook for managing cloud share operations for a specific layout.
 * @param layoutId - Optional layout ID (defaults to active layout)
 */
export function useCloudShare(layoutId?: string): CloudShareState & CloudShareActions {
  const [status, setStatus] = useState<CloudShareStatus>('idle');
  const [result, setResult] = useState<CloudShareResult | null>(null);
  const [error, setError] = useState<CloudShareError | null>(null);

  // Track mount state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { activeLayoutId, entries, authorName, setCloudShare, clearCloudShare } = useLibraryStore(
    useShallow((state) => ({
      activeLayoutId: state.library.activeLayoutId,
      entries: state.library.entries,
      authorName: state.library.settings.authorName,
      setCloudShare: state.setCloudShare,
      clearCloudShare: state.clearCloudShare,
    }))
  );

  const layout = useLayoutStore((state) => state.layout);
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

  const targetLayoutId: LayoutId = layoutId ? toLayoutId(layoutId) : activeLayoutId;

  const existingShare = useMemo(() => {
    const entry = entries.find((e) => e.id === targetLayoutId);
    return entry?.cloudShare ?? null;
  }, [entries, targetLayoutId]);

  // Shares are now permanent, so active share is simply whether one exists
  const hasActiveShare = !!existingShare;

  const handleSuccess = useCallback(
    (response: ShareResponse) => {
      const shareInfo: CloudShareInfo = {
        id: response.id,
        deleteToken: response.deleteToken,
        sharedAt: Date.now(),
        permission: response.permission,
      };

      // Save to library
      setCloudShare(targetLayoutId, shareInfo);

      setResult({
        id: response.id,
        url: response.url,
        deleteToken: response.deleteToken,
        permission: response.permission,
      });

      setStatus('success');
      announceToScreenReader('Layout shared successfully. Link copied to clipboard.');

      // Track for ML telemetry (share is high-quality signal)
      mlTracking.trackSnapshot('share');
      mlTracking.trackQuality('shared');

      // Auto-copy URL
      void copyToClipboard(response.url);
    },
    [targetLayoutId, setCloudShare, announceToScreenReader]
  );

  const handleError = useCallback(
    (err: ApiError) => {
      const message = getUserMessage(err);
      commandBus.dispatch(
        createCommand('ui.shareFailed', { layoutId: '', error: `${err.code}: ${message}` })
      );
      setError({
        message,
        code: err.code,
        retryAfter: 'retryAfter' in err ? err.retryAfter : undefined,
      });
      setStatus('error');
      announceToScreenReader(`Share failed: ${message}`);
    },
    [announceToScreenReader]
  );

  const share = useCallback(
    async (permission: SharePermission = 'view'): Promise<boolean> => {
      if (!navigator.onLine) {
        setError({
          message: "You're offline. Connect to the internet to share.",
          code: 'NETWORK_ERROR',
        });
        setStatus('error');
        return false;
      }

      setStatus('sharing');
      setError(null);

      const result = await createShare(targetLayoutId, layout, permission, authorName);

      // Prevent state updates if component unmounted during async operation
      if (!mountedRef.current) return false;

      if (isOk(result)) {
        handleSuccess(result.value);
        commandBus.dispatch(createCommand('ui.featureUsed', { feature: 'cloud_share' }));
        return true;
      } else {
        handleError(result.error);
        return false;
      }
    },
    [targetLayoutId, layout, authorName, handleSuccess, handleError]
  );

  const updatePermissionAction = useCallback(
    async (permission: SharePermission): Promise<boolean> => {
      if (!existingShare) {
        setError({
          message: 'No existing share to update.',
          code: 'NOT_FOUND',
        });
        setStatus('error');
        return false;
      }

      if (!navigator.onLine) {
        setError({
          message: "You're offline. Connect to the internet to update.",
          code: 'NETWORK_ERROR',
        });
        setStatus('error');
        return false;
      }

      setStatus('updating');
      setError(null);

      const result = await updateSharePermission(
        existingShare.id,
        existingShare.deleteToken,
        permission
      );

      // Prevent state updates if component unmounted during async operation
      if (!mountedRef.current) return false;

      if (isOk(result)) {
        // Update local share info with new permission
        const shareInfo: CloudShareInfo = {
          ...existingShare,
          permission: result.value.permission,
          lastUpdatedAt: Date.now(),
        };
        setCloudShare(targetLayoutId, shareInfo);

        setResult({
          id: result.value.id,
          url: result.value.url,
          deleteToken: existingShare.deleteToken,
          permission: result.value.permission,
        });

        setStatus('success');
        announceToScreenReader(
          permission === 'edit'
            ? 'Share updated. Anyone with the link can now edit.'
            : 'Share updated. Anyone with the link can view.'
        );
        return true;
      } else {
        // Handle specific errors
        if (result.error.code === 'API_NOT_FOUND') {
          clearCloudShare(targetLayoutId);
          setError({
            message: 'Share was deleted. Create a new share instead.',
            code: result.error.code,
          });
        } else if (result.error.code === 'API_UNAUTHORIZED') {
          clearCloudShare(targetLayoutId);
          setError({
            message: 'Unable to update share. Create a new share instead.',
            code: result.error.code,
          });
        } else {
          handleError(result.error);
        }
        setStatus('error');
        return false;
      }
    },
    [
      existingShare,
      targetLayoutId,
      setCloudShare,
      clearCloudShare,
      handleError,
      announceToScreenReader,
    ]
  );

  const remove = useCallback(async (): Promise<boolean> => {
    if (!existingShare) {
      return false;
    }

    if (!navigator.onLine) {
      setError({
        message: "You're offline. Connect to the internet to delete.",
        code: 'NETWORK_ERROR',
      });
      setStatus('error');
      return false;
    }

    setStatus('deleting');
    setError(null);

    const result = await deleteShare(existingShare.id, existingShare.deleteToken);

    // Prevent state updates if component unmounted during async operation
    if (!mountedRef.current) return false;

    if (isOk(result)) {
      clearCloudShare(targetLayoutId);
      setStatus('idle');
      setResult(null);
      announceToScreenReader('Share deleted successfully.');
      return true;
    } else {
      // If not found, it's already deleted - clear local state
      if (result.error.code === 'API_NOT_FOUND') {
        clearCloudShare(targetLayoutId);
        setStatus('idle');
        setResult(null);
        return true;
      }
      handleError(result.error);
      return false;
    }
  }, [existingShare, targetLayoutId, clearCloudShare, handleError, announceToScreenReader]);

  const copyUrl = useCallback(async (): Promise<boolean> => {
    // Construct URL using unified /l/{shareId}/{slug} format
    const shareId = result?.id || existingShare?.id;
    if (!shareId) return false;

    const url = `${window.location.origin}/l/${shareId}/${slugify(layout.name)}`;
    const success = await copyToClipboard(url);
    if (success) {
      announceToScreenReader('Link copied to clipboard.');
    }
    return success;
  }, [result, existingShare, layout.name, announceToScreenReader]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return {
    status,
    result,
    error,
    existingShare,
    hasActiveShare,
    share,
    updatePermission: updatePermissionAction,
    remove,
    copyUrl,
    reset,
  };
}
