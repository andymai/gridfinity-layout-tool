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
import { load as loadYaml } from 'js-yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { data: {}, content: raw };
  const content = raw.slice(match[0].length);
  const parsed = loadYaml(match[1]);
  if (parsed == null) return { data: {}, content };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('frontmatter must be a YAML mapping');
  }
  return { data: parsed as Record<string, unknown>, content };
}

const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUTPUT_DIR = path.join(process.cwd(), 'public');
const SITE_URL = 'https://gridfinitylayouttool.com';

// SERP truncation guards (see PR #2292). Google shows ~60 chars of the title and
// ~155 of the description. Every content title carries a " | {siteName}" brand
// suffix that is expected to truncate, so we guard the UNIQUE title — the part
// that must stay readable — rather than the rendered length.
const MAX_TITLE_LEN = 55;
const MAX_DESCRIPTION_LEN = 155;

const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'es', 'pt-BR', 'nl', 'sv', 'nb', 'uk'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'en';

const LOCALE_LABELS: Record<Locale, { lang: string; openTool: string; siteName: string }> = {
  en: { lang: 'en', openTool: 'Open Tool', siteName: 'Gridfinity Layout Tool' },
  de: { lang: 'de', openTool: 'Tool öffnen', siteName: 'Gridfinity Layout Tool' },
  fr: { lang: 'fr', openTool: 'Ouvrir l’outil', siteName: 'Gridfinity Layout Tool' },
  es: { lang: 'es', openTool: 'Abrir herramienta', siteName: 'Gridfinity Layout Tool' },
  'pt-BR': { lang: 'pt-BR', openTool: 'Abrir ferramenta', siteName: 'Gridfinity Layout Tool' },
  nl: { lang: 'nl', openTool: 'Tool openen', siteName: 'Gridfinity Layout Tool' },
  sv: { lang: 'sv', openTool: 'Öppna verktyget', siteName: 'Gridfinity Layout Tool' },
  nb: { lang: 'nb', openTool: 'Åpne verktøy', siteName: 'Gridfinity Layout Tool' },
  uk: { lang: 'uk', openTool: 'Відкрити інструмент', siteName: 'Gridfinity Layout Tool' },
};

const FAQ_HEADING: Record<Locale, string> = {
  en: 'Frequently Asked Questions',
  de: 'Häufig gestellte Fragen',
  fr: 'Questions fréquentes',
  es: 'Preguntas frecuentes',
  'pt-BR': 'Perguntas frequentes',
  nl: 'Veelgestelde vragen',
  sv: 'Vanliga frågor',
  nb: 'Ofte stilte spørsmål',
  uk: 'Часті запитання',
};

const FOOTER_COPY: Record<Locale, string> = {
  en: 'Free to use.',
  de: 'Kostenlos nutzbar.',
  fr: 'Gratuit.',
  es: 'Uso gratuito.',
  'pt-BR': 'Uso gratuito.',
  nl: 'Gratis te gebruiken.',
  sv: 'Gratis att använda.',
  nb: 'Gratis å bruke.',
  uk: 'Безкоштовно у використанні.',
};

const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  de: 'de_DE',
  fr: 'fr_FR',
  es: 'es_ES',
  'pt-BR': 'pt_BR',
  nl: 'nl_NL',
  sv: 'sv_SE',
  nb: 'nb_NO',
  uk: 'uk_UA',
};

const NATIVE_LANGUAGE: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  'pt-BR': 'Português (BR)',
  nl: 'Nederlands',
  sv: 'Svenska',
  nb: 'Norsk',
  uk: 'Українська',
};

const LANGUAGE_LABEL: Record<Locale, string> = {
  en: 'Language',
  de: 'Sprache',
  fr: 'Langue',
  es: 'Idioma',
  'pt-BR': 'Idioma',
  nl: 'Taal',
  sv: 'Språk',
  nb: 'Språk',
  uk: 'Мова',
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
    toolDrawer: string;
    kitchen: string;
    calculator: string;
    software: string;
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
    toolDrawer: 'Tool Drawers',
    kitchen: 'Kitchen Drawers',
    calculator: 'Calculator',
    software: 'Software Comparison',
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
    toolDrawer: 'Werkzeugschubladen',
    kitchen: 'Küchenschubladen',
    calculator: 'Rechner',
    software: 'Software-Vergleich',
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
    toolDrawer: 'Tiroirs à outils',
    kitchen: 'Tiroirs de cuisine',
    calculator: 'Calculateur',
    software: 'Comparatif logiciels',
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
    toolDrawer: 'Cajones de herramientas',
    kitchen: 'Cajones de cocina',
    calculator: 'Calculadora',
    software: 'Comparativa de software',
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
    toolDrawer: 'Gavetas de ferramentas',
    kitchen: 'Gavetas de cozinha',
    calculator: 'Calculadora',
    software: 'Comparativo de softwares',
    privacy: 'Privacidade',
    terms: 'Termos',
  },
  nl: {
    generator: 'Generator',
    whatIs: 'Wat is Gridfinity?',
    bin: 'Bin-generator',
    baseplate: 'Bodemplaat-generator',
    sizes: 'Maatreferentie',
    guide: 'Planningsgids',
    toolDrawer: 'Gereedschapslades',
    kitchen: 'Keukenlades',
    calculator: 'Calculator',
    software: 'Softwarevergelijking',
    privacy: 'Privacy',
    terms: 'Voorwaarden',
  },
  sv: {
    generator: 'Generator',
    whatIs: 'Vad är Gridfinity?',
    bin: 'Bin-generator',
    baseplate: 'Bottenplatta-generator',
    sizes: 'Storleksreferens',
    guide: 'Planeringsguide',
    toolDrawer: 'Verktygslådor',
    kitchen: 'Kökslådor',
    calculator: 'Kalkylator',
    software: 'Programjämförelse',
    privacy: 'Integritet',
    terms: 'Villkor',
  },
  nb: {
    generator: 'Generator',
    whatIs: 'Hva er Gridfinity?',
    bin: 'Bin-generator',
    baseplate: 'Grunnplate-generator',
    sizes: 'Størrelsesreferanse',
    guide: 'Planleggingsveiledning',
    toolDrawer: 'Verktøyskuffer',
    kitchen: 'Kjøkkenskuffer',
    calculator: 'Kalkulator',
    software: 'Programvaresammenligning',
    privacy: 'Personvern',
    terms: 'Vilkår',
  },
  uk: {
    generator: 'Генератор',
    whatIs: 'Що таке Gridfinity?',
    bin: 'Генератор bin',
    baseplate: 'Генератор основи',
    sizes: 'Довідник розмірів',
    guide: 'Посібник з планування',
    toolDrawer: 'Шухляди для інструментів',
    kitchen: 'Кухонні шухляди',
    calculator: 'Калькулятор',
    software: 'Порівняння програм',
    privacy: 'Конфіденційність',
    terms: 'Умови',
  },
};

// Per-page OG images live at public/og/<slug>.png; locale variants share the
// English page's image. Falls back to the site-wide og-image.png when absent.
function perPageOgImage(slug: string): string | null {
  return fs.existsSync(path.join(OUTPUT_DIR, 'og', `${slug}.png`))
    ? `${SITE_URL}/og/${slug}.png`
    : null;
}

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

interface HowToStep {
  name: string;
  text: string;
}

interface HowToFrontmatter {
  name?: string;
  description?: string;
  totalTime?: string;
  tools?: string[];
  supplies?: string[];
  steps?: HowToStep[];
}

interface SoftwareApplicationFrontmatter {
  name: string;
  alternateName?: string[];
  description?: string;
  applicationCategory: string;
  applicationSubCategory?: string;
  operatingSystem?: string;
  browserRequirements?: string;
  permissions?: string;
  isAccessibleForFree?: boolean;
  offers?: {
    price: string;
    priceCurrency: string;
    availability?: string;
  };
  featureList?: string[];
}

interface NavCta {
  label: string;
  href: string;
}

interface Frontmatter {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  schema?: 'Article' | 'HowTo';
  faqs?: FaqEntry[];
  breadcrumbs?: BreadcrumbEntry[];
  howTo?: HowToFrontmatter;
  softwareApplication?: SoftwareApplicationFrontmatter;
  navCta?: NavCta;
}

function generateHtml(
  content: string,
  frontmatter: Frontmatter,
  slug: string,
  locale: Locale,
  availableLocales: ReadonlySet<Locale>
): string {
  const {
    title,
    description,
    keywords,
    ogImage,
    schema,
    faqs,
    breadcrumbs,
    howTo,
    softwareApplication,
    navCta,
  } = frontmatter;
  const canonicalUrl = getUrl(slug, locale);
  const image = ogImage || perPageOgImage(slug) || `${SITE_URL}/og-image.png`;
  const labels = LOCALE_LABELS[locale];

  const pageId = locale === DEFAULT_LOCALE ? slug : `${locale}/${slug}`;
  if (title.length > MAX_TITLE_LEN) {
    console.warn(
      `⚠ ${pageId}: title ${title.length} chars (>${MAX_TITLE_LEN}) — may truncate before the " | ${labels.siteName}" suffix in SERPs`
    );
  }
  if (description.length > MAX_DESCRIPTION_LEN) {
    console.warn(
      `⚠ ${pageId}: description ${description.length} chars (>${MAX_DESCRIPTION_LEN}) — Google truncates ~${MAX_DESCRIPTION_LEN}`
    );
  }
  // No localized SPA root (e.g. /de/) exists — the in-app i18n auto-detects
  // browser language from the canonical English SPA at /. Linking logo/CTA
  // to /{locale}/ would 404. Same pattern as the localized privacy/terms links.
  const homeUrl = '/';
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
          name: howTo?.name ?? title,
          description: howTo?.description ?? description,
          image,
          url: canonicalUrl,
          ...(howTo?.totalTime ? { totalTime: howTo.totalTime } : {}),
          ...(howTo?.tools && howTo.tools.length > 0
            ? { tool: howTo.tools.map((name) => ({ '@type': 'HowToTool', name })) }
            : {}),
          ...(howTo?.supplies && howTo.supplies.length > 0
            ? {
                supply: howTo.supplies.map((name) => ({ '@type': 'HowToSupply', name })),
              }
            : {}),
          ...(howTo?.steps && howTo.steps.length > 0
            ? {
                step: howTo.steps.map((s, i) => ({
                  '@type': 'HowToStep',
                  name: s.name,
                  text: s.text,
                  position: i + 1,
                })),
              }
            : {}),
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

  if (softwareApplication) {
    const sa = softwareApplication;
    structuredDataBlocks.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: sa.name,
      ...(sa.alternateName && sa.alternateName.length > 0
        ? { alternateName: sa.alternateName }
        : {}),
      url: canonicalUrl,
      description: sa.description ?? description,
      applicationCategory: sa.applicationCategory,
      ...(sa.applicationSubCategory ? { applicationSubCategory: sa.applicationSubCategory } : {}),
      ...(sa.operatingSystem ? { operatingSystem: sa.operatingSystem } : {}),
      ...(sa.browserRequirements ? { browserRequirements: sa.browserRequirements } : {}),
      ...(sa.permissions ? { permissions: sa.permissions } : {}),
      ...(sa.isAccessibleForFree !== undefined
        ? { isAccessibleForFree: sa.isAccessibleForFree }
        : {}),
      ...(sa.offers
        ? {
            offers: {
              '@type': 'Offer',
              price: sa.offers.price,
              priceCurrency: sa.offers.priceCurrency,
              ...(sa.offers.availability ? { availability: sa.offers.availability } : {}),
            },
          }
        : {}),
      author: {
        '@type': 'Person',
        name: 'Andy Aragon',
      },
      ...(sa.featureList && sa.featureList.length > 0 ? { featureList: sa.featureList } : {}),
      // Link this SoftwareApplication back to the parent Gridfinity Layout Tool app
      // so Google can model the generator suite (bin + baseplate + planner) as
      // sub-components of one product.
      isPartOf: {
        '@type': 'SoftwareApplication',
        name: 'Gridfinity Layout Tool',
        url: SITE_URL,
      },
    });
  }

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
  const languageSwitcherHtml = renderLanguageSwitcher(slug, locale, availableLocales);

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
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large">
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
  <meta property="og:locale" content="${OG_LOCALE[locale]}">

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
${languageSwitcherHtml}    <a href="${escapeHtml(navCta?.href ?? homeUrl)}" class="content-nav__cta">
      ${escapeHtml(navCta?.label ?? labels.openTool)}
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
        <a href="/gridfinity-tool-drawer">${escapeHtml(FOOTER_LINKS[locale].toolDrawer)}</a>
        <a href="/gridfinity-kitchen-drawer">${escapeHtml(FOOTER_LINKS[locale].kitchen)}</a>
        <a href="/gridfinity-calculator">${escapeHtml(FOOTER_LINKS[locale].calculator)}</a>
        <a href="/gridfinity-software">${escapeHtml(FOOTER_LINKS[locale].software)}</a>
        <a href="/privacy">${escapeHtml(FOOTER_LINKS[locale].privacy)}</a>
        <a href="/terms">${escapeHtml(FOOTER_LINKS[locale].terms)}</a>
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

function renderLanguageSwitcher(
  slug: string,
  currentLocale: Locale,
  availableLocales: ReadonlySet<Locale>
): string {
  const targets = SUPPORTED_LOCALES.filter((l) => availableLocales.has(l));
  if (targets.length <= 1) return '';
  const items = targets
    .map((l) => {
      const name = escapeHtml(NATIVE_LANGUAGE[l]);
      const isCurrent = l === currentLocale;
      const attrs = isCurrent ? ' aria-current="true"' : '';
      return `        <li><a href="${getUrl(slug, l)}" hreflang="${l}" lang="${LOCALE_LABELS[l].lang}"${attrs}>${name}</a></li>`;
    })
    .join('\n');
  return `    <details class="content-nav__lang">
      <summary aria-label="${escapeHtml(LANGUAGE_LABEL[currentLocale])}">${escapeHtml(NATIVE_LANGUAGE[currentLocale])}</summary>
      <ul class="content-nav__lang-list">
${items}
      </ul>
    </details>
`;
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

function configureMarked(): void {
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        return `<h${depth} class="content-h${depth}">${text}</h${depth}>\n`;
      },
      list(token) {
        const type = token.ordered ? 'ol' : 'ul';
        const body = token.items.map((item) => this.listitem(item)).join('');
        return `<${type} class="content-list">${body}</${type}>\n`;
      },
      // `[CTA: text](url)` is our convention for the orange call-to-action button;
      // external links get target="_blank" rel="noopener" to prevent reverse tabnabbing.
      link({ href, text }) {
        const safeHref = escapeHtml(href);
        const safeText = escapeHtml(text);
        if (text.startsWith('CTA:')) {
          const ctaText = text.replace('CTA:', '').trim();
          return `<a href="${safeHref}" class="content-cta">${escapeHtml(ctaText)} &rarr;</a>`;
        }
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        if (isExternal) {
          return `<a href="${safeHref}" target="_blank" rel="noopener">${safeText}</a>`;
        }
        return `<a href="${safeHref}">${safeText}</a>`;
      },
      blockquote({ tokens }) {
        const content = this.parser.parse(tokens);
        return `<div class="content-callout">${content}</div>\n`;
      },
      // `![alt](src "WxH")` — the title slot carries intrinsic dimensions so the
      // browser reserves space before the image loads (no CLS).
      image({ href, title, text }) {
        const dims = title?.match(/^(\d+)x(\d+)$/);
        const sizeAttrs = dims ? ` width="${dims[1]}" height="${dims[2]}"` : '';
        return `<img class="content-img" src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${sizeAttrs} loading="lazy" decoding="async">`;
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
  let parsed: { data: Record<string, unknown>; content: string };
  try {
    parsed = parseFrontmatter(fileContent);
  } catch (err) {
    console.error(
      `Failed to parse frontmatter in ${filePath}: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
  const { data, content } = parsed;
  const frontmatter = data as Frontmatter;

  if (!frontmatter.title || !frontmatter.description) {
    console.error(`Missing required frontmatter in ${filePath}`);
    process.exit(1);
  }

  if (frontmatter.softwareApplication) {
    const sa = frontmatter.softwareApplication;
    if (!sa.name || !sa.applicationCategory) {
      console.error(
        `softwareApplication in ${filePath} is missing required fields (need 'name' and 'applicationCategory')`
      );
      process.exit(1);
    }
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

  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (file.startsWith('content.') && file.endsWith('.css') && file !== 'content.css') {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  }

  fs.copyFileSync(cssSourcePath, cssDestPath);
  console.log(`✓ Generated ${cssFilename}`);
}

interface SitemapPage {
  basePriority: number;
  changefreq: string;
}

// Bump CONTENT_LASTMOD when shipping a substantive content change so search
// engines re-crawl the affected URLs. Hardcoded (not `new Date()`) to avoid
// every build advertising the entire sitemap as updated.
const CONTENT_LASTMOD = '2026-07-16';

// SPA routes with their own static HTML entry (see scripts/build-route-entries.ts).
// English-only, no locale variants.
const APP_ROUTES: Record<string, SitemapPage> = {
  designer: { basePriority: 0.9, changefreq: 'monthly' },
  baseplate: { basePriority: 0.9, changefreq: 'monthly' },
};

const SITEMAP_PAGES: Record<string, SitemapPage> = {
  'gridfinity-generator': { basePriority: 0.95, changefreq: 'weekly' },
  'what-is-gridfinity': { basePriority: 0.8, changefreq: 'monthly' },
  guide: { basePriority: 0.8, changefreq: 'monthly' },
  'gridfinity-bin-generator': { basePriority: 0.9, changefreq: 'monthly' },
  'gridfinity-baseplate-generator': { basePriority: 0.9, changefreq: 'monthly' },
  'gridfinity-sizes': { basePriority: 0.8, changefreq: 'monthly' },
  'gridfinity-tool-drawer': { basePriority: 0.8, changefreq: 'monthly' },
  'gridfinity-kitchen-drawer': { basePriority: 0.8, changefreq: 'monthly' },
  'gridfinity-calculator': { basePriority: 0.8, changefreq: 'monthly' },
  'gridfinity-software': { basePriority: 0.7, changefreq: 'monthly' },
};

function sitemapImageXml(slug: string): string {
  const image = perPageOgImage(slug);
  return image
    ? `    <image:image>\n      <image:loc>${image}</image:loc>\n    </image:image>\n`
    : '';
}

function writeSitemap(localesBySlug: Map<string, Set<Locale>>): void {
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    `  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${CONTENT_LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${SITE_URL}/images/landing/tool-drawer-layout.png</image:loc>
      <image:title>Gridfinity Layout Tool - Design Drawer Layouts for 3D Printing</image:title>
      <image:caption>Free online tool to design Gridfinity drawer organizer layouts with drag-and-drop bin placement, multi-layer support, and 3D preview</image:caption>
    </image:image>
  </url>`,
  ];

  for (const [slug, config] of Object.entries(APP_ROUTES)) {
    out.push(`  <url>
    <loc>${SITE_URL}/${slug}</loc>
    <lastmod>${CONTENT_LASTMOD}</lastmod>
    <changefreq>${config.changefreq}</changefreq>
    <priority>${config.basePriority.toFixed(1)}</priority>
${sitemapImageXml(slug)}  </url>`);
  }

  for (const [slug, config] of Object.entries(SITEMAP_PAGES)) {
    const locales = localesBySlug.get(slug);
    if (!locales) continue;
    const sortedLocales = SUPPORTED_LOCALES.filter((l) => locales.has(l));
    const hreflang = [
      ...sortedLocales.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${getUrl(slug, l)}"/>`
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${getUrl(slug, DEFAULT_LOCALE)}"/>`,
    ].join('\n');

    for (const locale of sortedLocales) {
      const priority =
        locale === DEFAULT_LOCALE
          ? config.basePriority.toFixed(1)
          : (config.basePriority - 0.1).toFixed(1);
      out.push(`  <url>
    <loc>${getUrl(slug, locale)}</loc>
    <lastmod>${CONTENT_LASTMOD}</lastmod>
    <changefreq>${config.changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflang}
${locale === DEFAULT_LOCALE ? sitemapImageXml(slug) : ''}  </url>`);
    }
  }

  out.push('</urlset>');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), out.join('\n') + '\n');
  console.log(`✓ Generated sitemap.xml`);
}

function build(): void {
  console.log('Building content pages...\n');

  configureMarked();

  if (!fs.existsSync(CONTENT_DIR)) {
    console.log('No content directory found. Skipping content build.');
    return;
  }

  // processCss mutates module-level cssFilename — call before HTML generation.
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

  writeSitemap(localesBySlug);

  console.log(`\n✓ Built ${entries.length} content page(s) across ${localesBySlug.size} slug(s)`);
}

build();
