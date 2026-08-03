# Community

Community design showcase (issue #3050): publishing bin designs, browsing them, and remixing them. This slice owns the client side of the publish flow; the backend lives in `api/community.ts`, `api/community/[id].ts`, and `api/lib/community*.ts`.

## Boundary rules

- No cross-feature imports. This slice must never import from `features/bin-designer` (or any other slice), and bin-designer must never import from here.
- Composition with the designer goes through `@/core/store/communityPublish`: the designer opens the publish dialog by calling that core store with a design context and capture payload. The dialog component is mounted at the shell level.
- Shared vocabulary (`CommunityCategory`, `CommunityDesign`, `CommunityDesignLineage`, techniques) lives in `@/shared/types/community` and `@/shared/types/exampleTechniques`, mirrored on the server in `api/lib/communityValidation.ts` (api/ cannot import from src/). Cross-boundary equality tests guard the mirrors.
- Capture (thumbnails, GLB export) stays inside bin-designer; this slice only receives the finished captures via the core store.

## Layout

- `api/client.ts`: Result-typed client for `POST/PUT/DELETE /api/community(/:id)` and owner `GET`. Errors are a typed union (`needsAuth`, `disabled`, `rateLimited`, `quotaExceeded`, `contentBlocked`, `validation`, ...) so the dialog can branch without string matching. All calls suppress the app-wide forced sign-out so a community 401 re-prompts locally instead of flipping the whole app anonymous.
- `store/publishStore.ts`: zustand state machine for the publish dialog: `closed → signin → identity → form → publishing → success | error`.
- `store/browseStore.ts`: browse engine for the gallery: caches the full card index (capped at the 2,000 newest, 5-minute staleness), holds search/category/technique/sort filters with client-side `filterAndSortCards`, and remembers the gallery scroll offset.
- `components/PublishDialog/`: the shell-mounted publish dialog (`PublishDialog`, `PublishForm`, `IdentityStep`). Mobile renders it as a fullscreen sheet; desktop as a centered dialog.
- `components/CommunityGalleryTab/`: gallery tab content with two hosts: the shell's `DesignGalleryModal` tab and the full-page `/community` route (no dialog chrome of its own). Toolbar is inline on desktop (search, technique pills, category, sort) and a single row plus a bottom filter sheet on mobile. Renders the grid in chunks of 24 with Load more, plus skeleton/empty/no-matches/error/offline states. Selecting a card opens the detail overlay through `@/core/store/communityDetail`.
- `components/CommunityCard/`: gallery card: lazy thumbnail with a neutral placeholder, author as plain text, dims-first footer with like/remix counts, corner remix glyph. Hover/long-press angle cycling is deferred until the list index exposes per-card angle URLs (it carries a single `thumbnailUrl` today).
- `components/CommunityPage/`: full-page host for the `/community` route. URL-driven detail: `/community/d/<id>` is pushed on open and restored on back/forward and cold deep links. Also owns the dismissible signed-out intro strip. Routing lives in `@/shared/hooks/useCommunityRouting` so the SPA-route CI guard covers the rewrite.
- `components/CommunityDetail/`: the detail overlay (viewer, lineage, remix/owner actions, history trap). Desktop streams the GLB immediately; mobile is deliberately tap-to-load ("View in 3D") to spare cellular data, a planned deviation from always-instant 3D. The angle strip hides once the model is live, since angle posters sit behind the canvas.
- `utils/displayName.ts`: explicit localStorage persistence of the chosen public display name (this repo has no zustand persist middleware).
- `@/shared/utils/communityPendingAction`: sessionStorage stash of a pending publish intent (plus form draft) across the OAuth redirect. Lives in shared, not here, because the designer reads it on mount to resume the flow (the callback always lands on `/`).

## Print reports ("Prints")

Proof that a published design was actually printed: photos, the settings that worked, and whether it fit as designed. The merit signal the showcase ranks on, chosen over engagement metrics because it cannot be produced without having printed the thing.

- **One record per user per design, editable.** Posting again replaces the existing record, so "printed by N" is a distinct-printer count by construction. `(designId, authorPublicId)` is the identity, so nothing needs a reverse index to address a print.
- **Vocabulary** lives in `@/shared/types/communityPrint` and `@/shared/types/communityPrinters`, mirrored server-side in `api/lib/communityPrintValidation.ts` and `api/lib/communityPrinters.ts`. The cross-boundary test in `communityPrint.test.ts` guards every tuple, limit and range.
- **`fitVerdict`** (`as-designed` / `adjusted` / `did-not-fit`) is the field worth the most: it tells the next printer what to expect, and no amount of posting can fake it.
- **Printers** are a closed curated list plus an `other` free-text escape hatch. Free text alone would turn "X1C", "x1 carbon" and "Bambu X1C" into three unrelated values and make aggregation impossible. Labels are hardware model names and are deliberately not translated.
- **Photos** are re-encoded to WebP at 1200px client-side before upload, which is also what strips EXIF/GPS. The server re-checks bytes, magic framing and canvas dimensions (`readWebpDimensions`), because a byte cap alone does not bound pixels.
- **Moderation mirrors designs exactly**: signed-in only, post-moderated, report threshold auto-hides, deny-list applies, admin purge available. A hidden print leaves the ZSET (so it drops out of the list and the count) but keeps its hash, so the reporter dedupe holds and it cannot be edited back into visibility.
- **Kill switch**: `COMMUNITY_PRINTS_ENABLED`. Unset or anything but `true` makes every method 503.

Client side:

- `utils/printPhoto.ts`: File → upload-ready WebP data URL. Decodes with `imageOrientation: 'from-image'` (without it a portrait phone photo bakes in sideways, since the re-encode then discards the EXIF tag that would have corrected it), downscales to 1200px, then walks a quality ladder and a scale ladder until the encode fits the byte cap. Dropping resolution beats heavy quantisation at the same file size, so quality is exhausted before scale.
- `api/printsClient.ts`: Result-typed client sharing `CommunityClientError` with the design client, so both surfaces branch on one error union.
- `store/printDialogStore.ts`: `closed → signin → form → saving | error` state machine plus the draft, its client-side validation mirror, and the photo slots. Numeric fields stay strings in the draft so a half-typed `0.` does not round-trip through `Number()`.
- `components/PrintDialog/`: the dialog, form, and photo picker. Mounted by the detail overlay rather than at app level, because unlike publishing there is no cross-feature handoff.

`fitVerdict` has no default: a verdict nobody consciously chose is worse than no verdict at all, so it is the one field the form refuses to submit without.

A photo slot is either `kept` (a URL already on the record) or `new` (a fresh data URL). Both travel to the server in one ordered array; the distinction lets an edit change a note without re-uploading images.

- `components/PrintsSection/`: the detail view's print list. Owns its own fetch rather than taking a prop, because the overlay already fetches the caller's own print for the CTA and the two would otherwise have to stay in sync through the parent. The parent bumps `refreshToken` after a write.
- `utils/printFormat.ts`: display rounding. A summary median is rounded to five minutes below the hour and a quarter hour above it, because quoting a 127-minute median to the minute implies precision the sample does not have.

`PrintSummary` drops any figure nobody reported rather than rendering it as zero: an absent number must never read as a measured one. The fit verdicts get their own line, since "4 adjusted" is the part that changes whether you print the thing at all.

`ReportDialog` takes an optional `submit` and `title`, so reporting a print reuses the same reason union, note field and error handling as reporting a design.

Backend lives in `api/community/prints.ts` (`GET`/`PUT`/`DELETE`/`POST report`), `api/lib/communityPrintStore.ts`, and `api/lib/communityPrintValidation.ts`. The `community:index:prints` ZSET is maintained from the moment prints exist but is not yet a member of `COMMUNITY_INDEX_SORTS`: exposing the "most printed" sort is a separate change, so that when it lands its scores are already correct rather than needing a backfill.

### Surfacing

- **Card count**: `counts.prints` rides the list index and renders on the card in full-strength text, where likes and remixes are tertiary. Proof of print outranks the engagement counts by design.
- **`prints` is a queryable sort** (`community:index:prints`, a member of `COMMUNITY_INDEX_SORTS`). Newest stays the default so new publishers still get seen.
- **Proven shelf** sits directly under staff picks, above recency: a design other people actually printed is the strongest recommendation the library has, and it is the one signal nobody can inflate by posting.
- **Cover promotion** is owner opt-in and server-validated against the design's own **live** prints. The gallery grid is the most public surface in the app, and this is the only path by which a user-supplied image can reach it, so the check that the URL belongs to a live print of that design is load-bearing, not defensive. A hidden print's photo is not promotable.

Note that `counts.exports` means file downloads, not prints. The two are different signals and the UI must not conflate them.

## Deferred to later PRs

- Mine/Liked filter chips: land with the Mine view (author filtering) PR alongside like/report actions.
- Card hover/long-press angle cycling: needs angle URLs in the list index (`toListItem`).
- Detail stats for deep links: the detail GET does not return counts, so the stats row only renders when the detail opens from a browse card.
