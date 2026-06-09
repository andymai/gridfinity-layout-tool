/* eslint-disable no-console -- build script logs status to stdout */
/**
 * Post-build step: emit static HTML entry points for SPA routes that earn
 * search impressions (/designer, /baseplate) so crawlers and social scrapers
 * see route-specific titles, descriptions, OG tags, and structured data
 * instead of the homepage's. Each entry is the built dist/index.html with
 * head metadata and the crawler fallback content swapped; the JS bundle and
 * inline boot scripts are byte-identical (CSP hashes stay valid).
 *
 * Vercel serves static files before rewrites, so dist/designer/index.html
 * takes precedence over the `/designer -> /` SPA rewrite in vercel.json.
 *
 * Usage: runs after `vite build` (see package.json "build").
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(process.cwd(), 'dist');
const SITE_URL = 'https://gridfinitylayouttool.com';

interface RouteEntry {
  slug: string;
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  ogImageAlt: string;
  structuredData: object[];
  fallbackHtml: string;
}

const designerApp = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Gridfinity Bin Designer',
  alternateName: ['Gridfinity Bin Generator', 'Gridfinity Custom Bin Maker'],
  url: `${SITE_URL}/designer`,
  description:
    'Free online Gridfinity bin designer. Set dimensions, add compartments, label tabs, wall cutouts, and pick a base style. Real-time 3D preview, STL, STEP, and 3MF export.',
  applicationCategory: 'DesignApplication',
  applicationSubCategory: '3D Printing Tools',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript. Requires HTML5.',
  permissions: 'none',
  isAccessibleForFree: true,
  screenshot: `${SITE_URL}/images/landing/multicolor-organizer-bin.png`,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  author: { '@type': 'Person', name: 'Andy Aragon' },
  featureList: [
    'Parametric bin dimensions on the 42mm Gridfinity grid',
    'Six base attachment styles (standard, magnet, screw, magnet+screw, weighted, flat)',
    'Compartment grids up to 8 by 8 with per-wall control',
    'Label tabs, scoop ramps, and wall cutouts',
    'Honeycomb wall patterns and floor inserts',
    'Custom-shape footprints via cell mask',
    'Real-time 3D preview',
    'STL, STEP, and 3MF export',
  ],
};

const baseplateApp = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Gridfinity Baseplate Maker',
  alternateName: ['Gridfinity Baseplate Generator', 'Gridfinity Base Maker'],
  url: `${SITE_URL}/baseplate`,
  description:
    'Free online Gridfinity baseplate maker. Set grid dimensions, toggle magnet holes, add per-side edge padding, and export STL, STEP, or 3MF. Large plates split to fit your print bed.',
  applicationCategory: 'DesignApplication',
  applicationSubCategory: '3D Printing Tools',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript. Requires HTML5.',
  permissions: 'none',
  isAccessibleForFree: true,
  screenshot: `${SITE_URL}/images/landing/baseplate-preview.png`,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  author: { '@type': 'Person', name: 'Andy Aragon' },
  featureList: [
    'Any grid size on the 42mm Gridfinity standard',
    'Optional 6mm x 2mm magnet holes at grid intersections',
    'Per-side edge padding for non-integral drawers',
    'Connector styles for multi-piece plates',
    'Automatic splitting to fit your print bed',
    'STL, STEP, and 3MF export',
  ],
};

function breadcrumbs(slug: string, name: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name, item: `${SITE_URL}/${slug}` },
    ],
  };
}

const ROUTES: RouteEntry[] = [
  {
    slug: 'designer',
    title: 'Gridfinity Bin Designer — Free Custom Bin Generator',
    description:
      'Design custom Gridfinity bins in your browser: dimensions, compartments, label tabs, wall cutouts, and base styles with a real-time 3D preview. Export STL, STEP, or 3MF. Free, no account.',
    keywords:
      'gridfinity designer, gridfinity bin designer, gridfinity bin generator, custom gridfinity bin, gridfinity bin maker, gridfinity STL generator, gridfinity creator',
    ogImage: `${SITE_URL}/og/designer.png`,
    ogImageAlt:
      'Gridfinity bin designer showing a parametric storage bin with compartments in a 3D preview',
    structuredData: [designerApp, breadcrumbs('designer', 'Bin Designer')],
    fallbackHtml: `
        <h1>Gridfinity Bin Designer</h1>
        <p>Design custom Gridfinity bins in your browser. Set width, depth, and height on the 42mm grid, add compartments, label tabs, scoop ramps, and wall cutouts, then export STL, STEP, or 3MF — free, no account.</p>
        <h2>Features</h2>
        <ul>
          <li>Six base styles: standard, magnet, screw, magnet+screw, weighted, flat</li>
          <li>Compartment grids, dividers, and custom-shape footprints</li>
          <li>Label tabs, honeycomb wall patterns, and floor inserts</li>
          <li>Real-time 3D preview</li>
        </ul>
        <p>
          Learn more:
          <a href="/gridfinity-bin-generator">Bin Generator Guide</a> ·
          <a href="/what-is-gridfinity">What is Gridfinity?</a> ·
          <a href="/gridfinity-sizes">Sizes Reference</a> ·
          <a href="/">Layout Planner</a>
        </p>`,
  },
  {
    slug: 'baseplate',
    title: 'Gridfinity Baseplate Maker — Free Custom Baseplate Generator',
    description:
      'Make custom Gridfinity baseplates in your browser: any grid size, magnet holes, edge padding, and automatic print-bed splitting. Export STL, STEP, or 3MF. Free, no account.',
    keywords:
      'gridfinity baseplate maker, gridfinity baseplate generator, custom gridfinity baseplate, gridfinity base maker, gridfinity baseplate STL, gridfinity grid maker',
    ogImage: `${SITE_URL}/og/baseplate.png`,
    ogImageAlt: 'Gridfinity baseplate maker showing a magnet-hole baseplate in a 3D preview',
    structuredData: [baseplateApp, breadcrumbs('baseplate', 'Baseplate Maker')],
    fallbackHtml: `
        <h1>Gridfinity Baseplate Maker</h1>
        <p>Generate custom Gridfinity baseplates sized to your drawer. Pick the grid dimensions, toggle 6mm x 2mm magnet holes, add per-side edge padding, and export STL, STEP, or 3MF — free, no account. Large baseplates split automatically to fit your print bed.</p>
        <h2>Features</h2>
        <ul>
          <li>Any grid size on the 42mm Gridfinity standard</li>
          <li>Magnet holes and connector styles for multi-piece plates</li>
          <li>Per-side edge padding for drawers that aren't a whole number of units</li>
          <li>Real-time 3D preview</li>
        </ul>
        <p>
          Learn more:
          <a href="/gridfinity-baseplate-generator">Baseplate Generator Guide</a> ·
          <a href="/what-is-gridfinity">What is Gridfinity?</a> ·
          <a href="/gridfinity-sizes">Sizes Reference</a> ·
          <a href="/">Layout Planner</a>
        </p>`,
  },
];

function replaceOnce(
  html: string,
  pattern: RegExp,
  replacement: string | ((...groups: string[]) => string),
  label: string
): string {
  if (!pattern.test(html)) {
    throw new Error(`build-route-entries: pattern not found for ${label}: ${String(pattern)}`);
  }
  // Wrap string replacements in a function so `$&`/`$1` sequences in page
  // copy are inserted literally instead of being interpreted by replace().
  const replacer = typeof replacement === 'string' ? (): string => replacement : replacement;
  return html.replace(pattern, replacer);
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildRouteHtml(baseHtml: string, route: RouteEntry): string {
  const url = `${SITE_URL}/${route.slug}`;
  let html = baseHtml;

  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${route.title}</title>`, 'title');
  html = replaceOnce(
    html,
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeAttr(route.description)}">`,
    'description'
  );
  html = replaceOnce(
    html,
    /<meta name="keywords" content="[^"]*">/,
    `<meta name="keywords" content="${escapeAttr(route.keywords)}">`,
    'keywords'
  );
  html = replaceOnce(
    html,
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${url}">`,
    'canonical'
  );
  html = replaceOnce(
    html,
    /<link rel="alternate" hreflang="en" href="[^"]*">/,
    `<link rel="alternate" hreflang="en" href="${url}">`,
    'hreflang en'
  );
  html = replaceOnce(
    html,
    /<link rel="alternate" hreflang="x-default" href="[^"]*">/,
    `<link rel="alternate" hreflang="x-default" href="${url}">`,
    'hreflang x-default'
  );

  const metaSwaps: Array<[string, string]> = [
    ['og:url', url],
    ['og:title', route.title],
    ['og:description', route.description],
    ['og:image', route.ogImage],
    ['og:image:alt', route.ogImageAlt],
  ];
  for (const [prop, value] of metaSwaps) {
    html = replaceOnce(
      html,
      new RegExp(`<meta property="${prop}" content="[^"]*">`),
      `<meta property="${prop}" content="${escapeAttr(value)}">`,
      prop
    );
  }

  const twitterSwaps: Array<[string, string]> = [
    ['twitter:url', url],
    ['twitter:title', route.title],
    ['twitter:description', route.description],
    ['twitter:image', route.ogImage],
    ['twitter:image:alt', route.ogImageAlt],
  ];
  for (const [name, value] of twitterSwaps) {
    html = replaceOnce(
      html,
      new RegExp(`<meta name="${name}" content="[^"]*">`),
      `<meta name="${name}" content="${escapeAttr(value)}">`,
      name
    );
  }

  // Swap all homepage JSON-LD blocks for the route's own structured data.
  const ldBlocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g);
  if (!ldBlocks || ldBlocks.length === 0) {
    throw new Error('build-route-entries: no JSON-LD blocks found in dist/index.html');
  }
  const routeLd = route.structuredData
    .map(
      (block) =>
        `<script type="application/ld+json">\n      ${JSON.stringify(block, null, 2).split('\n').join('\n      ')}\n    </script>`
    )
    .join('\n    ');
  html = html.replace(ldBlocks[0], routeLd);
  for (const block of ldBlocks.slice(1)) {
    html = html.replace(block, '');
  }

  // Swap the crawler/noscript fallback body so each route has distinct content.
  const fallbackPattern =
    /(<div id="seo-fallback"[^>]*>\s*<noscript><style>[^<]*<\/style><\/noscript>)[\s\S]*?(<\/div>\s*<\/div>\s*<\/body>)/;
  html = replaceOnce(
    html,
    fallbackPattern,
    (_match: string, open: string, close: string) => `${open}${route.fallbackHtml}\n      ${close}`,
    'seo-fallback content'
  );

  return html;
}

function main(): void {
  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('build-route-entries: dist/index.html not found — run vite build first');
  }
  const baseHtml = fs.readFileSync(indexPath, 'utf8');
  for (const route of ROUTES) {
    const outDir = path.join(DIST, route.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), buildRouteHtml(baseHtml, route));
    console.log(`✓ Wrote dist/${route.slug}/index.html`);
  }
}

main();
