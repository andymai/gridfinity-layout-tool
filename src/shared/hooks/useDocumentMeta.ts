/**
 * Hook that dynamically updates document meta tags based on the active layout.
 *
 * Updates `document.title`, `meta[name="description"]`, Open Graph, and Twitter Card
 * tags to reflect the current layout's name and dimensions. Falls back to generic
 * defaults when no layout is active or the layout has no name.
 *
 * Should be mounted once at the App root level.
 */

import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { getGridBins } from '@/shared/utils';
import { useTranslation } from '@/i18n';
import type { TFunction } from '@/i18n/context';

/** Maximum length for layout name in the page title */
const MAX_TITLE_NAME_LENGTH = 60;

/**
 * Build a layout-specific meta description string.
 *
 * Extracted as a pure function for testability.
 *
 * @param t - Translation function
 * @param width - Drawer width in grid units
 * @param depth - Drawer depth in grid units
 * @param binCount - Number of bins on the grid (excluding staging)
 * @param layerCount - Number of layers
 */
export function buildLayoutDescription(
  t: TFunction,
  width: number,
  depth: number,
  binCount: number,
  layerCount: number
): string {
  return t('seo.layoutDescription', {
    width: String(width),
    depth: String(depth),
    binCount: String(binCount),
    layerCount: String(layerCount),
  });
}

/** Set a meta tag's content attribute by selector. */
function setMetaContent(selector: string, content: string): void {
  document.querySelector(selector)?.setAttribute('content', content);
}

/** Check if the current URL is a shared layout route (/l/*). */
function isSharedLayoutRoute(): boolean {
  return /^\/l\//.test(window.location.pathname);
}

/** Apply title, description, and OG/Twitter meta tags to the document. */
function applyMeta(title: string, description: string): void {
  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', window.location.href);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);

  // Shared layouts should not be indexed by search engines
  setMetaContent('meta[name="robots"]', isSharedLayoutRoute() ? 'noindex' : 'index, follow');
}

export function useDocumentMeta(): void {
  const t = useTranslation();

  const { name, width, depth, bins, layerCount } = useLayoutStore(
    useShallow((state) => ({
      name: state.layout.name,
      width: state.layout.drawer.width,
      depth: state.layout.drawer.depth,
      bins: state.layout.bins,
      layerCount: state.layout.layers.length,
    }))
  );

  const activeLayoutId = useLibraryStore((state) => state.library.activeLayoutId);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const trimmedName = name.trim();

    if (activeLayoutId && trimmedName.length > 0) {
      const truncatedName =
        trimmedName.length > MAX_TITLE_NAME_LENGTH
          ? trimmedName.slice(0, MAX_TITLE_NAME_LENGTH)
          : trimmedName;

      const title = t('seo.layoutTitle', { name: truncatedName });
      const gridBins = getGridBins(bins);
      const description = buildLayoutDescription(t, width, depth, gridBins.length, layerCount);

      applyMeta(title, description);
    } else {
      // Restore defaults
      const defaultTitle = t('seo.title');
      const defaultDescription = t('seo.description');
      applyMeta(defaultTitle, defaultDescription);
    }

    // Cleanup: restore defaults on unmount
    return () => {
      if (typeof document === 'undefined') return;
      const defaultTitle = t('seo.title');
      const defaultDescription = t('seo.description');
      applyMeta(defaultTitle, defaultDescription);
    };
  }, [t, name, width, depth, bins, layerCount, activeLayoutId]);
}
