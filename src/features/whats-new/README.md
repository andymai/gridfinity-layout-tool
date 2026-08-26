# What's New

Curated highlights of user-facing changes, shown after an update.

## Adding an entry

Prepend to `entries.ts` and update `LATEST_ENTRY_ID` in `latest.ts`. The minimum
is `id`, `date` and an English `title`; everything else is optional.

The bar is judgment: would you mention this to someone using the tool? Most of
what ships does not, and `CHANGELOG.md` stays the complete record.
`pnpm run check:whats-new` reminds without blocking.

Set `featured: true` on the rare entry worth opening the modal for: the digest
promotes the newest featured one in range to its lead card, in full, with its
action as a button. Nothing can infer this, so unmarked entries never lead.

Copy sits outside the i18n key system so `check:i18n:values` never blocks a
release on 14 translations. Missing locales fall back to English.

## Why the id is duplicated

`entries.ts` is ~10kB gzipped and rides the modal's lazy chunk, but the badge
must answer "anything unseen?" on every cold start. `latest.ts` holds the newest
id as a literal so that stays eager. `latest.test.ts` fails if the two drift.

## When the digest opens

Cold start of a browser session, unseen entries present, seven days since the
last automatic opening. A silent PWA update reload keeps sessionStorage, which is
how `useWhatsNewAutoOpen` tells "you came back" from "the app reloaded under
you". `App.tsx` suppresses it on share links, community, supporters and during
onboarding. Turning off `showUpdateSummaries` stops it opening by itself; the
badge stays.

## One slot, three states

`AppVersionButton` carries both a pending update and unseen highlights:
consecutive states of one story, so they share a slot and the update wins.
`AppVersionRailButton` serves the 48px rail.

## Files

| File                           | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `entries.ts`                   | The curated list, newest first (lazy)       |
| `latest.ts`                    | Newest id, eager, for the badge             |
| `types.ts`                     | Entry shape and the closed action union     |
| `digest.ts`                    | Unseen slicing, capping, grouping, fallback |
| `seenState.ts`                 | localStorage marker and cooldown            |
| `hooks/useWhatsNewAutoOpen.ts` | The open-or-stay-quiet decision             |
| `helpEntries.ts`               | Help-modal entry, kept free of `entries.ts` |
