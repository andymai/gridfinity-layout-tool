import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import type { MarkdownRenderer } from 'vitepress';
import { APP_URL, nav, sidebar } from './navigation.ts';
import { renderUiTags } from './uiLabels.ts';

const SCREENSHOT_TAG = /<Screenshot\s[^>]*\bid="([^"]+)"[^>]*\/>/g;
const screenshotsDir = fileURLToPath(new URL('../public/screenshots/', import.meta.url));

// A screenshot that is not captured yet shows its capture spec in dev, so
// writers see what is missing. A production build leaves it out for readers.
function dropMissingScreenshots(html: string): string {
  return html.replace(SCREENSHOT_TAG, (tag, id: string) =>
    fs.existsSync(`${screenshotsDir}${id}.png`) ? tag : ''
  );
}

function docsMarkdown(md: MarkdownRenderer): void {
  const production = process.env.NODE_ENV === 'production';
  md.core.ruler.push('docs-tags', (state) => {
    const where = (state.env as { relativePath?: string }).relativePath ?? 'docs';
    const render = (html: string): string => {
      const labelled = renderUiTags(html, where);
      return production ? dropMissingScreenshots(labelled) : labelled;
    };
    for (const token of state.tokens) {
      // VitePress makes a standalone component line a top-level html_inline token.
      if (token.type === 'html_block' || token.type === 'html_inline')
        token.content = render(token.content);
      for (const child of token.children ?? []) {
        if (child.type === 'html_inline') child.content = render(child.content);
      }
    }
  });
}

const BASE = '/docs/';
const SITE_TITLE = 'Gridfinity Layout Tool Docs';
// No trailing slash: the hosts redirect /docs/ to /docs (trailingSlash: false
// in vercel.json), so the slashed form must not be the canonical URL.
const siteUrl = `${APP_URL}/docs`;
const defaultDescription =
  'How to plan Gridfinity drawers, design custom bins and baseplates, and print them with the free Gridfinity Layout Tool.';

// Section groups have no landing page of their own, so the section crumb
// points at the group's first page.
function breadcrumbTrail(path: string): { name: string; url: string }[] | null {
  const link = `/${path}`;
  for (const group of sidebar) {
    const items = group.items ?? [];
    const found = items.find((it) => it.link === link);
    if (found?.text && items[0]?.link) {
      return [
        { name: group.text ?? 'Docs', url: `${siteUrl}${items[0].link}` },
        { name: found.text, url: `${siteUrl}${link}` },
      ];
    }
  }
  return null;
}

export default defineConfig({
  title: SITE_TITLE,
  description: defaultDescription,
  lang: 'en-US',
  base: BASE,
  cleanUrls: true,
  // The deployed builds have no usable history. Vercel clones shallow, so a
  // page not changed within the clone depth gets the date of its oldest
  // commit. The Docker build has no .git and no git binary, and VitePress
  // throws (spawnSync git ENOENT).
  lastUpdated: false,
  head: [
    // Head tags are not base-prefixed, unlike the theme logo.
    ['link', { rel: 'icon', href: `${BASE}favicon.svg`, type: 'image/svg+xml' }],
    ['link', { rel: 'apple-touch-icon', href: `${BASE}apple-touch-icon.png` }],
    ['meta', { name: 'theme-color', content: '#f59e0b' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Gridfinity Layout Tool' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  transformPageData(pageData) {
    const description =
      (pageData.frontmatter.description as string | undefined) ??
      pageData.description ??
      defaultDescription;
    const title = (pageData.frontmatter.title as string | undefined) ?? pageData.title ?? 'Docs';
    const fullTitle = title === SITE_TITLE ? SITE_TITLE : `${title} | ${SITE_TITLE}`;
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const url = path ? `${siteUrl}/${path}` : siteUrl;

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: fullTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:image', content: `${APP_URL}/og-image.png` }],
      ['meta', { property: 'og:image:width', content: '1200' }],
      ['meta', { property: 'og:image:height', content: '630' }],
      ['meta', { property: 'og:image:alt', content: fullTitle }],
      ['meta', { name: 'twitter:title', content: fullTitle }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: `${APP_URL}/og-image.png` }]
    );

    if (pageData.relativePath !== 'index.md') {
      const trail = breadcrumbTrail(path) ?? [{ name: title, url }];
      const crumbs = [{ name: 'Docs', url: siteUrl }, ...trail];
      pageData.frontmatter.head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: c.url,
          })),
        }),
      ]);
    }
  },
  themeConfig: {
    logo: { src: '/favicon.svg', alt: '' },
    siteTitle: 'Gridfinity Layout Tool',
    nav,
    sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/andymai/gridfinity-layout-tool' }],
    editLink: {
      pattern: 'https://github.com/andymai/gridfinity-layout-tool/edit/main/apps/docs/:path',
      text: 'Suggest a change to this page',
    },
    search: { provider: 'local', options: { detailedView: true } },
    outline: { level: [2, 3] },
    footer: {
      message: 'Free and open source.',
      copyright: `Copyright © 2025–${new Date().getFullYear()} Andy Aragon`,
    },
  },
  // Inline, so a label at the start of a paragraph or list item stays inside it.
  markdown: { component: { inlineTags: ['Ui'] }, config: docsMarkdown },
  sitemap: {
    hostname: `${siteUrl}/`,
    transformItems: (items) =>
      items.map((item) => (item.url === '' ? { ...item, url: siteUrl } : item)),
  },
});
