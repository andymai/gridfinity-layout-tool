/**
 * Serves `/community/d/<id>` with the design's own title, description and
 * social image injected into the app shell.
 *
 * Without this the route is a plain SPA rewrite, so every shared design link
 * unfurls as the generic site card and opens with the generic tab title — on a
 * surface whose whole purpose is being shared.
 *
 * This is deliberately NOT about search indexing. `robots.txt` disallows
 * `/community/d/` until the showcase graduates from its Labs flag, and that
 * decision stands; social scrapers unfurl regardless of it, and the tab title
 * is for the person who followed the link.
 *
 * The shell is fetched from the deployment's own root rather than bundled: `/`
 * is not rewritten here, so there is no loop, and it keeps the injected page
 * byte-identical to the real shell (CSP hashes included). It is memoised per
 * warm instance and the response is CDN-cacheable, so the common path costs
 * neither the fetch nor this function.
 *
 * Any failure serves the unmodified shell. A design that cannot be read is a
 * reason to lose the preview, never the page: the SPA still boots and renders
 * the detail (or its own not-found state) client-side.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { getRedis } from '../lib/rateLimit.js';
import { logger } from '../lib/logger.js';
import { getBaseUrl, singleParam } from '../lib/shared.js';
import { readCommunityCards } from '../lib/communityStore.js';
import { readCommunityDesignBlob } from '../lib/communityStore.js';

const DESIGN_ID_REGEX = /^[a-zA-Z0-9]{12}$/;

/** Matches the og:description budget most scrapers truncate at. */
const MAX_DESCRIPTION = 200;

/**
 * Long enough that a link doing the rounds is served from the edge rather than
 * this function, short enough that renaming a design corrects itself the same
 * day. `stale-while-revalidate` keeps the slow path off the critical path.
 */
const CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=86400';

let shellPromise: Promise<string> | null = null;

function loadShell(): Promise<string> {
  shellPromise ??= fetch(`${getBaseUrl()}/`, { headers: { 'x-shell-fetch': '1' } })
    .then((response) => {
      if (!response.ok) throw new Error(`shell fetch failed: ${response.status}`);
      return response.text();
    })
    .catch((error: unknown) => {
      // Never memoise a failure: the next request should try again rather than
      // inherit a broken shell for the life of the instance.
      shellPromise = null;
      throw error;
    });
  return shellPromise;
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function truncate(value: string, max: number): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface DesignMeta {
  readonly id: string;
  readonly name: string;
  readonly authorName: string;
  readonly description: string;
  readonly thumbnailUrl: string;
}

/**
 * Replaces a tag only when the shell has exactly one of it. A shell that
 * changed shape should lose the injection, not gain a second conflicting tag —
 * two og:title tags are worse than the generic one.
 */
function replaceOne(html: string, pattern: RegExp, replacement: string): string {
  const matches = html.match(new RegExp(pattern.source, 'g'));
  if (matches === null || matches.length !== 1) return html;
  return html.replace(pattern, () => replacement);
}

export function injectDesignMeta(shell: string, design: DesignMeta, siteUrl: string): string {
  const url = `${siteUrl}/community/d/${design.id}`;
  const title = `${design.name} by ${design.authorName} — Gridfinity Community`;
  const description =
    design.description.trim() === ''
      ? `A Gridfinity bin design shared by ${design.authorName}, free to remix and print.`
      : truncate(design.description, MAX_DESCRIPTION);

  let html = shell;
  html = replaceOne(html, /<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`);
  html = replaceOne(
    html,
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeAttr(description)}">`
  );
  html = replaceOne(
    html,
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${escapeAttr(url)}">`
  );

  const swaps: Array<[string, string]> = [
    ['og:url', url],
    ['og:title', title],
    ['og:description', description],
    ['og:type', 'article'],
  ];
  // Only when the design has one: an og:image pointing at nothing unfurls
  // worse than no og:image, which falls back to the site default.
  if (design.thumbnailUrl !== '') {
    swaps.push(['og:image', design.thumbnailUrl]);
    swaps.push(['og:image:alt', `${design.name}, a Gridfinity bin design`]);
    // The shell declares the site card's 1200x630. A design's image is a 384px
    // square render, or a promoted print photo of some other shape entirely,
    // so the inherited dimensions would have scrapers reserve a box the image
    // does not fill. Dropping them lets each one measure the real thing.
    html = html
      .replace(/<meta property="og:image:width" content="[^"]*">\s*/, '')
      .replace(/<meta property="og:image:height" content="[^"]*">\s*/, '');
  }

  for (const [property, value] of swaps) {
    html = replaceOne(
      html,
      new RegExp(`<meta property="${property}" content="[^"]*">`),
      `<meta property="${property}" content="${escapeAttr(value)}">`
    );
  }
  return html;
}

async function readDesignMeta(designId: string): Promise<DesignMeta | null> {
  const redis = getRedis();
  if (!redis) return null;
  const card = (await readCommunityCards(redis, [designId]))[0] ?? null;
  // Hidden and removed designs get the generic shell: a moderated design must
  // not keep unfurling its name and picture from every link that points at it.
  if (card === null || card.status !== 'live') return null;
  const record = await readCommunityDesignBlob(designId);
  return {
    id: designId,
    name: card.name,
    authorName: card.authorName,
    description: record?.description ?? '',
    thumbnailUrl: card.thumbnailUrl,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;

  let shell: string;
  try {
    shell = await loadShell();
  } catch (error) {
    // Nothing to serve and nothing to fall back to. Let the platform's own
    // rewrite handling surface it rather than emitting a blank page.
    logger.error('community page shell fetch failed', { error: String(error) });
    res.status(500).send('');
    return;
  }

  const send = (html: string): void => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.status(200).send(html);
  };

  const designId = singleParam(req.query.id);
  if (designId === undefined || !DESIGN_ID_REGEX.test(designId)) {
    send(shell);
    return;
  }

  try {
    const design = await readDesignMeta(designId);
    send(design === null ? shell : injectDesignMeta(shell, design, getBaseUrl()));
  } catch (error) {
    logger.error('community page meta injection failed', { designId, error: String(error) });
    send(shell);
  }
}
