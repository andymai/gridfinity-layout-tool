/**
 * Vercel Edge Middleware for shared layout OG tag injection.
 *
 * Intercepts `/l/*` requests from social media bots and search engine crawlers,
 * fetches the shared layout from Vercel Blob, and injects layout-specific
 * Open Graph and Twitter Card meta tags into the HTML response.
 *
 * Non-bot requests pass through untouched to the SPA.
 */

import { head } from '@vercel/blob';
import { isBotUserAgent, extractShareId, buildShareMeta, injectMetaTags } from './middleware-utils';

export const config = {
  matcher: ['/l/:path*'],
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const userAgent = request.headers.get('user-agent') ?? '';

  // Non-bot requests: pass through to SPA (Vercel rewrites handle this)
  if (!isBotUserAgent(userAgent)) {
    return undefined;
  }

  const url = new URL(request.url);
  const shareId = extractShareId(url.pathname);

  if (!shareId) {
    return undefined;
  }

  try {
    // Fetch share blob metadata
    const blobPath = `shares/${shareId}.json`;
    const blobInfo = await head(blobPath).catch(() => null);

    if (!blobInfo?.url) {
      // Share not found — fall through to default HTML
      return serveFallbackHtml(url);
    }

    // Fetch the actual layout data
    const blobResponse = await fetch(blobInfo.url);
    if (!blobResponse.ok) {
      return serveFallbackHtml(url);
    }

    const shareData: unknown = await blobResponse.json();

    // Extract layout from share wrapper (ShareData has { layout, ... })
    const layout =
      typeof shareData === 'object' && shareData !== null && 'layout' in shareData
        ? (shareData as Record<string, unknown>).layout
        : shareData;

    const meta = buildShareMeta(layout);

    // Fetch the origin index.html
    const originUrl = `${url.origin}/index.html`;
    const htmlResponse = await fetch(originUrl);

    if (!htmlResponse.ok) {
      return undefined;
    }

    const html = await htmlResponse.text();
    const injectedHtml = injectMetaTags(html, {
      title: meta.title,
      description: meta.description,
      url: url.href,
    });

    return new Response(injectedHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch {
    // On any error, fall through to unmodified SPA
    return undefined;
  }
}

/**
 * Serve fallback HTML with noindex injected for shared layout URLs.
 * Even if the share doesn't exist, bots should see noindex.
 */
async function serveFallbackHtml(url: URL): Promise<Response | undefined> {
  try {
    const originUrl = `${url.origin}/index.html`;
    const htmlResponse = await fetch(originUrl);
    if (!htmlResponse.ok) return undefined;

    const html = await htmlResponse.text();
    const injectedHtml = injectMetaTags(html, {
      title: 'Shared Layout | Gridfinity Layout Tool',
      description:
        'View this shared Gridfinity drawer layout. Plan and visualize 3D printed drawer organizers.',
      url: url.href,
    });

    return new Response(injectedHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60',
      },
    });
  } catch {
    return undefined;
  }
}
