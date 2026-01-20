/**
 * Build script for static content pages.
 * Converts Markdown files in content/ to HTML in public/.
 *
 * Usage: npx tsx scripts/build-content.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUTPUT_DIR = path.join(process.cwd(), 'public');
const SITE_URL = 'https://gridfinitylayouttool.com';

// Will be set during build after hashing the CSS
let cssFilename = 'content.css';

interface Frontmatter {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  schema?: 'Article' | 'HowTo';
}

/**
 * Generate the HTML template for a content page
 */
function generateHtml(
  content: string,
  frontmatter: Frontmatter,
  slug: string
): string {
  const { title, description, keywords, ogImage, schema } = frontmatter;
  const canonicalUrl = `${SITE_URL}/${slug}`;
  const image = ogImage || `${SITE_URL}/og-image.png`;

  // Generate structured data based on schema type
  const structuredData =
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Gridfinity Layout Tool</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="${escapeHtml(description)}">
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}
  <meta name="author" content="Andy Aragon">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)} | Gridfinity Layout Tool">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="Gridfinity Layout Tool">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)} | Gridfinity Layout Tool">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">

  <!-- Structured Data -->
  <script type="application/ld+json">
${safeJsonLd(structuredData)}
  </script>

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
    <a href="/" class="content-nav__logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span>Gridfinity Layout Tool</span>
    </a>
    <a href="/" class="content-nav__cta">
      Open Tool
    </a>
  </nav>

  <!-- Main Content -->
  <main id="main-content" class="content-page content-body">
${content}
  </main>

  <!-- Footer -->
  <footer class="content-page">
    <div class="content-footer">
      <div class="content-footer__links">
        <a href="/what-is-gridfinity">What is Gridfinity?</a>
        <a href="/guide">Planning Guide</a>
      </div>
      <p class="content-footer__copyright">
        © ${new Date().getFullYear()} Gridfinity Layout Tool. Free and open source.
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
  return JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
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
        const body = token.items
          .map((item) => this.listitem(item))
          .join('');
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

/**
 * Process a single markdown file
 */
function processFile(filePath: string): void {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  const frontmatter = data as Frontmatter;

  // Validate required frontmatter
  if (!frontmatter.title || !frontmatter.description) {
    console.error(`Missing required frontmatter in ${filePath}`);
    process.exit(1);
  }

  // Get slug from filename (e.g., "what-is-gridfinity.md" -> "what-is-gridfinity")
  const slug = path.basename(filePath, '.md');

  // Convert markdown to HTML
  const htmlContent = marked(content);

  // Generate full HTML page
  const fullHtml = generateHtml(htmlContent as string, frontmatter, slug);

  // Create output directory
  const outputPath = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  // Write HTML file
  const outputFile = path.join(outputPath, 'index.html');
  fs.writeFileSync(outputFile, fullHtml);

  console.log(`✓ Generated ${outputFile}`);
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

  // Get all markdown files
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('No markdown files found in content/');
    return;
  }

  // Process each file
  for (const file of files) {
    processFile(path.join(CONTENT_DIR, file));
  }

  console.log(`\n✓ Built ${files.length} content page(s)`);
}

// Run build
build();
