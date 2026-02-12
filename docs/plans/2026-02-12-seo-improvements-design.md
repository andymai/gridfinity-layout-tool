# SEO Improvements: Target Gridfinity Generator/Bin/Design Searches

## Goal

Improve organic search visibility for people searching for gridfinity generators, bin designs, and drawer planning tools. The app has a full parametric bin generator with STL/STEP/3MF export that current SEO doesn't surface at all.

## Current State

- Well-optimized `index.html` with meta tags, OG/Twitter cards, structured data
- 2 content pages: `/what-is-gridfinity`, `/guide`
- Title focuses on "Plan Your 3D Printed Drawer Organizers" — no mention of generation
- No content page for the bin designer/generator feature
- No reference page for gridfinity sizes/specs

## Changes

### 1. New Content Page: `/gridfinity-bin-generator/index.html`

**Target keywords:** gridfinity generator, gridfinity bin generator, gridfinity STL generator, custom gridfinity bins, gridfinity bin maker, gridfinity designer, online gridfinity generator

**Content outline:**

- H1: "Free Gridfinity Bin Generator"
- What it does: parametric bin creation with real-time 3D preview, export to STL/STEP/3MF
- Key capabilities (concise feature list):
  - Custom dimensions (width, depth, height in grid units)
  - 6 base attachment styles (standard, magnet, screw, combo, weighted, flat)
  - Wall patterns (honeycomb)
  - Compartments with removable dividers
  - Scoop ramps for accessibility
  - Wall cutouts (per-side and interior)
  - Label tabs (bracket or solid support)
  - Floor inserts (rectangle, circle, hexagon, rounded-rect, slot)
  - Cutout editor with pen tool for custom shapes
  - Half-bin mode (0.5 unit precision)
- How it compares to alternatives (brief — OpenSCAD scripts require software install, this runs in browser)
- Quick start steps (3-4 steps)
- CTA: "Open the Bin Generator →" linking to `/designer`

**Structured data:** SoftwareApplication focused on the generator, plus HowTo for "How to generate a custom gridfinity bin"

**Style:** Same static HTML pattern as existing content pages, same CSS, same nav/footer.

### 2. New Content Page: `/gridfinity-sizes/index.html`

**Target keywords:** gridfinity sizes, gridfinity bin sizes, gridfinity dimensions, gridfinity specifications, gridfinity height units, gridfinity grid size, gridfinity 42mm

**Content outline:**

- H1: "Gridfinity Sizes & Dimensions Reference"
- The 42mm grid unit system
- Height units (7mm = 1U) with common heights table (2U–10U with mm equivalents)
- Standard bin sizes table with typical use cases
- Baseplate sizing: how to convert drawer mm to grid units
- Half-bin mode: 0.5 unit increments for tight fits
- Print bed considerations (256mm default, splitting large bins)
- Quick reference card format — scannable, not essay-like
- CTA: "Plan Your Layout →" linking to `/`

**Structured data:** Article with reference table markup

### 3. Update `index.html` Meta Tags

**Title (implemented):**

```
Gridfinity Layout Tool — Free Bin Generator & Planner
```

**Meta description (implemented):**

```
Gridfinity bin generator and layout planner. Make bins with configurable dimensions, export STL/STEP/3MF, and plan your drawer layout. Free, runs in your browser.
```

**Keywords — add:**
`gridfinity generator`, `gridfinity bin generator`, `STL generator`, `custom gridfinity bins`, `gridfinity bin maker`, `gridfinity designer`, `gridfinity bin designer`, `gridfinity STL`, `3MF`, `STEP`

**OG/Twitter tags:** Update title, description, and image alt to match.

### 4. Update `index.html` Structured Data

**SoftwareApplication:**

- Update `description` to mention STL generation
- Add to `featureList`:
  - "Custom bin STL/STEP/3MF generation"
  - "Parametric bin designer with real-time 3D preview"
  - "Wall patterns, cutouts, compartments, and label tabs"
  - "In-browser — no software installation required"

**FAQPage — add new entries:**

- "Can I generate custom Gridfinity STL files?" → Yes, the built-in bin generator creates parametric bins with STL, STEP, and 3MF export...
- "What file formats does the generator support?" → STL, STEP, and 3MF...
- "Do I need to install software?" → No, everything runs in your browser using WebAssembly...

### 5. Update `index.html` Noscript Content

Add a section about the bin generator between "Features" and "How to Use":

- "Gridfinity Bin Generator" heading
- Description of parametric generation, STL/STEP/3MF export, key customization options
- This is what search engine crawlers actually index for SPA content

### 6. Update Sitemap

Add to `public/sitemap.xml`:

```xml
<url>
  <loc>https://gridfinitylayouttool.com/gridfinity-bin-generator</loc>
  <lastmod>2026-02-12</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
<url>
  <loc>https://gridfinitylayouttool.com/gridfinity-sizes</loc>
  <lastmod>2026-02-12</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

### 7. Update Internal Linking

**Footer nav** (all content pages): Add "Bin Generator" and "Sizes Reference" links.

**Cross-links in content:**

- `/what-is-gridfinity`: Add link to generator page ("You can design custom bins with our free generator")
- `/guide`: Add link to generator page in the "Finding STL Files" section ("Or generate custom bins directly")
- New pages link to each other and back to the tool

### 8. Vercel Redirects (if needed)

Consider adding redirects for common alternative URL patterns:

- `/generator` → `/gridfinity-bin-generator`
- `/designer` already works (app route)
- `/sizes` → `/gridfinity-sizes`

These can go in `vercel.json` rewrites/redirects.

## Out of Scope

- Blog/content marketing strategy (future work)
- Backlink building
- Google Search Console setup (assumed already done)
- Image SEO (screenshots of the tool — would help but is a separate effort)
- Video content for YouTube SEO

## File Changes Summary

| File                                         | Action                                      |
| -------------------------------------------- | ------------------------------------------- |
| `public/gridfinity-bin-generator/index.html` | Create                                      |
| `public/gridfinity-sizes/index.html`         | Create                                      |
| `index.html`                                 | Edit (meta tags, structured data, noscript) |
| `public/sitemap.xml`                         | Edit (add 2 URLs)                           |
| `public/what-is-gridfinity/index.html`       | Edit (add cross-links, update footer)       |
| `public/guide/index.html`                    | Edit (add cross-links, update footer)       |
| `public/privacy/index.html`                  | Edit (update footer)                        |
| `public/terms/index.html`                    | Edit (update footer)                        |
| `vercel.json`                                | Edit (add redirects, optional)              |
