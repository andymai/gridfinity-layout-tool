---
name: content-and-seo
description: 'SEO/content pages: adding a landing page end-to-end (content/*.md → scripts/build-content.ts → public/<slug>/index.html), the "⚠ ... chars" SERP title/description warnings, sitemap.xml + hreflang, regenerating OG cards and screenshots (pnpm run gen:seo-images, gen:example-thumbnails), /designer + /baseplate static heads (scripts/build-route-entries.ts), editing index.html meta/JSON-LD, and the phone-scan handoff endpoint api/scan-session.ts ("scan" PR scope).'
---

# Content and SEO

## When to use

- Adding or editing a marketing/landing page, FAQ, sitemap entry, or meta tags.
- `pnpm run build:content` prints `⚠ ... chars` warnings, or `pnpm run build` fails in `build-route-entries` with "pattern not found".
- Regenerating the committed screenshots/OG cards or gallery thumbnails.
- Touching `api/scan-session.ts` / `api/scan-session/[token].ts` (the QR phone-scan handoff).

## Mental model

1. `content/<slug>.md` (+ translated copies in `content/<locale>/<slug>.md`) are compiled by `scripts/build-content.ts` into static `public/<slug>/index.html` pages, `public/sitemap.xml`, and a hashed `public/content.<hash>.css`. This runs as the **first step of both `pnpm run dev` and `pnpm run build`** (see `package.json`) — it is not a watcher.
2. All generated outputs are **gitignored** (see the "Generated content pages" block in `.gitignore`) except `public/privacy/index.html` and `public/terms/index.html`, which are committed — `build:content` still regenerates them, so it can legitimately dirty your working tree.
3. Serving is duplicated in two places that must stay in sync: `vercel.json` rewrites (production) and `scripts/vite-plugin-content-routes.ts` `SLUGS`/`LOCALIZED_SLUGS` (dev middleware). A page missing from one works in the other environment and 404s/falls into the SPA shell in the misconfigured one.
4. Content locales (9: en + de/fr/es/pt-BR/nl/sv/nb/uk, hardcoded in `build-content.ts`) are NOT the app i18n locales — `ja` has UI translations but no content pages (`CONTENT_LOCALES` in `src/shell/Sidebar/learnLinks.ts`). hreflang links and the language switcher auto-derive from which locale `.md` files actually exist per slug.
5. SERP guards in `build-content.ts` are **warn-only**: `MAX_TITLE_LEN = 55` guards the unique title before the appended `" | Gridfinity Layout Tool"` suffix; `MAX_DESCRIPTION_LEN = 155`. Missing `title`/`description` frontmatter is a hard `process.exit(1)`; so is `softwareApplication` without `name` + `applicationCategory`.
6. The SPA routes `/designer` and `/baseplate` get their own crawler-visible heads a different way: `scripts/build-route-entries.ts` runs after `vite build` and regex-swaps title/meta/JSON-LD/`#seo-fallback` in copies of `dist/index.html`. JS stays byte-identical so the CSP hashes in `vercel.json` remain valid.
7. Per-page OG image resolution: frontmatter `ogImage` → `public/og/<slug>.png` if it exists (`perPageOgImage`) → site-wide `/og-image.png`. OG cards and landing screenshots are committed PNGs, regenerated only by hand.

## Recipe: add a content/landing page end-to-end

1. Write `content/<slug>.md`. Frontmatter (`Frontmatter` interface in `scripts/build-content.ts`): `title` (≤55 chars), `description` (≤155), `keywords`, `schema: Article | HowTo`, optional `faqs` (emits FAQPage JSON-LD; answers allow inline markdown), `breadcrumbs`, `howTo`, `softwareApplication`, `navCta`. Copy `content/gridfinity-calculator.md` as a template. Body conventions: `[CTA: text](url)` renders the orange CTA button; `![alt](src "1200x675")` sets intrinsic dimensions (CLS); blockquotes render as callouts.
2. Register the slug in `SITEMAP_PAGES` in `scripts/build-content.ts` — pages not listed there build fine but never enter `sitemap.xml` (`privacy`/`terms` are deliberately absent).
3. Add the slug to the English rewrite group in `vercel.json` (`/:slug(what-is-gridfinity|guide|...)`) and to `SLUGS` in `scripts/vite-plugin-content-routes.ts`.
4. Add `public/<slug>/` to `.gitignore` (match the existing block).
5. Internal linking: add an entry to `LEARN_LINKS` in `src/shell/Sidebar/learnLinks.ts` (`localized: false` for English-only) plus its `sidebar.learn.*` key — see the **i18n-changes** skill. Consider a footer link too: `FOOTER_LINKS` in `build-content.ts` is hardcoded per locale and the footer template lists each link explicitly.
6. Optional OG card: append to `OG_CARDS` in `scripts/gen-seo-images.ts`, regenerate (recipe below), commit `public/og/<slug>.png` — `build:content` picks it up automatically.
7. Bump `CONTENT_LASTMOD` in `build-content.ts` (hardcoded on purpose; `new Date()` would advertise the whole sitemap as updated every build).
8. Translations later: drop `content/<locale>/<slug>.md` files, then add the slug to `LOCALIZED_SLUGS` in `vite-plugin-content-routes.ts`, the localized rewrite group in `vercel.json`, and flip `localized: true` in `learnLinks.ts`.

## Recipe: regenerate SEO images / thumbnails

Both scripts drive a real browser against a **separately running dev server** (WebGL + WASM kernels; never mock these).

```bash
pnpm run dev                        # terminal 1, leave running
pnpm run gen:seo-images             # terminal 2; BASE_URL=... if not :5173
ONLY=og pnpm run gen:seo-images     # steps: planner, renders, baseplate, og
```

Outputs are committed: `public/images/landing/` (in-page screenshots) and `public/og/` (1200x630 cards). OG cards embed the landing screenshots as insets, so when a screenshot changes run its step **before** `ONLY=og`. Designer renders use the dev-only `?devThumbnails=1` route (`src/features/bin-designer/components/DevThumbnailRoute/`).

Gallery thumbnails are the same workflow: `pnpm run gen:example-thumbnails` (filter with `EXAMPLE_ID=<id>,<id>`) writes committed PNGs and draco-compressed meshes into `src/features/bin-designer/data/examples/thumbnails/` and `meshes/`.

## Scan-session (why an API file lives in this skill's scope)

`api/scan-session.ts` has nothing to do with SEO — it shares the `scan` PR scope. It is the phone-scan handoff for the bin designer's cutout scan import: desktop `POST /api/scan-session` mints a UUID token, stores `{status:'pending'}` in Redis (`SCAN_SESSION_TTL_SECONDS = 600` in `api/lib/scanSession.ts`), and renders `/scan/<token>` as a QR code. The phone opens that URL (SPA rewrite in `vercel.json` → `src/features/scan-capture/components/ScanPage/`), traces the object, and `POST`s an SVG outline to `api/scan-session/[token].ts`; the desktop polls `GET` on the same route (`useScanSession.ts` under `src/features/bin-designer/components/panel/CutoutsSection/scanImport/`).

Invariants when touching it: the uploaded SVG is validated but **never injected into a live DOM** (documented in `api/lib/scanSession.ts` — keep it that way); GET delivery is idempotent until TTL expiry (consuming on read would lose the scan on a transient desktop error); uploads use Redis `KEEPTTL` so retries cannot extend a session; no Redis → 503 so the client falls back to manual upload. Rate limits (`api/lib/rateLimit.ts`): `scan.create` and `scan.upload` 30/min, `scan.poll` 240/min. For the shared Redis/rate-limit/local-API-dev setup, see the **share-api-collab** skill.

## Verification

```bash
pnpm run build:content     # per-page "✓ Generated ..." + any ⚠ SERP warnings
pnpm run dev               # open http://localhost:5173/<slug> and /de/<slug>
pnpm run build             # proves build-route-entries still matches index.html
pnpm vitest run scripts/check-csp-hashes.test.ts   # after editing index.html inline scripts
pnpm vitest run api/lib/scanSession.test.ts        # after scan-session changes
```

## Traps

| Symptom                                                                         | Cause                                                                                                                        | Fix                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content edit merged to main, production unchanged                               | `content/` and `scripts/` are not in `scripts/vercel-ignore.sh`'s path list, so Vercel skips the build                       | Ride along a `public/` change (the OG PNG usually suffices), deploy manually, or add `content/` to the path list in `scripts/vercel-ignore.sh` (permanent fix) — see the **release-and-ci** skill |
| New page works in dev, 404s/SPA-shells in prod (or vice versa)                  | Slug added to only one of `vercel.json` / `vite-plugin-content-routes.ts`; `vercel.json`-only changes also never auto-deploy | Add to both; note the localized groups list slugs separately                                                                                                                                      |
| Markdown edits invisible in a running dev server                                | `build:content` runs once at `dev` startup; no watch                                                                         | Rerun `pnpm run build:content`, refresh — the dev middleware reads `public/` from disk per request, no restart needed                                                                             |
| `build-route-entries: pattern not found for <label>` fails the build            | A head tag in `index.html` that `scripts/build-route-entries.ts` regex-swaps was edited/removed                              | Keep those meta/link tags matchable, or update the corresponding `replaceOnce` pattern in the same PR                                                                                             |
| `git status` shows `public/privacy/index.html` / `terms` modified after a build | Committed pages regenerated with a new CSS hash or footer year (`new Date().getFullYear()`)                                  | Real diff — commit it                                                                                                                                                                             |
| Page renders but is missing from `sitemap.xml`                                  | Not registered in `SITEMAP_PAGES` (`APP_ROUTES` covers only `/designer`, `/baseplate`)                                       | Add the entry                                                                                                                                                                                     |
| Search engines never re-crawl an updated page                                   | `CONTENT_LASTMOD` is hardcoded and was not bumped                                                                            | Bump it in `scripts/build-content.ts`                                                                                                                                                             |
| `gen:seo-images` / `gen:example-thumbnails` hang then time out                  | No dev server on the expected port                                                                                           | Start `pnpm run dev` first; set `BASE_URL` otherwise                                                                                                                                              |
| Localized content page links its logo/CTA to a 404                              | Someone "fixed" `homeUrl` to `/{locale}/` — no localized SPA root exists                                                     | Keep it `/`; in-app i18n auto-detects language (comment in `generateHtml`)                                                                                                                        |

For where landing-page-adjacent UI lives inside the app shell, see the **feature-slices** skill.
