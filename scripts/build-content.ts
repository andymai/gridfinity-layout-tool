/* eslint-disable no-console */
/**
 * Build script for static content pages.
 * Converts Markdown files in content/ to HTML in public/.
 *
 * Usage: pnpm exec tsx scripts/build-content.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUTPUT_DIR = path.join(process.cwd(), 'public');
const SITE_URL = 'https://gridfinitylayouttool.com';

const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'es', 'pt-BR'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'en';

const LOCALE_LABELS: Record<Locale, { lang: string; openTool: string; siteName: string }> = {
  en: { lang: 'en', openTool: 'Open Tool', siteName: 'Gridfinity Layout Tool' },
  de: { lang: 'de', openTool: 'Tool öffnen', siteName: 'Gridfinity Layout Tool' },
  fr: { lang: 'fr', openTool: 'Ouvrir l’outil', siteName: 'Gridfinity Layout Tool' },
  es: { lang: 'es', openTool: 'Abrir herramienta', siteName: 'Gridfinity Layout Tool' },
  'pt-BR': { lang: 'pt-BR', openTool: 'Abrir ferramenta', siteName: 'Gridfinity Layout Tool' },
};

const FAQ_HEADING: Record<Locale, string> = {
  en: 'Frequently Asked Questions',
  de: 'Häufig gestellte Fragen',
  fr: 'Questions fréquentes',
  es: 'Preguntas frecuentes',
  'pt-BR': 'Perguntas frequentes',
};

const FOOTER_COPY: Record<Locale, string> = {
  en: 'Free to use.',
  de: 'Kostenlos nutzbar.',
  fr: 'Gratuit.',
  es: 'Uso gratuito.',
  'pt-BR': 'Uso gratuito.',
};

const FOOTER_LINKS: Record<
  Locale,
  {
    generator: string;
    whatIs: string;
    bin: string;
    baseplate: string;
    sizes: string;
    guide: string;
    privacy: string;
    terms: string;
  }
> = {
  en: {
    generator: 'Generator',
    whatIs: 'What is Gridfinity?',
    bin: 'Bin Generator',
    baseplate: 'Baseplate Generator',
    sizes: 'Sizes Reference',
    guide: 'Planning Guide',
    privacy: 'Privacy',
    terms: 'Terms',
  },
  de: {
    generator: 'Generator',
    whatIs: 'Was ist Gridfinity?',
    bin: 'Bin-Generator',
    baseplate: 'Grundplatten-Generator',
    sizes: 'Größenübersicht',
    guide: 'Planungsleitfaden',
    privacy: 'Datenschutz',
    terms: 'Nutzungsbedingungen',
  },
  fr: {
    generator: 'Générateur',
    whatIs: 'Qu’est-ce que Gridfinity ?',
    bin: 'Générateur de bins',
    baseplate: 'Générateur de plaques',
    sizes: 'Référence des tailles',
    guide: 'Guide de planification',
    privacy: 'Confidentialité',
    terms: 'Conditions',
  },
  es: {
    generator: 'Generador',
    whatIs: '¿Qué es Gridfinity?',
    bin: 'Generador de bins',
    baseplate: 'Generador de placas',
    sizes: 'Referencia de tamaños',
    guide: 'Guía de planificación',
    privacy: 'Privacidad',
    terms: 'Términos',
  },
  'pt-BR': {
    generator: 'Gerador',
    whatIs: 'O que é Gridfinity?',
    bin: 'Gerador de bins',
    baseplate: 'Gerador de placas',
    sizes: 'Referência de tamanhos',
    guide: 'Guia de planejamento',
    privacy: 'Privacidade',
    terms: 'Termos',
  },
};

function getUrl(slug: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? `${SITE_URL}/${slug}` : `${SITE_URL}/${locale}/${slug}`;
}

function getOutputDir(slug: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE
    ? path.join(OUTPUT_DIR, slug)
    : path.join(OUTPUT_DIR, locale, slug);
}

function localizedPath(slug: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? `/${slug}` : `/${locale}/${slug}`;
}

let cssFilename = 'content.css';

interface FaqEntry {
  q: string;
  a: string;
}

interface BreadcrumbEntry {
  name: string;
  url: string;
}

interface Frontmatter {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  schema?: 'Article' | 'HowTo';
  faqs?: FaqEntry[];
  breadcrumbs?: BreadcrumbEntry[];
}

/**
 * Generate the HTML template for a content page
 */
function generateHtml(
  content: string,
  frontmatter: Frontmatter,
  slug: string,
  locale: Locale,
  availableLocales: ReadonlySet<Locale>
): string {
  const { title, description, keywords, ogImage, schema, faqs, breadcrumbs } = frontmatter;
  const canonicalUrl = getUrl(slug, locale);
  const image = ogImage || `${SITE_URL}/og-image.png`;
  const labels = LOCALE_LABELS[locale];
  const homeUrl = locale === DEFAULT_LOCALE ? '/' : `/${locale}/`;
  const ogLocaleMap: Record<Locale, string> = {
    en: 'en_US',
    de: 'de_DE',
    fr: 'fr_FR',
    es: 'es_ES',
    'pt-BR': 'pt_BR',
  };
  const hreflangLinks = SUPPORTED_LOCALES.filter((l) => availableLocales.has(l))
    .map((l) => `  <link rel="alternate" hreflang="${l}" href="${getUrl(slug, l)}">`)
    .join('\n');
  const xDefaultLink = availableLocales.has(DEFAULT_LOCALE)
    ? `  <link rel="alternate" hreflang="x-default" href="${getUrl(slug, DEFAULT_LOCALE)}">`
    : '';

  const primarySchema =
    schema === 'HowTo'
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: title,
          description,
          image,
          url: canonicalUrl,
          author: {
            '@type': 'Person',
            name: 'Andy Aragon',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Gridfinity Layout Tool',
            url: SITE_URL,
          },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description,
          image,
          url: canonicalUrl,
          author: {
            '@type': 'Person',
            name: 'Andy Aragon',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Gridfinity Layout Tool',
            url: SITE_URL,
          },
        };

  const structuredDataBlocks: object[] = [primarySchema];

  if (breadcrumbs && breadcrumbs.length > 0) {
    structuredDataBlocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    });
  }

  const renderedFaqs = faqs?.map((faq) => ({
    q: faq.q,
    answerHtml: marked.parseInline(escapeHtml(faq.a)) as string,
  }));

  if (renderedFaqs && renderedFaqs.length > 0) {
    structuredDataBlocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: renderedFaqs.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answerHtml,
        },
      })),
    });
  }

  const structuredDataScripts = structuredDataBlocks
    .map(
      (block) => `  <script type="application/ld+json">
${safeJsonLd(block)}
  </script>`
    )
    .join('\n');

  const breadcrumbsHtml = renderBreadcrumbs(breadcrumbs);
  const faqsHtml = renderFaqs(renderedFaqs, locale);

  return `<!DOCTYPE html>
<html lang="${labels.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ${labels.siteName}</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="${escapeHtml(description)}">
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}
  <meta name="author" content="Andy Aragon">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
${hreflangLinks}
${xDefaultLink}

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)} | ${labels.siteName}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="${labels.siteName}">
  <meta property="og:locale" content="${ogLocaleMap[locale]}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)} | ${labels.siteName}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">

  <!-- Structured Data -->
${structuredDataScripts}

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">

  <!-- Styles -->
  <link rel="stylesheet" href="/${cssFilename}">

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg">
  <link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48.png">

  <!-- Mobile -->
  <meta name="theme-color" content="#0f0f12">
</head>
<body>
  <!-- Skip to content link for accessibility -->
  <a href="#main-content" class="skip-link">Skip to content</a>

  <!-- Navigation -->
  <nav class="content-nav" aria-label="Main navigation">
    <a href="${homeUrl}" class="content-nav__logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span>${labels.siteName}</span>
    </a>
    <a href="${homeUrl}" class="content-nav__cta">
      ${escapeHtml(labels.openTool)}
    </a>
  </nav>

  <!-- Main Content -->
  <main id="main-content" class="content-page content-body">
${breadcrumbsHtml}${content}${faqsHtml}
  </main>

  <!-- Footer -->
  <footer class="content-page">
    <div class="content-footer">
      <div class="content-footer__links">
        <a href="/gridfinity-generator">${escapeHtml(FOOTER_LINKS[locale].generator)}</a>
        <a href="${localizedPath('what-is-gridfinity', locale)}">${escapeHtml(FOOTER_LINKS[locale].whatIs)}</a>
        <a href="/gridfinity-bin-generator">${escapeHtml(FOOTER_LINKS[locale].bin)}</a>
        <a href="/gridfinity-baseplate-generator">${escapeHtml(FOOTER_LINKS[locale].baseplate)}</a>
        <a href="/gridfinity-sizes">${escapeHtml(FOOTER_LINKS[locale].sizes)}</a>
        <a href="${localizedPath('guide', locale)}">${escapeHtml(FOOTER_LINKS[locale].guide)}</a>
        <a href="${localizedPath('privacy', locale)}">${escapeHtml(FOOTER_LINKS[locale].privacy)}</a>
        <a href="${localizedPath('terms', locale)}">${escapeHtml(FOOTER_LINKS[locale].terms)}</a>
      </div>
      <p class="content-footer__copyright">
        © ${new Date().getFullYear()} ${labels.siteName}. ${escapeHtml(FOOTER_COPY[locale])}
      </p>
    </div>
  </footer>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely serialize JSON-LD to prevent script tag breakout
 * Escapes < and > to their Unicode equivalents
 */
function safeJsonLd(data: object): string {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function renderBreadcrumbs(breadcrumbs: BreadcrumbEntry[] | undefined): string {
  if (!breadcrumbs || breadcrumbs.length === 0) return '';
  const items = breadcrumbs
    .map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const name = escapeHtml(crumb.name);
      if (isLast) {
        return `      <li class="content-breadcrumbs__item" aria-current="page">${name}</li>`;
      }
      return `      <li class="content-breadcrumbs__item"><a href="${escapeHtml(crumb.url)}">${name}</a></li>`;
    })
    .join('\n');
  return `<nav class="content-breadcrumbs" aria-label="Breadcrumb">
    <ol class="content-breadcrumbs__list">
${items}
    </ol>
  </nav>
`;
}

interface RenderedFaq {
  q: string;
  answerHtml: string;
}

function renderFaqs(faqs: RenderedFaq[] | undefined, locale: Locale): string {
  if (!faqs || faqs.length === 0) return '';
  const items = faqs
    .map(
      (faq) => `    <details class="content-faq">
      <summary class="content-faq__question">${escapeHtml(faq.q)}</summary>
      <div class="content-faq__answer">${faq.answerHtml}</div>
    </details>`
    )
    .join('\n');
  return `
  <section class="content-faqs" aria-labelledby="faq-heading">
    <h2 id="faq-heading" class="content-h2">${escapeHtml(FAQ_HEADING[locale])}</h2>
${items}
  </section>
`;
}

/**
 * Configure marked for our needs
 */
function configureMarked(): void {
  marked.use({
    renderer: {
      // Add classes to headings
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const className = `content-h${depth}`;
        return `<h${depth} class="${className}">${text}</h${depth}>\n`;
      },
      // Add classes to lists
      list(token) {
        const type = token.ordered ? 'ol' : 'ul';
        const body = token.items.map((item) => this.listitem(item)).join('');
        return `<${type} class="content-list">${body}</${type}>\n`;
      },
      // Handle special CTA syntax: [CTA: text](url)
      link({ href, text }) {
        const safeHref = escapeHtml(href);
        const safeText = escapeHtml(text);
        if (text.startsWith('CTA:')) {
          const ctaText = text.replace('CTA:', '').trim();
          return `<a href="${safeHref}" class="content-cta">${escapeHtml(ctaText)} &rarr;</a>`;
        }
        // External links get target="_blank" and rel="noopener"
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        if (isExternal) {
          return `<a href="${safeHref}" target="_blank" rel="noopener">${safeText}</a>`;
        }
        return `<a href="${safeHref}">${safeText}</a>`;
      },
      // Convert blockquotes to styled callout boxes
      blockquote({ tokens }) {
        const content = this.parser.parse(tokens);
        return `<div class="content-callout">${content}</div>\n`;
      },
    },
  });
}

function processFile(
  filePath: string,
  slug: string,
  locale: Locale,
  availableLocales: ReadonlySet<Locale>
): void {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  const frontmatter = data as Frontmatter;

  if (!frontmatter.title || !frontmatter.description) {
    console.error(`Missing required frontmatter in ${filePath}`);
    process.exit(1);
  }

  const htmlContent = marked(content);
  const fullHtml = generateHtml(htmlContent as string, frontmatter, slug, locale, availableLocales);

  const outputPath = getOutputDir(slug, locale);
  fs.mkdirSync(outputPath, { recursive: true });
  const outputFile = path.join(outputPath, 'index.html');
  fs.writeFileSync(outputFile, fullHtml);

  console.log(`✓ Generated ${path.relative(process.cwd(), outputFile)}`);
}

interface DiscoveredEntry {
  slug: string;
  locale: Locale;
  filePath: string;
}

function discoverContent(): DiscoveredEntry[] {
  const entries: DiscoveredEntry[] = [];

  for (const f of fs.readdirSync(CONTENT_DIR).filter((n) => n.endsWith('.md'))) {
    entries.push({
      slug: path.basename(f, '.md'),
      locale: DEFAULT_LOCALE,
      filePath: path.join(CONTENT_DIR, f),
    });
  }

  for (const locale of SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
    const localeDir = path.join(CONTENT_DIR, locale);
    if (!fs.existsSync(localeDir)) continue;
    for (const f of fs.readdirSync(localeDir).filter((n) => n.endsWith('.md'))) {
      entries.push({
        slug: path.basename(f, '.md'),
        locale,
        filePath: path.join(localeDir, f),
      });
    }
  }

  return entries;
}

/**
 * Hash the CSS file and copy it with a content-based filename for cache busting
 */
function processCss(): void {
  const cssSourcePath = path.join(OUTPUT_DIR, 'content.css');

  if (!fs.existsSync(cssSourcePath)) {
    console.error('content.css not found in public/');
    process.exit(1);
  }

  const cssContent = fs.readFileSync(cssSourcePath, 'utf-8');
  const hash = crypto.createHash('md5').update(cssContent).digest('hex').slice(0, 8);
  cssFilename = `content.${hash}.css`;

  const cssDestPath = path.join(OUTPUT_DIR, cssFilename);

  // Remove old hashed CSS files
  const existingFiles = fs.readdirSync(OUTPUT_DIR);
  for (const file of existingFiles) {
    if (file.startsWith('content.') && file.endsWith('.css') && file !== 'content.css') {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  }

  // Copy CSS with hashed filename
  fs.copyFileSync(cssSourcePath, cssDestPath);
  console.log(`✓ Generated ${cssFilename}`);
}

/**
 * Main build function
 */
function build(): void {
  console.log('Building content pages...\n');

  // Configure marked
  configureMarked();

  // Check if content directory exists
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content directory found. Skipping content build.');
    return;
  }

  // Hash and copy CSS file first (sets cssFilename for HTML generation)
  processCss();

  const entries = discoverContent();
  if (entries.length === 0) {
    console.log('No markdown files found in content/');
    return;
  }

  const localesBySlug = new Map<string, Set<Locale>>();
  for (const entry of entries) {
    let locales = localesBySlug.get(entry.slug);
    if (!locales) {
      locales = new Set<Locale>();
      localesBySlug.set(entry.slug, locales);
    }
    locales.add(entry.locale);
  }

  for (const entry of entries) {
    const locales = localesBySlug.get(entry.slug) ?? new Set<Locale>();
    processFile(entry.filePath, entry.slug, entry.locale, locales);
  }

  // Update CSS filename in hand-crafted content pages
  const handCraftedPages = [
    'gridfinity-bin-generator/index.html',
    'gridfinity-baseplate-generator/index.html',
    'gridfinity-sizes/index.html',
  ];
  for (const pagePath of handCraftedPages) {
    const fullPath = path.join(OUTPUT_DIR, pagePath);
    if (fs.existsSync(fullPath)) {
      const html = fs.readFileSync(fullPath, 'utf-8');
      const updated = html.replace(/\/content\.[a-f0-9]+\.css/, `/${cssFilename}`);
      if (updated !== html) {
        fs.writeFileSync(fullPath, updated);
        console.log(`✓ Updated CSS reference in ${pagePath}`);
      }
    }
  }

  console.log(`\n✓ Built ${entries.length} content page(s) across ${localesBySlug.size} slug(s)`);
}

// Run build
build();
