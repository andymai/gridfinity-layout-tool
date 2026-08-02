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

// Kept in lockstep with AUTHOR_PUBLIC_ID_REGEX in api/community.ts (the
// 32-char hex authorPublicId derived by the publish handler).
const AUTHOR_PUBLIC_ID_RE = /^[a-f0-9]{32}$/;

const AUTHOR_PARAM = 'author';

function isCommunityGalleryPath(): boolean {
  return window.location.pathname === '/community' || window.location.pathname === '/community/';
}

export function getCommunityDesignIdFromUrl(): string | null {
  const match = COMMUNITY_DETAIL_RE.exec(window.location.pathname);
  return match === null ? null : match[1];
}

/** The `?author=` filter on /community, making the author view shareable. */
export function getCommunityAuthorIdFromUrl(): string | null {
  if (!isCommunityGalleryPath()) return null;
  const value = new URLSearchParams(window.location.search).get(AUTHOR_PARAM);
  return value !== null && AUTHOR_PUBLIC_ID_RE.test(value) ? value : null;
}

/**
 * Mirrors the browse store's author filter into the /community URL. Replaces
 * rather than pushes: filters keep no history entries of their own, matching
 * the other gallery filters. No-ops off the gallery path (a detail deep link
 * carries no query; the filter is restored when the gallery path returns).
 */
export function syncCommunityAuthorParam(authorId: string | null): void {
  if (!isCommunityGalleryPath()) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get(AUTHOR_PARAM) === authorId) return;
  if (authorId === null) params.delete(AUTHOR_PARAM);
  else params.set(AUTHOR_PARAM, authorId);
  const query = params.toString();
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
  const [communityAuthorIdFromUrl, setCommunityAuthorIdFromUrl] = useState<string | null>(
    getCommunityAuthorIdFromUrl
  );

  useEffect(() => {
    const handlePopState = () => {
      setIsCommunityPathActive(isCommunityPath());
      setCommunityDesignIdFromUrl(getCommunityDesignIdFromUrl());
      setCommunityAuthorIdFromUrl(getCommunityAuthorIdFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToCommunity = useCallback(() => {
    window.history.pushState(null, '', '/community');
    setIsCommunityPathActive(true);
    setCommunityDesignIdFromUrl(null);
    dispatchSyntheticPopstate();
  }, []);

  const navigateHome = useCallback(() => {
    window.history.pushState(null, '', '/');
    setIsCommunityPathActive(false);
    setCommunityDesignIdFromUrl(null);
    dispatchSyntheticPopstate();
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
    /** The shareable `?author=` filter, null off the gallery path or when invalid. */
    communityAuthorIdFromUrl,
    navigateToCommunity,
    navigateHome,
    openCommunityDesignUrl,
    closeCommunityDesignUrl,
  };
}
