/**
 * Vercel Edge Middleware for dynamic Open Graph meta tags on shared layouts.
 *
 * This middleware intercepts requests to /l/{id} URLs and injects dynamic
 * OG meta tags based on the shared layout data. This enables rich previews
 * when layouts are shared on social media, messaging apps, and search engines.
 *
 * The middleware fetches layout metadata and generates SEO-optimized HTML
 * for bot crawlers, enabling better backlink value and social sharing.
 */

import type { RequestContext } from '@vercel/edge';

// Match shared layout URLs: /l/{id} or /l/{id}/{slug}
const SHARE_URL_PATTERN = /^\/l\/([a-zA-Z0-9-]+)(\/.*)?$/;

interface OGMetadata {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
  type: string;
  layout: {
    name: string;
    drawer: { width: number; depth: number; height: number };
    binCount: number;
    layerCount: number;
    categoryCount: number;
  } | null;
  author: string | null;
  permission: 'view' | 'edit';
  createdAt: string | null;
}

export const config = {
  matcher: ['/l/:path*'],
};

export default async function middleware(request: Request, _context: RequestContext) {
  const url = new URL(request.url);
  const { pathname } = url;

  // Check if this is a shared layout URL
  const match = pathname.match(SHARE_URL_PATTERN);
  if (!match) {
    return;
  }

  const shareId = match[1];

  // Check if this is a bot/crawler request that needs OG tags
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = isBotRequest(userAgent);

  // For regular users, just pass through to the SPA
  if (!isBot) {
    return;
  }

  try {
    // Fetch OG metadata for this share
    const ogUrl = new URL(`/api/og/${shareId}`, request.url);
    const ogResponse = await fetch(ogUrl.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!ogResponse.ok) {
      return;
    }

    const ogData: OGMetadata = await ogResponse.json();

    // Generate HTML with dynamic OG tags for bots
    const html = generateBotHtml(ogData);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Middleware OG fetch error:', error);
    return;
  }
}

/**
 * Check if the request is from a bot/crawler
 */
function isBotRequest(userAgent: string): boolean {
  const botPatterns = [
    // Social media crawlers
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'Pinterest',
    'Slackbot',
    'Discordbot',
    'TelegramBot',
    'WhatsApp',
    // Search engine crawlers
    'Googlebot',
    'Bingbot',
    'bingbot',
    'Slurp',
    'DuckDuckBot',
    'Baiduspider',
    'YandexBot',
    // Other crawlers
    'redditbot',
    'Embedly',
    'Quora Link Preview',
    'outbrain',
    'vkShare',
    'W3C_Validator',
    'Applebot',
  ];

  const lowerUA = userAgent.toLowerCase();
  return botPatterns.some((pattern) => lowerUA.includes(pattern.toLowerCase()));
}

/**
 * Generate HTML page with OG tags for bot crawlers
 */
function generateBotHtml(og: OGMetadata): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: og.title,
    description: og.description,
    url: og.url,
    image: og.image,
    author: og.author
      ? {
          '@type': 'Person',
          name: og.author,
        }
      : undefined,
    dateCreated: og.createdAt,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Gridfinity Layout Tool',
      url: 'https://gridfinitylayouttool.com/',
    },
    keywords: [
      'gridfinity',
      'drawer organizer',
      '3D printing',
      'storage',
      'bins',
      og.layout ? `${og.layout.drawer.width}x${og.layout.drawer.depth}` : null,
    ].filter(Boolean),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${og.title}</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="${og.description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${og.url}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${og.type}">
  <meta property="og:url" content="${og.url}">
  <meta property="og:title" content="${og.title}">
  <meta property="og:description" content="${og.description}">
  <meta property="og:image" content="${og.image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${og.siteName}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${og.url}">
  <meta name="twitter:title" content="${og.title}">
  <meta name="twitter:description" content="${og.description}">
  <meta name="twitter:image" content="${og.image}">

  <!-- Structured Data -->
  <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
  </script>

  <!-- Redirect to SPA after a short delay (for JS-enabled crawlers) -->
  <meta http-equiv="refresh" content="0;url=${og.url}">
</head>
<body>
  <div style="max-width: 800px; margin: 40px auto; padding: 20px; font-family: system-ui, sans-serif; line-height: 1.6;">
    <h1>${og.title}</h1>
    <p>${og.description}</p>

    ${
      og.layout
        ? `
    <h2>Layout Details</h2>
    <ul>
      <li><strong>Drawer Size:</strong> ${og.layout.drawer.width}×${og.layout.drawer.depth}×${og.layout.drawer.height} grid units</li>
      <li><strong>Bins:</strong> ${og.layout.binCount} storage bins</li>
      <li><strong>Layers:</strong> ${og.layout.layerCount}</li>
      <li><strong>Categories:</strong> ${og.layout.categoryCount}</li>
    </ul>
    `
        : ''
    }

    ${og.author ? `<p><strong>Created by:</strong> ${og.author}</p>` : ''}

    <h2>About Gridfinity Layout Tool</h2>
    <p>Design Gridfinity drawer layouts for 3D printing. Plan custom organizers with drag-and-drop bins, multi-layer support, 3D preview, and automatic print optimization. Free to use, works offline, no signup required.</p>

    <h3>Key Features</h3>
    <ul>
      <li>Drag-and-drop bin placement</li>
      <li>Multi-layer drawer support</li>
      <li>3D isometric preview</li>
      <li>Print optimization with filament estimates</li>
      <li>Share and collaborate on layouts</li>
      <li>Works offline as a PWA</li>
    </ul>

    <p><a href="${og.url}">View this layout in the Gridfinity Layout Tool</a></p>
    <p><a href="https://gridfinitylayouttool.com/">Create your own Gridfinity layout</a></p>

    <h3>What is Gridfinity?</h3>
    <p>Gridfinity is an open-source, modular storage system designed by Zack Freedman for 3D printing. It uses standardized 42mm grid units to create customizable drawer organizers and storage bins that snap together perfectly.</p>

    <h3>Related Resources</h3>
    <ul>
      <li><a href="https://www.printables.com/search/models?q=gridfinity" rel="noopener">Gridfinity STL Files on Printables</a></li>
      <li><a href="https://thangs.com/search/gridfinity" rel="noopener">Gridfinity Models on Thangs</a></li>
      <li><a href="https://makerworld.com/en/search/models?keyword=gridfinity" rel="noopener">Gridfinity on MakerWorld</a></li>
      <li><a href="https://www.reddit.com/r/gridfinity/" rel="noopener">r/gridfinity Community</a></li>
    </ul>
  </div>
</body>
</html>`;
}
