/**
 * Hook for sharing bin designer configurations via short codes.
 *
 * Reuses the existing share backend (Vercel Blob) with a type discriminator
 * so designer shares are stored alongside but separate from layout shares.
 */

import { useState, useCallback } from 'react';
import { ok, err, isOk, type Result } from '@/core/result';
import { generateUUID } from '@/shared/utils/uuid';
import type { BinParams } from '@/features/bin-designer/types';

/** Response from creating a designer share */
export interface DesignerShareResponse {
  readonly id: string;
  readonly url: string;
  readonly deleteToken: string;
}

/** Error from designer share operations */
export interface DesignerShareError {
  readonly code: string;
  readonly message: string;
}

/** State of the sharing operation */
export type ShareStatus = 'idle' | 'sharing' | 'loading' | 'success' | 'error';

/** The discriminated payload format stored in Blob */
interface DesignerSharePayload {
  readonly type: 'designer';
  readonly version: 1;
  readonly params: BinParams;
}

/** Create a designer share by calling the POST /api/share endpoint */
export async function createDesignerShare(
  params: BinParams
): Promise<Result<DesignerShareResponse, DesignerShareError>> {
  try {
    const shareId = generateUUID();

    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'designer',
        version: 1,
        params,
        layoutId: shareId,
        permission: 'view',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return err({
        code: data.code ?? 'SHARE_FAILED',
        message: data.error ?? 'Failed to create share',
      });
    }

    return ok({
      id: data.id,
      url: data.url,
      deleteToken: data.deleteToken,
    });
  } catch {
    return err({
      code: 'NETWORK_ERROR',
      message: 'Network error. Check your connection.',
    });
  }
}

/** Fetch a designer share by ID */
export async function fetchDesignerShare(
  id: string
): Promise<Result<BinParams, DesignerShareError>> {
  try {
    const response = await fetch(`/api/share/${id}`);
    const data = await response.json();

    if (!response.ok) {
      return err({
        code: data.code ?? 'NOT_FOUND',
        message: data.error ?? 'Share not found',
      });
    }

    // Validate it's a designer share
    const layout = data.layout as DesignerSharePayload | undefined;
    if (!layout || layout.type !== 'designer') {
      return err({
        code: 'WRONG_TYPE',
        message: 'This share is not a bin design',
      });
    }

    if (!layout.params) {
      return err({
        code: 'INVALID_DATA',
        message: 'Share data is corrupted',
      });
    }

    return ok(layout.params as BinParams);
  } catch {
    return err({
      code: 'NETWORK_ERROR',
      message: 'Network error. Check your connection.',
    });
  }
}

/** Hook for designer sharing UI state */
export function useDesignerSharing() {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const share = useCallback(async (params: BinParams) => {
    setStatus('sharing');
    setError(null);
    setShareUrl(null);

    const result = await createDesignerShare(params);

    if (isOk(result)) {
      setStatus('success');
      setShareUrl(result.value.url);
    } else {
      setStatus('error');
      setError(result.error.message);
    }
  }, []);

  const loadShared = useCallback(async (id: string): Promise<BinParams | null> => {
    setStatus('loading');
    setError(null);

    const result = await fetchDesignerShare(id);

    if (isOk(result)) {
      setStatus('success');
      return result.value;
    } else {
      setStatus('error');
      setError(result.error.message);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setShareUrl(null);
    setError(null);
  }, []);

  return { status, shareUrl, error, share, loadShared, reset };
}
