/**
 * Community route hook.
 *
 * Detects the public /community gallery route plus the /community/d/<id>
 * detail deep link and provides navigation between them. Mirrors
 * useSupportersRouting for the literal gallery path; the detail path is a
 * regex match, which the SPA-route guard's literal derivation cannot see, so
 * its Vercel rewrite is asserted explicitly in scripts/check-spa-routes.test.ts.
 *
 * The whole route is gated on the community_showcase Labs flag: while the
 * flag is off, isCommunityRoute stays false and the URL falls through to the
 * layout planner as if the Vercel rewrite did not exist.
 *
 * Nothing in the app navigates INTO this route: browsing from inside happens
 * in the gallery modal, and the route exists for arriving from outside on a
 * shared /community/d/<id> link. So there is no navigateToCommunity here —
 * only the detail-level pushes the page makes once you are already on it, and
 * the tool switcher for leaving.
 */

import { useState, useEffect, useCallback } from 'react';
import { dispatchSyntheticPopstate } from './useDesignerRouting';
import { useFeatureFlag } from './useFeatureFlag';

// Kept in lockstep with the "/community/d/:id([a-zA-Z0-9]{12})" rewrite in
// vercel.json and the 12-char ids from api/lib/communityIds.ts.
const COMMUNITY_DETAIL_RE = /^\/community\/d\/([a-zA-Z0-9]{12})\/?$/;

/** History-state marker on detail entries this hook pushed over the gallery. */
interface CommunityDetailHistoryState {
  communityRouteDetail?: boolean;
}

function isCommunityGalleryPath(): boolean {
  return window.location.pathname === '/community' || window.location.pathname === '/community/';
}

export function getCommunityDesignIdFromUrl(): string | null {
  const match = COMMUNITY_DETAIL_RE.exec(window.location.pathname);
  return match === null ? null : match[1];
}

/**
 * The detail URL for a design. Gallery cards carry it as a real href so a
 * middle-click or ctrl-click opens the design in a new tab and the browser can
 * offer "copy link address"; the plain click is still intercepted and opens the
 * overlay in place. Both hosts use it — in the modal the href is never followed
 * on a plain click, but a modified click correctly opens a new tab.
 */
export function communityDesignPath(designId: string): string {
  return `/community/d/${designId}`;
}

/**
 * The gallery's query string, making a narrowed view shareable and reload-safe.
 * Empty off the gallery path: a detail deep link carries no query of its own,
 * and the gallery's is restored from history when the detail closes.
 *
 * The meaning of these parameters belongs to the browse feature; this module
 * only owns where they live. Returned as a string so it compares by value in a
 * dependency array.
 */
export function getCommunityGalleryQuery(): string {
  return isCommunityGalleryPath() ? window.location.search.replace(/^\?/, '') : '';
}

/**
 * Mirrors the browse filters into the /community URL. Replaces rather than
 * pushes: narrowing a gallery is not navigation, and pushing would mean a
 * dozen Back presses to leave a page the user filtered a dozen times.
 *
 * replaceState fires no popstate, so this cannot feed back into the reader
 * above and the two directions never loop.
 */
export function syncCommunityGalleryQuery(query: string): void {
  if (!isCommunityGalleryPath()) return;
  if (getCommunityGalleryQuery() === query) return;
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${query === '' ? '' : `?${query}`}`
  );
}

function isCommunityPath(): boolean {
  return isCommunityGalleryPath() || getCommunityDesignIdFromUrl() !== null;
}

export function useCommunityRouting() {
  const communityEnabled = useFeatureFlag('community_showcase');
  const [isCommunityPathActive, setIsCommunityPathActive] = useState(isCommunityPath);
  const [communityDesignIdFromUrl, setCommunityDesignIdFromUrl] = useState<string | null>(
    getCommunityDesignIdFromUrl
  );
  const [communityGalleryQuery, setCommunityGalleryQuery] = useState(getCommunityGalleryQuery);

  useEffect(() => {
    const handlePopState = () => {
      setIsCommunityPathActive(isCommunityPath());
      setCommunityDesignIdFromUrl(getCommunityDesignIdFromUrl());
      setCommunityGalleryQuery(getCommunityGalleryQuery());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Push the detail deep link over the gallery (a card was opened), so
   * browser Back returns to /community with the gallery state intact.
   */
  const openCommunityDesignUrl = useCallback((designId: string) => {
    const state: CommunityDetailHistoryState = { communityRouteDetail: true };
    window.history.pushState(state, '', `/community/d/${designId}`);
    setIsCommunityPathActive(true);
    setCommunityDesignIdFromUrl(designId);
    dispatchSyntheticPopstate();
  }, []);

  /**
   * Return the URL to /community after the detail closed from the UI. Pops
   * the entry openCommunityDesignUrl pushed, keeping the history stack
   * symmetric with the gallery-to-detail push. A cold visit that landed
   * directly on the deep link has no gallery entry beneath it (no marker on
   * history.state), so the URL is replaced in place instead of leaving the
   * site.
   */
  const closeCommunityDesignUrl = useCallback(() => {
    if (getCommunityDesignIdFromUrl() === null) return;
    const state = window.history.state as CommunityDetailHistoryState | null;
    if (state?.communityRouteDetail === true) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', '/community');
    setCommunityDesignIdFromUrl(null);
    dispatchSyntheticPopstate();
  }, []);

  return {
    /** True on /community and /community/d/<id> while community_showcase is on. */
    isCommunityRoute: communityEnabled && isCommunityPathActive,
    communityDesignIdFromUrl,
    /** The gallery's raw query string; '' off the gallery path. */
    communityGalleryQuery,
    openCommunityDesignUrl,
    closeCommunityDesignUrl,
  };
}
