# Community

Community design showcase (issue #3050): publishing bin designs, browsing them, and remixing them. This slice owns the client side of the publish flow; the backend lives in `api/community.ts`, `api/community/[id].ts`, and `api/lib/community*.ts`.

## Boundary rules

- No cross-feature imports. This slice must never import from `features/bin-designer` (or any other slice), and bin-designer must never import from here.
- Composition with the designer goes through `@/core/store/communityPublish`: the designer opens the publish dialog by calling that core store with a design context and capture payload. The dialog component is mounted at the shell level.
- Shared vocabulary (`CommunityCategory`, `CommunityDesign`, `CommunityDesignLineage`, techniques) lives in `@/shared/types/community` and `@/shared/types/exampleTechniques`, mirrored on the server in `api/lib/communityValidation.ts` (api/ cannot import from src/). Cross-boundary equality tests guard the mirrors.
- Capture (thumbnails, GLB export) stays inside bin-designer; this slice only receives the finished captures via the core store.

## Layout

- `api/client.ts`: Result-typed client for `POST/PUT/DELETE /api/community(/:id)` and owner `GET`. Errors are a typed union (`needsAuth`, `disabled`, `rateLimited`, `quotaExceeded`, `contentBlocked`, `validation`, ...) so the dialog can branch without string matching. All calls suppress the app-wide forced sign-out so a community 401 re-prompts locally instead of flipping the whole app anonymous. Also carries `fetchCommunityCapabilities` (see below).
- `store/publishStore.ts`: zustand state machine for the publish dialog: `closed → loading → form → publishing → success`, with `unavailable` as the terminal branch off `loading`.

  **`error` is not a phase.** A failed publish returns to `form` with the failure attached. It used to unmount the form, so a server complaint about the name ("too short", "low effort", "duplicate") became a full-screen dead end that discarded the user's view of what they had typed.

- `store/browseStore.ts`: browse engine for the gallery: caches the full card index (capped at the 2,000 newest, 5-minute staleness), holds search/category/technique/sort filters with client-side `filterAndSortCards`, and remembers the gallery scroll offset.
- `components/PublishDialog/`: the shell-mounted publish dialog. Mobile renders it as a fullscreen sheet; desktop as a centered dialog. One review screen rather than a phase gauntlet: `PublishDialog` orchestrates, `PublishForm` is the screen, and `PublishArtefact` / `PublishPreview` / `CategoryChips` / `PublisherIdentity` / `CoverImageSection` are its parts. `publishErrors.ts` decides where a failure appears; `useOwnDesignPrefill.ts` owns update-mode reconciliation.

  **The screen splits by who authored what.** `PublishArtefact` (the `Dialog.Sidebar` rail) holds everything derived from the design: preview, angle strip, grid and millimetre size, detected techniques, remix lineage. The pane beside it holds everything the publisher types: name, description, category, public name. Each column stays legible while the other is being read or edited, and the whole review fits without an inner scroll box. Below `md` the split stacks, design first.

  The footer's leading slot carries the licence disclosure, and swaps to the reason the primary is disabled when there is one — those never apply at the same time, and the reason has to sit where the disabled button is.

  Owner actions (currently Unpublish) hang off a header `⋮` menu. They act on the published record rather than on the edit in progress, and the confirm dialog is the real guard.

### Publish flow rules

Four things shape it, each replacing something that failed a real user:

- **Capability probe before the form.** `community_showcase` is a per-user Labs flag over the UI, `defaultEnabled` so it is on for everyone who has not switched it off; `COMMUNITY_PUBLISH_ENABLED` is a deployment kill switch with no client-side shadow. Without `GET /api/community?capabilities=1` the only way to discover publishing is off is to POST a finished design and read the 503, after a sign-in and an OAuth redirect. A probe that _fails_ falls through to the form: an unreachable probe says nothing about the switch, and the publish attempt is still the real gate.
- **Sign-in is deferred to the publish attempt**, and the fields are validated first, so an invalid name never costs an OAuth round trip. The draft rides `savePendingPublishAction`; the public name rides localStorage, which survives the redirect independently.
- **Errors are routed, not announced.** `presentPublishError` maps each failure to a field or to the banner. The server names the field it rejected, so burying that in a dialog-level message makes the user hunt for which input is at fault. A content-filter rejection is deliberately banner-level: the filter does not say which field tripped it, and guessing points at the wrong one.
- **The cutout policy does not gate the entry button.** It used to, explained only by a `title` tooltip, which does not exist on touch: a phone user got a dead button and no reason. The dialog states the policy against a preview of their design instead.

Identity is a line on the form (`Publishing as X · Change`), not a step. As a step it was walked once by every publisher and could then never be revisited.

**No photo upload at publish.** `CommunityPublishInput` carries generated renders and a GLB only. The one path a user photo reaches a gallery card is cover promotion, which the server validates against the design's own live prints, and that check is what keeps the most public surface in the app bounded. `CoverImageSection` surfaces that path in update mode rather than opening a second one.

- `components/CommunityGalleryTab/`: gallery tab content with two hosts: the shell's `DesignGalleryModal` tab and the full-page `/community` route (no dialog chrome of its own). Toolbar is one control row (search, sort, filter disclosure) plus a chip row, on every width. Renders the grid in chunks of 24 with Load more, plus skeleton/empty/no-matches/error/offline states. Selecting a card opens the detail overlay through `@/core/store/communityDetail`.

  **The filter disclosure is the whole toolbar's shape.** Category, the ten technique pills and the five size selects live in `FilterSheet` on desktop as well as mobile. Inline they were three permanent rows of chrome — roughly a third of a short window spent on filters nobody had asked for yet — before a single card was visible.

  Collapsing them makes surfacing the active ones mandatory, not optional: `GalleryToolbar` renders a removable chip per active category, technique and size constraint, because otherwise closing the panel hides the reason the grid is short and a filtered gallery reads as an empty one. `dimensionSummary.ts` folds the five size fields into one chip (`W 2–4 · H ≤6`) whose dismiss clears every axis.

- `components/CommunityCard/`: gallery card: lazy thumbnail with a neutral placeholder, author as plain text, dims-first footer with like/remix counts, corner remix glyph. Hover/long-press angle cycling is deferred until the list index exposes per-card angle URLs (it carries a single `thumbnailUrl` today).
- `components/CommunityPage/`: full-page host for the `/community` route. URL-driven detail: `/community/d/<id>` is pushed on open and restored on back/forward and cold deep links. Routing lives in `@/shared/hooks/useCommunityRouting` so the SPA-route CI guard covers the rewrite.

  **The page wears the app's chrome.** It renders `ToolSwitcher` + `HeaderSupportLinks` like every other surface, so a visitor who followed a shared link has the whole app in the header. Below it, a title row carries the page name, the `Experimental` badge and one CTA.

  **Nothing in the app navigates into this route.** Browsing from inside happens in the gallery modal; the route exists for arriving from outside on a shared `/community/d/<id>` link. That is why the switcher shows no active segment here — you are not in an editor — and why every segment stays live, making the switcher the way out. The in-app entry point is the bin designer's Community panel card, which opens the modal on its Community tab (`open('community')` on the gallery store, honoured by `useGalleryTab`).

  Community is deliberately **not** a segment in that switcher. Those three are editors of one drawer, which is what the grouping means; a fourth segment made the control wide enough to truncate the design name beside it, and spent the header's best space on its least frequent action.

  That CTA leaves for the designer **before** asking to publish. The publish dialog captures thumbnails and a GLB from the live mesh, which only exists while the designer is mounted, so publishing straight from this route would open a dialog that can never finish its preview. A visitor with nothing saved is sent to the designer alone.

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

### Gap fit

`utils/gapFit.ts` answers whether a design fits the gap the viewer picked in the layout editor. It is the **single** implementation: the browse filter and the detail view both call it, because filtering a card out of the grid and telling someone "this will not fit" are the same question and must never disagree.

**The gap-picking gesture has its own flag, `community_fits_gap`, opt-in.** It claims the right button on the grid and suppresses the browser context menu there, which is a layout-editor interaction change rather than a consequence of the showcase being available. `community_showcase` gates the gallery, the publish action and the Community tool; it deliberately does not reach into the grid.

It encodes three things that are easy to get wrong:

- **Rotation counts.** Placement probes both orientations, so a 2x3 design does fit a 3x2 gap. The verdict distinguishes `fits` from `fits-rotated` so the detail can say which.
- **Scale is checked first.** Comparing footprints across different `gridUnitMm` compares numbers that do not mean the same thing, and placement hard-rejects the mismatch anyway.
- **Height is checked before footprint**, so a design that fails both reports the ceiling as the reason.

An explicit toolbar bound overrides the corresponding gap dimension while keeping the rest of the context (notably the grid scale), so precedence stays one comparison rather than two competing ones.

### Featured, with a reason

`featured` no longer travels alone. Featuring a design through the admin CLI now **requires** `--reason <well-made|clever|versatile|beginner-friendly>`, and the gallery card shows that reason instead of a bare star.

A closed set rather than free text: it is user-facing copy that has to translate, and it forces the pick into a stated reason. The vision's rule is that a ranking signal stays legible, and an unexplained star was the least legible thing in the feature.

The reason is cleared on unfeature, so a later re-feature cannot silently inherit a previous decision. A design featured before the field existed shows no badge rather than an invented reason.

Note the i18n key segments are camelCase (`...reason.wellMade`) while the union values are hyphenated (`well-made`). The keys follow the codebase convention, and the unused-key checker's literal scan does not match hyphens.

### Editorial collections

`data/collections.ts` holds hand-picked groups of designs, curated by PR. Human taste is the honest alternative to an engagement algorithm, and unlike an algorithm it does not pretend to be objective. Keeping the list in the repo means curation is reviewable, diffable and revertible, and needs no admin UI or storage.

`utils/resolveCollections.ts` is where those intentions meet reality:

- **Curated order is preserved exactly.** The sequence is part of the editorial judgement, so the index order never overrides it.
- **Non-live and unknown ids are skipped**, and reported as `missingIds` so a curator can tell "not published yet" from "my ids are wrong".
- **A collection with nothing left to show is dropped.** An empty shelf advertises a grouping and then fails to deliver it, so curation never has to be undone because a design went away.

Each rail marks the edges that actually hide something: `useScrollEdges` measures the scroller and the fade plus its nudge button render only against an overflowing side. A permanent gradient is the easy version and the wrong one — on a shelf that fits it implies cards that are not there, and at the true end it veils the last card behind a hint that it is not the last card. The buttons are desktop-only and out of the tab order: touch swipes, and a keyboard already scrolls the rail by focusing the cards inside it, so they would be two extra stops to nothing new.

A derived shelf needs `SHELF_MIN_CARDS` (3) to render at all. The rails are about ten cards wide on a desktop window, so one or two read as a layout fault rather than a short list, and nothing is lost: a suppressed card is still in the grid below and still reachable through the shelf's own "See all". Curated collections are exempt, because a human chose those and a collection of one is a deliberate pick rather than a thin derivation.

Curated shelves render above the derived ones: a human vouched for these, which is a stronger claim than any derived shelf can make. They carry a blurb (the reason the grouping exists) and no "See all", because a collection is a pick rather than a filter.

The shipped list is deliberately empty. The mechanism is the engineering deliverable; the picks are a separate content decision, made by opening a PR against that file. Adding one means adding its two i18n keys across all locales, since editorial copy is user-facing like everything else.

### Remix ancestry

`components/CommunityDetail/RemixLineage.tsx` replaces the old one-line lineage sentence with a navigable strip: root (when it differs from the parent), parent, then this design.

**Deliberately not called a tree.** The stored lineage is only `parentId` and `rootId`, so when those differ there may be steps in between that were never recorded. Drawing a continuous chain would imply completeness the data does not have, so the strip states the gap instead of smoothing over it.

A parent that is gone is labelled and _not_ linked: its detail fetch would 404, and a dead link is worse than a plainly labelled dead end. A live parent's current name and author win over the publish-time snapshot.

### Author portrait

`components/AuthorSummary/` renders a derived portrait while the gallery is filtered to one author: how many designs, since when, what they mostly make, and how often their work has been printed or built upon.

Everything is derived from cards already loaded, so it adds no request. **No self-authored bio by design**: a bio answers "how does this person present themselves", where the useful question is "what do they make, and does it work", and it would be a new moderation surface for the weaker answer.

Zero-valued proof signals are omitted rather than shown: "built on 0 times" says nothing while looking like a measurement. When the browse index is capped, the portrait says so, because an understated count that looks authoritative is worse than one that states its own limits.

### Print cost

`components/PrintCostPanel/` answers "what will this cost me" before you commit, from `@/shared/utils/communityPrintCost`.

The rule that shapes it: **observed beats estimated, and the difference is never hidden.** A model estimate and the median of twelve real prints are different kinds of claim, so each figure carries a `source` the panel renders as a distinct badge. Time and filament resolve independently, because reporting filament is optional and an observed time beside an estimated weight is the normal case.

Observed data only displaces the model at `OBSERVED_MIN_SAMPLE` (2) reports: one person's print is a data point, not a distribution.

The estimator itself is bin-designer internal, so the wrapper lives in `shared/` (the sanctioned bridge, as in `shared/items/bin/descriptor.ts`) rather than being imported across slices. `estimateCommunityPrint` propagates whatever the estimator throws; `PrintCostPanel` is what catches it, because a design published by an older client can carry params this build cannot read, and that must not take the detail view down. Other callers need their own handling.

Bed fit compares the footprint against the viewer's configured bed and allows rotation, since every slicer will rotate it for you.

Note that `counts.exports` means file downloads, not prints. The two are different signals and the UI must not conflate them.

## Deferred to later PRs

- Mine/Liked filter chips: land with the Mine view (author filtering) PR alongside like/report actions.
- Card hover/long-press angle cycling: needs angle URLs in the list index (`toListItem`).
- Detail stats for deep links: the detail GET does not return counts, so the stats row only renders when the detail opens from a browse card.
