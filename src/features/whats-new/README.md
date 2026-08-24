# What's New

Curated highlights of user-facing changes, shown after an update.

## Adding an entry

Prepend to `entries.ts` and update `LATEST_ENTRY_ID` in `latest.ts`. The minimum
is `id`, `date` and an English `title`; `kind`, `body`, `labs`, `icon` and
`action` are all optional.

The bar is judgment, not a rule: would you mention this change to someone using
the tool? Most of what ships does not qualify, and `CHANGELOG.md` remains the
complete record. `pnpm run check:whats-new` reminds without blocking.

Copy lives outside the i18n key system so `check:i18n:values` never blocks a
release on 14 translations. A `title`/`body` carries `en` plus any locales you
have; the rest fall back to English.

## Why the id is duplicated

The badge must answer "anything unseen?" on every cold start, and `entries.ts`
is ~8kB gzipped. `latest.ts` holds the newest id as a literal so the badge stays
eager while the list rides the modal's lazy chunk. `latest.test.ts` fails if the
two drift.

## When the digest opens

Cold start of a browser session, unseen entries present, and at least seven days
since the last automatic opening. A silent PWA update reload keeps
sessionStorage, which is how `useWhatsNewAutoOpen` tells "you came back" from
"the app reloaded under you". `App.tsx` additionally suppresses it on share
links, community, supporters and during the first-run tutorial.

Turning off `showUpdateSummaries` stops the automatic opening only; the sidebar
badge stays.

## Files

| File                     | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `entries.ts`             | The curated list, newest first (lazy)               |
| `latest.ts`              | Newest id, eager, for the badge                     |
| `types.ts`               | Entry shape and the closed action union             |
| `digest.ts`              | Unseen slicing, month grouping, locale fallback     |
| `seenState.ts`           | localStorage marker and cooldown                    |
| `useWhatsNewAutoOpen.ts` | The open-or-stay-quiet decision, mounted in App.tsx |
| `helpEntries.ts`         | Single Help-modal entry (kept free of `entries.ts`) |
