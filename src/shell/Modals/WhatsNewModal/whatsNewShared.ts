import { useCallback } from 'react';
import { useBinExampleGalleryStore } from '@/core/store/binExampleGallery';
import { useLabsStore } from '@/core/store/labs';
import { useViewStore } from '@/core/store/view';
import { useTranslation } from '@/i18n';
import { useBaseplateRouting } from '@/shared/hooks/useBaseplateRouting';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import type { WhatsNewAction, WhatsNewEntry, WhatsNewKind } from '@/features/whats-new';
import type { Locale } from '@/i18n/types';

/**
 * Tints the section heading that names each kind. `text-info-strong`, not
 * `text-info`: the latter measures 4.42:1 on a plain surface (see
 * design-system/variants.ts).
 */
export const KIND_COLOR: Record<WhatsNewKind, string> = {
  new: 'text-accent',
  improved: 'text-info-strong',
  fixed: 'text-success',
};

/** Runs an entry's destination, closing the modal first. */
export type Activate = (entry: WhatsNewEntry) => void;

/**
 * A Labs entry sends you to the switch that turns it on: the feature it
 * describes is unreachable until the flag is enabled.
 */
export function useDestinationLabel(entry: WhatsNewEntry): string | null {
  const t = useTranslation();
  if (entry.labs !== undefined) return t('whatsNew.action.openLabs');
  const action = entry.action;
  if (!action) return null;
  return action.kind === 'openTool'
    ? t(`whatsNew.action.openTool.${action.tool}`)
    : t(`whatsNew.action.openModal.${action.modal}`);
}

/**
 * One subscription set for the whole modal rather than one per row: the archive
 * renders every entry, so a per-row hook would read six stores 141 times.
 */
export function useEntryActivation(onNavigate: () => void): Activate {
  const setPrintModalOpen = useViewStore((state) => state.setPrintModalOpen);
  const setShowBaseplateLibrary = useViewStore((state) => state.setShowBaseplateLibrary);
  const openGallery = useBinExampleGalleryStore((state) => state.open);
  const openLabsDrawer = useLabsStore((state) => state.openDrawer);
  const { navigateToDesigner, navigateToPlanner } = useDesignerRouting();
  const { navigateToBaseplate } = useBaseplateRouting();

  const run = useCallback(
    (action: WhatsNewAction) => {
      switch (action.kind) {
        case 'openTool':
          switch (action.tool) {
            case 'layout':
              navigateToPlanner();
              return;
            case 'designer':
              navigateToDesigner();
              return;
            case 'baseplate':
              navigateToBaseplate();
              return;
            default: {
              const _exhaustive: never = action.tool;
              throw new Error(`whats-new: unknown tool ${_exhaustive as string}`);
            }
          }
        case 'openModal':
          switch (action.modal) {
            case 'baseplateLibrary':
              setShowBaseplateLibrary(true);
              return;
            case 'print':
              setPrintModalOpen(true);
              return;
            case 'designGallery':
              openGallery();
              return;
            default: {
              const _exhaustive: never = action.modal;
              throw new Error(`whats-new: unknown modal ${_exhaustive as string}`);
            }
          }
        default: {
          const _exhaustive: never = action;
          throw new Error(`whats-new: unknown action ${JSON.stringify(_exhaustive)}`);
        }
      }
    },
    [
      navigateToBaseplate,
      navigateToDesigner,
      navigateToPlanner,
      openGallery,
      setPrintModalOpen,
      setShowBaseplateLibrary,
    ]
  );

  return useCallback(
    (entry: WhatsNewEntry) => {
      onNavigate();
      if (entry.labs !== undefined) {
        openLabsDrawer();
        return;
      }
      if (entry.action) run(entry.action);
    },
    [onNavigate, openLabsDrawer, run]
  );
}

export function formatMonth(month: string, locale: Locale): string {
  const [year, m] = month.split('-');
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(Number(year), Number(m) - 1, 1)
  );
}

export function formatDay(iso: string, locale: Locale): string {
  const [year, month, day] = iso.split('-');
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
    new Date(Number(year), Number(month) - 1, Number(day))
  );
}
