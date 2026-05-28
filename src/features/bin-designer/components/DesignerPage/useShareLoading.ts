/**
 * Hook that handles `?share=<id>` URL parameter on mount.
 *
 * Fetches the shared design, applies it as current params, cleans the URL,
 * and exposes a loading flag for the banner.
 */

import { useState, useEffect, useRef } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useToastStore } from '@/core/store/toast';
import { isOk } from '@/core/result';
import { fetchDesignerShare } from '@/features/bin-designer/hooks/useDesignerSharing';
import { migrateParams } from '@/features/bin-designer/constants/defaults';
import { useTranslation } from '@/i18n';

export function useShareLoading(): boolean {
  const setParams = useDesignerStore((s) => s.setParams);
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const shareHandled = useRef(false);
  const [shareLoading, setShareLoading] = useState(() => {
    const id = new URLSearchParams(window.location.search).get('share');
    return Boolean(id);
  });

  useEffect(() => {
    if (shareHandled.current) return;
    shareHandled.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    if (!shareId) return;

    // Clean URL immediately (remove ?share= param)
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.pathname + url.search);

    // Load shared design
    void fetchDesignerShare(shareId).then((result) => {
      if (isOk(result)) {
        setParams(migrateParams(result.value));
        addToast({
          message: t('binDesigner.toast.sharedDesignLoaded'),
          type: 'success',
          duration: 3000,
        });
      } else {
        addToast({
          message: t('binDesigner.toast.sharedDesignLoadFailed'),
          type: 'error',
          duration: 5000,
        });
      }
      setShareLoading(false);
    });
  }, [setParams, addToast, t]);

  return shareLoading;
}
