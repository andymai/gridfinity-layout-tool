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
] as const;
