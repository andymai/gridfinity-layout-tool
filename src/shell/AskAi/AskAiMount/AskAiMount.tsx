import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { useAskAiStore } from '@/features/ask-ai/store/askAiStore';
import { Dialog } from '@/design-system';
import { getEnglishTranslation, useTranslation } from '@/i18n';
import { jumpToHelpTarget } from '@/shared/help/helpJumpDispatcher';
import { PanelErrorBoundary } from '@/shared/components/PanelErrorBoundary';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { TabletPanelOverlay } from '@/shell/Tablet/TabletPanelOverlay';
import { findLabelTarget, layoutLabelTargets } from '../labelTargets';

const AskAiPanel = lazyWithRetry(() =>
  import('@/features/ask-ai/components/AskAiPanel').then(namedExport('AskAiPanel'))
);

export interface AskAiMountProps {
  readonly variant: 'desktop' | 'tablet' | 'phone';
  /** Tablet: the left panel holds the controls that a label shows. */
  readonly onShowSidebar?: () => void;
  /** Tablet: Ask AI and the inspector share the right edge. */
  readonly onOpen?: () => void;
}

/**
 * Ask AI in the layout editor: a column beside the editor on a desktop, an
 * overlay on a tablet, and a sheet on a phone. A label in an answer shows its
 * control where the sidebar is on screen; a phone has no sidebar.
 */
export function AskAiMount({ variant, onShowSidebar, onOpen }: AskAiMountProps) {
  const t = useTranslation();
  const open = useAskAiStore((s) => s.open);
  const setOpen = useAskAiStore((s) => s.setOpen);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (open) onOpen?.();
  }, [open, onOpen]);

  const findControl = useMemo(() => {
    if (variant === 'phone') return undefined;
    const targets = layoutLabelTargets();
    return (label: string): (() => void) | null => {
      const target = findLabelTarget(label, targets, (key) => [t(key), getEnglishTranslation(key)]);
      return target ? () => void jumpToHelpTarget(target) : null;
    };
  }, [variant, t]);

  const onLeave = useCallback(
    (to: 'control' | 'plan') => {
      if (variant === 'desktop') return;
      close();
      if (to === 'control') onShowSidebar?.();
    },
    [variant, close, onShowSidebar]
  );

  const panel = (kind: 'docked' | 'overlay' | 'sheet') => (
    <PanelErrorBoundary panelName="Ask AI">
      <Suspense fallback={null}>
        <AskAiPanel variant={kind} onClose={close} findControl={findControl} onLeave={onLeave} />
      </Suspense>
    </PanelErrorBoundary>
  );

  if (variant === 'desktop') return open ? panel('docked') : null;
  if (variant === 'tablet') {
    return (
      <TabletPanelOverlay isOpen={open} onClose={close} side="right">
        {open && panel('overlay')}
      </TabletPanelOverlay>
    );
  }
  return (
    <Dialog.Root
      open={open}
      onClose={close}
      fullScreen="mobile"
      mobilePresentation="sheet"
      aria-label={t('askAi.title')}
    >
      <Dialog.Header title={t('askAi.title')} closeAriaLabel={t('askAi.close')} />
      <Dialog.Body padding="none" className="flex min-h-0 flex-1 flex-col">
        {open && panel('sheet')}
      </Dialog.Body>
    </Dialog.Root>
  );
}
