# SEO Content Pages Design

## Goal

Improve page rank for target keywords by adding static content pages that Google can crawl and index.

**Target keywords:**
- "gridfinity layout tool"
- "gridfinity planner"
- "gridfinity drawer organizer"

**Problem:** The React SPA is interactive but has no crawlable content beyond the homepage. Competitors with content (Instructables, other tools) outrank us for informational queries.

## Solution

Add two static HTML content pages alongside the app:

| Page | URL | Target Keywords |
|------|-----|-----------------|
| What is Gridfinity? | `/what-is-gridfinity` | "what is gridfinity", "gridfinity drawer organizer" |
| Planning Guide | `/guide` | "gridfinity planner", "how to plan gridfinity layout" |

## Architecture

```
content/
  what-is-gridfinity.md    # Content source (Markdown)
  guide.md

scripts/
  build-content.ts          # Converts MD → HTML at build time

public/
  what-is-gridfinity/
    index.html              # Generated output
  guide/
    index.html
  content.css               # Shared design system styles

src/
  styles/
    content-tokens.css      # Design tokens extracted from Tailwind
```

### Why Markdown Source

- Clean, readable format for AI editing
- No HTML noise when updating content
- Frontmatter for SEO metadata
- Easy to add more pages later

### Why Static HTML Output

- 100% crawlable by Google (no JS required)
- Zero impact on SPA bundle size
- Fast to load (no React overhead)
- Simple deployment (just files)

## Content Pages

### Page 1: What is Gridfinity (`/what-is-gridfinity`)

**Audience:** People who've heard of Gridfinity but don't know what it is

**Outline:**
1. The Modular Storage System for Makers
   - Created by Zack Freedman in 2022
   - Open-source, 3D-printable
   - 42mm grid standard
2. How the Grid System Works
   - Base plates snap into drawers
   - Bins click onto bases
   - Mix and match sizes
3. Why Makers Love It
   - Fully customizable
   - Print only what you need
   - Huge community library
4. Getting Started
   - What you need
   - Where to find STL files
   - CTA: Plan your layout →

**Word count:** 600-800 words

### Page 2: Planning Guide (`/guide`)

**Audience:** People ready to plan but unsure how to start

**Outline:**
1. Measure Your Drawer
   - Width, depth in mm
   - Convert to grid units (÷ 42mm)
2. Inventory What You're Storing
   - Group similar items
   - Note sizes
3. Plan Your Layout
   - Open the tool
   - Set dimensions
   - Drag bins
4. Use Layers for Stacking
   - Multiple height levels
5. Export Your Print List
   - Auto-generated bin sizes
   - Filament estimates
6. Tips for Better Layouts

**Word count:** 800-1000 words

## Design System

### Design Tokens

```css
:root {
  /* Colors - matching app */
  --color-bg: #0f0f12;
  --color-surface: #1a1a1f;
  --color-content: #e4e4e7;
  --color-content-secondary: #a1a1aa;
  --color-accent: #6366f1;

  /* Typography - IBM Plex */
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* Spacing */
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
}
```

### Content Classes

| Class | Purpose |
|-------|---------|
| `.content-page` | Page wrapper (max-width 720px, centered) |
| `.content-h1` | Page title |
| `.content-h2` | Section headings |
| `.content-body` | Paragraph text |
| `.content-list` | Bulleted/numbered lists |
| `.content-cta` | Call-to-action button |
| `.content-callout` | Highlighted tip/info box |
| `.content-nav` | Header with logo + back link |

### Page Layout

- Max-width: 720px (readable line length)
- Dark theme matching app
- Sticky nav with "← Back to Tool" link
- Footer with app link, GitHub

## SEO Implementation

### Frontmatter Schema

```markdown
---
title: What is Gridfinity?
description: Learn about the modular 3D-printed storage system
keywords: gridfinity, drawer organizer, 3D printing
ogImage: /og-what-is-gridfinity.png
schema: Article
---
```

### Generated Meta Tags

```html
<head>
  <title>What is Gridfinity? | Gridfinity Layout Tool</title>
  <meta name="description" content="...">
  <link rel="canonical" href="https://gridfinitylayouttool.com/what-is-gridfinity">

  <meta property="og:title" content="...">
  <meta property="og:description" content="...">
  <meta property="og:image" content="/og-what-is-gridfinity.png">

  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "What is Gridfinity?",
      "author": { "@type": "Person", "name": "Andy Aragon" },
      "publisher": { "@type": "Organization", "name": "Gridfinity Layout Tool" }
    }
  </script>
</head>
```

### Internal Linking

- Homepage footer links to both content pages
- Content pages link to each other
- Both pages have prominent CTAs to the app

## Build Script

### Dependencies

```json
{
  "devDependencies": {
    "marked": "^12.0.0",
    "gray-matter": "^4.0.3"
  }
}
```

### Script Logic (`scripts/build-content.ts`)

```typescript
1. Glob all .md files in content/
2. For each file:
   - Parse frontmatter (gray-matter)
   - Convert markdown to HTML (marked)
   - Inject into HTML template
   - Write to public/{slug}/index.html
3. Copy content.css to public/
```

### npm Scripts

```json
{
  "scripts": {
    "build:content": "tsx scripts/build-content.ts",
    "build": "npm run build:content && vite build",
    "dev": "npm run build:content && vite"
  }
}
```

## Implementation Tasks

1. **Setup** - Create directory structure, install dependencies
2. **Design system** - Create `content.css` with tokens and classes
3. **Build script** - Implement MD → HTML converter
4. **HTML template** - Create base template with nav, footer, SEO
5. **Content: What is Gridfinity** - Write markdown content
6. **Content: Planning Guide** - Write markdown content
7. **Homepage links** - Add footer links to content pages
8. **OG images** - Create social images for each page (optional)

## Success Criteria

- Both pages indexed by Google within 2 weeks
- Pages rank on first 2 pages for target keywords within 2 months
- Content pages drive traffic to the main app (measurable via analytics)

## Out of Scope

- Blog or regularly updated content
- Comments or user-generated content
- Multiple languages
- CMS or admin interface
