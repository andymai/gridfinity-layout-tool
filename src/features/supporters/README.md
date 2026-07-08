# Supporters

Standalone `/supporters` thank-you page: every Ko-fi supporter is rendered as a
Gridfinity bin snapped into a baseplate. No amounts, no tiers, no visible count —
every bin is equal, and order is shuffled per load so no one is first or last.

## Key files

- `data/supporters.json` — backfilled display names + `anonymousCount`. **Names only; never store emails or amounts.** Append new named supporters or bump `anonymousCount`.
- `utils/supportersData.ts` — `buildSupporterBins(rng?)` expands the JSON into a shuffled bin list (injectable RNG for deterministic tests); `getSupporterCount()` for the a11y label.
- `components/SupportersPage/` — the page. Uses design-system `Button`, semantic color tokens, `motion-safe:` for hover/entrance (reduced-motion safe).

## Wiring (outside this slice)

- Route detection + navigation: `src/shared/hooks/useSupportersRouting.ts`.
- Render gate, SEO meta, command-palette disable: `src/App.tsx` (mirrors the `/baseplate` route).
- Entry points: `AttributionFooter` link, command palette (`view-supporters`), and the support surface.

## Gotchas

- The page renders **before** App.tsx's mobile/tablet/desktop trees, so its single CSS-grid layout must be responsive on its own (it uses `auto-fill` columns).
- Anonymous supporters (Ko-fi default name "Supporter") render as equal muted "Anonymous" bins, not a collapsed count.
- The CTA fires `kofi_clicked` with `source: 'supporters_page'` — shows up in the Ko-fi-by-placement insight.
