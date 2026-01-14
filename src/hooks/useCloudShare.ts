/**
 * Hook for managing cloud share state and operations.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLibraryStore } from '../store/library';
import { useLayoutStore } from '../store/layout';
import { useUIStore } from '../store/ui';
import type { ShareExpiration, CloudShareInfo, Layout } from '../types';
import {
  createShareResult,
  updateShareResult,
  deleteShareResult,
  type ShareResponse,
} from '../api/share';
import { isOk, getUserMessage } from '../result';
import type { ApiError } from '../result';
import { copyToClipboard } from '../storage';

export type CloudShareStatus =
  | 'idle'
  | 'sharing'
  | 'updating'
  | 'deleting'
  | 'success'
  | 'error';

interface CloudShareResult {
  id: string;
  url: string;
  deleteToken: string;
  expiresAt: Date;
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
  share: (expiresInDays: ShareExpiration) => Promise<boolean>;
  update: (expiresInDays: ShareExpiration) => Promise<boolean>;
  remove: () => Promise<boolean>;
  copyUrl: () => Promise<boolean>;
  copyDeleteToken: () => Promise<boolean>;
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

  const {
    activeLayoutId,
    entries,
    authorName,
    setCloudShare,
    clearCloudShare,
    setLastShareExpiration,
  } = useLibraryStore(
    useShallow((state) => ({
      activeLayoutId: state.library.activeLayoutId,
      entries: state.library.entries,
      authorName: state.library.settings.authorName,
      setCloudShare: state.setCloudShare,
      clearCloudShare: state.clearCloudShare,
      setLastShareExpiration: state.setLastShareExpiration,
    }))
  );

  const layout = useLayoutStore((state) => state.layout);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  const targetLayoutId = layoutId ?? activeLayoutId;

  const existingShare = useMemo(() => {
    const entry = entries.find((e) => e.id === targetLayoutId);
    return entry?.cloudShare ?? null;
  }, [entries, targetLayoutId]);

  // Use stable reference time from mount to avoid re-render issues
  const [mountTime] = useState(() => Date.now());
  const hasActiveShare = useMemo(() => {
    if (!existingShare) return false;
    return existingShare.expiresAt > mountTime;
  }, [existingShare, mountTime]);

  // Clear expired share on mount
  useEffect(() => {
    if (existingShare && existingShare.expiresAt <= Date.now()) {
      clearCloudShare(targetLayoutId);
    }
  }, [existingShare, targetLayoutId, clearCloudShare]);

  const getLayoutToShare = useCallback((): Layout => {
    return layout;
  }, [layout]);

  const handleSuccess = useCallback(
    (response: ShareResponse, isUpdate: boolean) => {
      const shareInfo: CloudShareInfo = {
        id: response.id,
        deleteToken: response.deleteToken,
        sharedAt: Date.now(),
        expiresAt: new Date(response.expiresAt).getTime(),
      };

      // Save to library
      setCloudShare(targetLayoutId, shareInfo);

      setResult({
        id: response.id,
        url: response.url,
        deleteToken: response.deleteToken,
        expiresAt: new Date(response.expiresAt),
      });

      setStatus('success');
      announceToScreenReader(
        isUpdate
          ? 'Share updated successfully. Link copied to clipboard.'
          : 'Layout shared successfully. Link copied to clipboard.'
      );

      // Auto-copy URL
      copyToClipboard(response.url);
    },
    [targetLayoutId, setCloudShare, announceToScreenReader]
  );

  const handleError = useCallback(
    (err: ApiError) => {
      const message = getUserMessage(err);
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
    async (expiresInDays: ShareExpiration): Promise<boolean> => {
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

      const layoutToShare = getLayoutToShare();
      const result = await createShareResult(layoutToShare, expiresInDays, authorName);

      // Prevent state updates if component unmounted during async operation
      if (!mountedRef.current) return false;

      if (isOk(result)) {
        setLastShareExpiration(expiresInDays);
        handleSuccess(result.value, false);
        return true;
      } else {
        handleError(result.error);
        return false;
      }
    },
    [getLayoutToShare, authorName, setLastShareExpiration, handleSuccess, handleError]
  );

  const update = useCallback(
    async (expiresInDays: ShareExpiration): Promise<boolean> => {
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

      const layoutToShare = getLayoutToShare();
      const result = await updateShareResult(
        existingShare.id,
        existingShare.deleteToken,
        layoutToShare,
        expiresInDays
      );

      // Prevent state updates if component unmounted during async operation
      if (!mountedRef.current) return false;

      if (isOk(result)) {
        setLastShareExpiration(expiresInDays);
        handleSuccess(
          {
            ...result.value,
            deleteToken: existingShare.deleteToken,
          },
          true
        );
        return true;
      } else {
        // Handle specific errors
        if (result.error.code === 'API_NOT_FOUND' || result.error.code === 'API_EXPIRED') {
          // Share was deleted on server, clear local state
          clearCloudShare(targetLayoutId);
          setError({
            message: 'Previous share was deleted. Create a new share instead.',
            code: result.error.code,
          });
        } else if (result.error.code === 'API_UNAUTHORIZED') {
          // Token mismatch (shouldn't happen normally)
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
      getLayoutToShare,
      setLastShareExpiration,
      handleSuccess,
      handleError,
      clearCloudShare,
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

    const result = await deleteShareResult(existingShare.id, existingShare.deleteToken);

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
      if (result.error.code === 'API_NOT_FOUND' || result.error.code === 'API_EXPIRED') {
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
    const url = result?.url || (existingShare && `${window.location.origin}/s/${existingShare.id}`);
    if (!url) return false;

    const success = await copyToClipboard(url);
    if (success) {
      announceToScreenReader('Link copied to clipboard.');
    }
    return success;
  }, [result, existingShare, announceToScreenReader]);

  const copyDeleteToken = useCallback(async (): Promise<boolean> => {
    const token = result?.deleteToken || existingShare?.deleteToken;
    if (!token) return false;

    const success = await copyToClipboard(token);
    if (success) {
      announceToScreenReader('Delete token copied to clipboard.');
    }
    return success;
  }, [result, existingShare, announceToScreenReader]);

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
    update,
    remove,
    copyUrl,
    copyDeleteToken,
    reset,
  };
}
