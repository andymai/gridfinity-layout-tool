/**
 * Mobile capture page (`/scan/:token`): the shared scan flow, uploading the
 * outlines to the scan session the desktop is polling.
 */

import { useCallback } from 'react';
import {
  ScanCaptureFlow,
  type ScanUseOutcome,
} from '@/shared/scanReview/components/ScanCaptureFlow';

interface ScanPageProps {
  readonly token: string;
}

export function ScanPage({ token }: ScanPageProps) {
  const upload = useCallback(
    async (svg: string): Promise<ScanUseOutcome> => {
      try {
        const res = await fetch(`/api/scan-session/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ svg }),
        });
        if (res.ok) return { kind: 'sent' };
        return {
          kind: 'error',
          messageKey: res.status === 404 ? 'scan.error.expired' : 'scan.error.send',
        };
      } catch {
        return { kind: 'error', messageKey: 'scan.error.send' };
      }
    },
    [token]
  );
  return <ScanCaptureFlow layout="page" onUse={upload} />;
}
