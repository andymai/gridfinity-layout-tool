/**
 * Serves `/community/d/<id>` with the design's own title, description and
 * social image injected into the app shell.
 *
 * Without this the route is a plain SPA rewrite, so every shared design link
 * unfurls as the generic site card and opens with the generic tab title — on a
 * surface whose whole purpose is being shared.
 *
 * The shell's `#seo-fallback` block is swapped for the design's own content too.
 * Injecting meta alone left every design page serving the homepage's planner
 * copy under an `<h1>Gridfinity Planner & Layout Tool</h1>`, so N designs were N
 * pages of identical text — which is why `/community/d/` was disallowed rather
 * than indexed. The body has to differ before crawling it is worth allowing.
 *
 * Indexing is gated per design by `isIndexable`, not by the route: a design
 * below the bar still gets its own title, preview and fallback copy (social
 * scrapers and the person who followed the link want those regardless) but
 * carries `noindex, follow`, so the crawl budget goes to designs someone has
 * actually used.
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
  readonly category: string;
  readonly metrics: {
    readonly width: number;
    readonly depth: number;
    readonly height: number;
    readonly gridUnitMm: number;
  };
  readonly counts: {
    readonly likes: number;
    readonly remixes: number;
    readonly prints: number;
  };
  readonly featured: boolean;
}

/** Height units are a 7mm increment, independent of the 42mm grid unit. */
const HEIGHT_UNIT_MM = 7;

/**
 * The default name a layout carries before anyone renames it. These arrive in
 * bulk and describe nothing, so they never earn an indexable page — the export
 * that prompted this work already had `/l/AAd0hpIhpNak/untitled-layout` in it.
 */
const PLACEHOLDER_NAME = /^untitled\b/i;

/**
 * Whether a design earns `index, follow`.
 *
 * Two independent bars, both required. Complete metadata means the page has
 * something to say: a real name, a render to show, and real dimensions.
 * A signal of real use means someone other than the author engaged with it —
 * exports and views are excluded deliberately, since an author generates those
 * on their own design just by working on it.
 */
export function isIndexable(design: DesignMeta): boolean {
  const name = design.name.trim();
  const complete =
    name !== '' &&
    !PLACEHOLDER_NAME.test(name) &&
    design.thumbnailUrl !== '' &&
    design.metrics.width > 0 &&
    design.metrics.depth > 0 &&
    design.metrics.height > 0;
  const used =
    design.featured ||
    design.counts.likes > 0 ||
    design.counts.prints > 0 ||
    design.counts.remixes > 0;
  return complete && used;
}

/** Grid footprint in whole units, from the millimetre size and the grid pitch. */
function gridFootprint(metrics: DesignMeta['metrics']): string | null {
  const { width, depth, height, gridUnitMm } = metrics;
  if (gridUnitMm <= 0 || width <= 0 || depth <= 0) return null;
  const w = Math.round(width / gridUnitMm);
  const d = Math.round(depth / gridUnitMm);
  if (w < 1 || d < 1) return null;
  const u = Math.round(height / HEIGHT_UNIT_MM);
  return u >= 1 ? `${w}×${d} at ${u}U` : `${w}×${d}`;
}

/**
 * The design's own crawlable copy, replacing the homepage planner text.
 *
 * Written for someone who arrived on this page cold: what the design is, how
 * big it is in both unit systems, and where to go next. The dimensions are the
 * part a snippet cannot summarise away.
 */
export function renderDesignFallback(design: DesignMeta, url: string): string {
  const name = escapeAttr(design.name.trim() === '' ? 'Untitled design' : design.name);
  const author = escapeAttr(design.authorName);
  const { width, depth, height } = design.metrics;
  const footprint = gridFootprint(design.metrics);
  const mm = width > 0 && depth > 0 ? `${width}mm × ${depth}mm × ${height}mm` : null;

  const facts: string[] = [];
  if (footprint !== null) facts.push(`<li>Grid footprint: ${footprint}</li>`);
  if (mm !== null) facts.push(`<li>Size: ${mm}</li>`);
  if (design.category !== '') facts.push(`<li>Category: ${escapeAttr(design.category)}</li>`);
  if (design.counts.prints > 0) facts.push(`<li>Print reports: ${design.counts.prints}</li>`);
  if (design.counts.remixes > 0) facts.push(`<li>Remixes: ${design.counts.remixes}</li>`);

  // Mirrors the shell: the block is display:none, and this is what reveals it
  // when JS is off. Dropping it would hide the fallback from the only visitors
  // who actually read it.
  const parts = [
    '    <noscript><style>#seo-fallback{display:block!important}</style></noscript>',
    `        <h1>${name}</h1>`,
  ];
  parts.push(
    `        <p>A Gridfinity bin design shared by ${author}, free to remix and print under CC BY 4.0.</p>`
  );
  if (design.description.trim() !== '') {
    parts.push(`        <p>${escapeAttr(truncate(design.description, 600))}</p>`);
  }
  if (design.thumbnailUrl !== '') {
    parts.push(
      `        <img src="${escapeAttr(design.thumbnailUrl)}" alt="${name}, a Gridfinity bin design by ${author}" width="384" height="384">`
    );
  }
  if (facts.length > 0) {
    parts.push(
      '        <h2>Design details</h2>',
      `        <ul>\n${facts.map((f) => `          ${f}`).join('\n')}\n        </ul>`
    );
  }
  parts.push(
    '        <p>',
    `          <a href="${escapeAttr(url)}">Open this design</a> ·`,
    '          <a href="/community">All community designs</a> ·',
    '          <a href="/designer">Bin Designer</a> ·',
    '          <a href="/gridfinity-sizes">Sizes Reference</a> ·',
    '          <a href="/">Layout Planner</a>',
    '        </p>'
  );
  return `\n${parts.join('\n')}\n      `;
}

/**
 * Schema for an indexable design. `CreativeWork` rather than `Product`: there
 * is no price, no offer and nothing for sale, and claiming otherwise invites a
 * structured-data penalty rather than a rich result.
 */
export function designJsonLd(design: DesignMeta, url: string): string {
  const graph: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': url,
    url,
    name: design.name,
    author: { '@type': 'Person', name: design.authorName },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    inLanguage: 'en',
  };
  if (design.description.trim() !== '') {
    graph.description = truncate(design.description, MAX_DESCRIPTION);
  }
  if (design.thumbnailUrl !== '') graph.image = design.thumbnailUrl;
  if (design.category !== '') graph.genre = design.category;
  if (design.counts.likes > 0) {
    graph.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/LikeAction',
      userInteractionCount: design.counts.likes,
    };
  }
  // A design name is user text, and inside a <script> block HTML escaping does
  // not apply — only the literal `</script>` matters, so a name containing one
  // would close the element and everything after it becomes markup. Escaping
  // `<` as \u003c is still valid JSON and leaves no way out of the block.
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`;
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

  const indexable = isIndexable(design);
  if (!indexable) {
    html = replaceOne(
      html,
      /<meta name="robots" content="[^"]*">/,
      '<meta name="robots" content="noindex, follow">'
    );
  }

  // The fallback carries no nested <div>, so the first close is its own. Guarded
  // by replaceOne: a shell that grew one should lose the swap, not truncate.
  // The opening tag is carried over rather than rebuilt so its inline style (the
  // display:none the shell relies on) survives verbatim. replaceOne replaces via
  // a function, so `$` in a design name stays literal and capture syntax would
  // not expand — hence the explicit concatenation.
  const fallbackOpen = /<div id="seo-fallback"[^>]*>/.exec(html)?.[0];
  if (fallbackOpen !== undefined) {
    html = replaceOne(
      html,
      /<div id="seo-fallback"[^>]*>[\s\S]*?<\/div>/,
      `${fallbackOpen}${renderDesignFallback(design, url)}</div>`
    );
  }

  // Schema only for pages Google is allowed to keep. Advertising structured
  // data on a noindex page spends nothing and claims something.
  if (indexable) {
    html = replaceOne(html, /<\/head>/, `${designJsonLd(design, url)}</head>`);
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
    category: card.category,
    // The stored record is flat; the API's nested `metrics`/`counts` shape is
    // assembled elsewhere. `prints` is optional in the record for fixture
    // ergonomics, so it needs the default here.
    metrics: {
      width: card.width,
      depth: card.depth,
      height: card.height,
      gridUnitMm: card.gridUnitMm,
    },
    counts: {
      likes: card.likes,
      remixes: card.remixes,
      prints: card.prints ?? 0,
    },
    featured: card.featured,
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
