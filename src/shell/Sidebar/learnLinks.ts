import type { Locale } from '@/i18n';

// Learn section: internal links to content pages. `localized` slugs have
// translated variants served under /:locale/<slug> (mirrors vercel.json); the
// newer pages are English-only and always link to the root path.
export const LEARN_LINKS: ReadonlyArray<{ slug: string; labelKey: string; localized: boolean }> = [
  { slug: 'what-is-gridfinity', labelKey: 'sidebar.learn.whatIs', localized: true },
  { slug: 'guide', labelKey: 'sidebar.learn.guide', localized: true },
  { slug: 'gridfinity-generator', labelKey: 'sidebar.learn.generator', localized: true },
  { slug: 'gridfinity-bin-generator', labelKey: 'sidebar.learn.binGenerator', localized: true },
  {
    slug: 'gridfinity-baseplate-generator',
    labelKey: 'sidebar.learn.baseplateGenerator',
    localized: true,
  },
  { slug: 'gridfinity-calculator', labelKey: 'sidebar.learn.calculator', localized: false },
  { slug: 'gridfinity-sizes', labelKey: 'sidebar.learn.sizes', localized: true },
  { slug: 'gridfinity-tool-drawer', labelKey: 'sidebar.learn.toolDrawer', localized: false },
  { slug: 'gridfinity-kitchen-drawer', labelKey: 'sidebar.learn.kitchenDrawer', localized: false },
  { slug: 'gridfinity-software', labelKey: 'sidebar.learn.software', localized: false },
];

// Locales with translated content pages (mirrors vercel.json's localized rewrite).
// `ja` has UI translations but no content pages, so it stays on English content.
const CONTENT_LOCALES = new Set<Locale>(['de', 'fr', 'es', 'pt-BR', 'nl', 'sv', 'nb', 'uk']);

/**
 * Resolves the href for a Learn link, prefixing the active locale only when the
 * slug has a translated content page and the user is not on English.
 */
export function learnHref(slug: string, localized: boolean, locale: Locale): string {
  return localized && locale !== 'en' && CONTENT_LOCALES.has(locale)
    ? `/${locale}/${slug}`
    : `/${slug}`;
}
