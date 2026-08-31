import { useEffect } from 'react';
import { useTranslation } from '@/i18n';

export interface RouteMetaFlags {
  readonly isDesignerRoute: boolean;
  readonly isBaseplateRoute: boolean;
  readonly isSupportersRoute: boolean;
  readonly isCommunityRoute: boolean;
  readonly communityDesignIdFromUrl: string | null;
}

/**
 * Route-aware SEO meta. Owns title/description across SPA navigation: the i18n
 * context only re-fires on locale change, so without this an in-app jump from
 * /designer back to / would leave the generator title up. It resolves a
 * route-appropriate title/description for every route so back-navigation
 * restores the homepage meta, except on a server-rendered community design page
 * (/community/d/<id>), where the document's per-design meta is authoritative and
 * left untouched. Re-applies when the locale flips mid-session (depends on `t`).
 */
export function useRouteMeta(flags: RouteMetaFlags): void {
  const t = useTranslation();
  const {
    isDesignerRoute,
    isBaseplateRoute,
    isSupportersRoute,
    isCommunityRoute,
    communityDesignIdFromUrl,
  } = flags;
  useEffect(() => {
    // On /community/d/<id> the meta in the document is the design's own, served
    // by api/community/page.ts. Overwriting it with the gallery's generic title
    // would give every design page the same title in the rendered DOM, which is
    // what Google indexes, so the route could not be indexed at all. The server
    // value is authoritative here; leave it alone.
    //
    // Gated on isCommunityRoute as well: the design id comes straight off the
    // URL and is not flag-aware, so with community_showcase off this route falls
    // through to the planner, and skipping the swap would leave a design's title
    // over the planner UI.
    if (isCommunityRoute && communityDesignIdFromUrl !== null) return;
    const titleKey = isDesignerRoute
      ? 'seo.designer.title'
      : isBaseplateRoute
        ? 'seo.baseplate.title'
        : isSupportersRoute
          ? 'seo.supporters.title'
          : isCommunityRoute
            ? 'seo.community.title'
            : 'seo.title';
    const descKey = isDesignerRoute
      ? 'seo.designer.description'
      : isBaseplateRoute
        ? 'seo.baseplate.description'
        : isSupportersRoute
          ? 'seo.supporters.description'
          : isCommunityRoute
            ? 'seo.community.description'
            : 'seo.description';
    const title = t(titleKey);
    const desc = t(descKey);
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc);
  }, [
    isDesignerRoute,
    isBaseplateRoute,
    isSupportersRoute,
    isCommunityRoute,
    communityDesignIdFromUrl,
    t,
  ]);
}
