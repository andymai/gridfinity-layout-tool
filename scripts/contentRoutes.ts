// The prerendered content pages and their locales. Three things mirror this
// list and a drift test holds them together: the vercel.json rewrites, the
// service worker's navigation denylist in vite.config.ts, and docker/nginx.conf.
export const CONTENT_LOCALES = [
  'cs',
  'de',
  'es',
  'fr',
  'ko',
  'nb',
  'nl',
  'pl',
  'pt-BR',
  'sv',
  'uk',
  'zh-CN',
] as const;

export const CONTENT_SLUGS = [
  'what-is-gridfinity',
  'guide',
  'privacy',
  'terms',
  'gridfinity-generator',
  'gridfinity-bin-generator',
  'gridfinity-baseplate-generator',
  'gridfinity-calculator',
  'gridfinity-sizes',
  'gridfinity-tool-drawer',
  'gridfinity-kitchen-drawer',
  'gridfinity-software',
  'gridfinity-cutout-generator',
  'gridfinity-drawers',
  'gridfinity-ikea-alex',
  'gridfinity-milwaukee-packout',
  'gridfinity-ikea-kallax',
  'gridfinity-ikea-malm',
  'gridfinity-ikea-helmer',
] as const;

// Where the user docs (apps/docs) are served. The service worker's navigation
// denylist and scripts/copy-docs.ts read it; the VitePress base, the
// vercel.json docs rewrites and docker/nginx.conf repeat it, and
// check-docker-parity.test.ts holds those to it.
export const DOCS_PREFIX = '/docs';

// Workbox's NavigationRoute tests its denylist against pathname + search, so a
// query or hash may follow the prefix: /docs?utm_source=help is a docs page too.
export const DOCS_NAVIGATION = new RegExp(`^${DOCS_PREFIX}(?:[/?#]|$)`);
