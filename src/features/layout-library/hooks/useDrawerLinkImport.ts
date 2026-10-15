import { useEffect, useRef, useState } from 'react';
import { createLayoutWithSettings } from '@/core/constants';
import { isErr } from '@/core/result';
import { useLayoutStore, useLibraryStore, useSettingsStore, useToastStore } from '@/core/store';
import { createLayoutEntry, saveLayoutWithMetadata } from '@/core/storage';
import type { Layout, LayoutId } from '@/core/types';
import { layoutId as toLayoutId } from '@/core/types';
import { trackLayoutAction } from '@/shared/analytics/posthog';
import { useLayoutActivation } from '@/shared/hooks/useLayoutActivation';
import {
  buildDrawerLinkLayout,
  clearDrawerLinkFromURL,
  isFirstVisitLayout,
  parseDrawerLink,
} from '@/shared/utils/drawerLink';
import type { DrawerLinkSpec } from '@/shared/utils/drawerLink';
import { setLayoutURL } from '@/shared/utils/url';
import { useLocale, useTranslation } from '@/i18n';

export interface DrawerLinkImportOptions {
  /** Share links and collaboration sessions own the URL; a drawer link yields to them. */
  readonly disabled: boolean;
  /** Rewrite the address to the planner's `/l/{id}` form once the layout opens. */
  readonly syncLayoutUrl: boolean;
}

const formatMm = (value: number): string => String(Math.round(value * 10) / 10);

/**
 * Opens a layout sized to the drawer a `?drawer=` link describes (see
 * `parseDrawerLink`). The empty layout a first visit seeds is resized in place;
 * anyone with work of their own gets a new layout and keeps everything else.
 *
 * Returns whether the page opened on a drawer link, for prompts that should not
 * cover an arrival that came for something specific.
 */
export function useDrawerLinkImport({ disabled, syncLayoutUrl }: DrawerLinkImportOptions): boolean {
  const t = useTranslation();
  const { isReady } = useLocale();
  const [link] = useState(() => parseDrawerLink(window.location.search));
  const handled = useRef(false);
  const { activateLayout } = useLayoutActivation();

  useEffect(() => {
    // The layout name is stored, so it has to wait for real translations.
    if (link === null || disabled || !isReady || handled.current) return;
    handled.current = true;
    clearDrawerLinkFromURL();

    const addToast = useToastStore.getState().addToast;
    if (isErr(link)) {
      addToast(t('toast.drawerLinkInvalid'), 'error');
      return;
    }

    void openDrawerLink(
      link.value,
      t('layout.drawerLinkName', {
        width: formatMm(link.value.widthMm),
        depth: formatMm(link.value.depthMm),
      })
    ).then((opened) => {
      if (opened === 'invalid') {
        addToast(t('toast.drawerLinkInvalid'), 'error');
        return;
      }
      if (opened === 'failed') {
        addToast(t('toast.layoutCreateFailed'), 'error');
        return;
      }
      activateLayout(opened.layout, opened.id);
      if (syncLayoutUrl) setLayoutURL(opened.id, opened.layout.name, false);
      trackLayoutAction('created', 'drawer_link');
      addToast(
        t('toast.drawerLinkOpened', {
          width: opened.layout.drawer.width,
          depth: opened.layout.drawer.depth,
        }),
        'success'
      );
    });
  }, [link, disabled, isReady, syncLayoutUrl, activateLayout, t]);

  return link !== null;
}

async function openDrawerLink(
  spec: DrawerLinkSpec,
  fallbackName: string
): Promise<{ id: LayoutId; layout: Layout } | 'invalid' | 'failed'> {
  const library = useLibraryStore.getState().library;
  const current = useLayoutStore.getState().layout;
  const reuse = isFirstVisitLayout(library, current, performance.timeOrigin);
  const base = reuse ? current : createLayoutWithSettings(useSettingsStore.getState().settings);

  const built = buildDrawerLinkLayout(base, spec, fallbackName);
  if (isErr(built)) return 'invalid';
  const layout = built.value;

  if (reuse) {
    const saved = await saveLayoutWithMetadata(library.activeLayoutId, layout, library);
    if (isErr(saved)) return 'failed';
    useLibraryStore.getState().setLibrary(saved.value.library);
    return { id: library.activeLayoutId, layout };
  }

  const created = await createLayoutEntry(layout, library, {
    name: layout.name,
    author: library.settings.authorName,
    activate: true,
  });
  if (isErr(created)) return 'failed';
  useLibraryStore.getState().setLibrary(created.value.library);
  return { id: toLayoutId(created.value.layoutId), layout: created.value.layout };
}
