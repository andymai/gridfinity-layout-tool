import { defineConfig } from 'vitepress';
import type { DefaultTheme, MarkdownRenderer } from 'vitepress';
import { sidebar } from './sidebar';
import { renderUiTags } from './uiLabels';

function uiLabels(md: MarkdownRenderer): void {
  md.core.ruler.push('ui-labels', (state) => {
    const where = String((state.env as { relativePath?: string }).relativePath ?? 'docs');
    for (const token of state.tokens) {
      if (token.type === 'html_block') token.content = renderUiTags(token.content, where);
      for (const child of token.children ?? []) {
        if (child.type === 'html_inline') child.content = renderUiTags(child.content, where);
      }
    }
  });
}

const appUrl = 'https://gridfinitylayouttool.com';
const base = '/docs/';
const siteUrl = `${appUrl}/docs`;
const defaultDescription =
  'How to plan Gridfinity drawers, design custom bins and baseplates, and print them with the free Gridfinity Layout Tool.';

// Section groups have no landing page of their own, so the section crumb
// points at the group's first page.
function breadcrumbTrail(
  path: string,
  groups: DefaultTheme.SidebarItem[]
): { name: string; url: string }[] | null {
  const link = `/${path}`;
  for (const group of groups) {
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
  title: 'Gridfinity Layout Tool Docs',
  description: defaultDescription,
  lang: 'en-US',
  base,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
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
    const fullTitle = `${title} | Gridfinity Layout Tool`;
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const url = path ? `${siteUrl}/${path}` : `${siteUrl}/`;

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: fullTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:image', content: `${appUrl}/og-image.png` }],
      ['meta', { name: 'twitter:title', content: fullTitle }],
      ['meta', { name: 'twitter:description', content: description }]
    );

    if (pageData.relativePath !== 'index.md') {
      const trail = breadcrumbTrail(path, sidebar) ?? [{ name: title, url }];
      const crumbs = [{ name: 'Docs', url: `${siteUrl}/` }, ...trail];
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
    nav: [
      { text: 'Docs', link: '/introduction/what-it-does' },
      { text: 'Reference', link: '/reference/shortcuts' },
      { text: 'Community', link: `${appUrl}/community`, target: '_self' },
      { text: 'Open the app', link: `${appUrl}/`, target: '_self' },
    ],
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
  markdown: { config: uiLabels },
  sitemap: { hostname: `${siteUrl}/` },
});
