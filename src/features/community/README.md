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
- `components/CommunityGalleryTab/`: gallery tab content hosted inside the shell's `DesignGalleryModal` (no dialog chrome of its own). Toolbar is inline on desktop (search, technique pills, category, sort) and a single row plus a bottom filter sheet on mobile. Renders the grid in chunks of 24 with Load more, plus skeleton/empty/no-matches/error/offline states. Selecting a card opens the detail overlay through `@/core/store/communityDetail`.
- `components/CommunityCard/`: gallery card: lazy thumbnail with a neutral placeholder, author as plain text, dims-first footer with like/remix counts, corner remix glyph. Hover/long-press angle cycling is deferred until the list index exposes per-card angle URLs (it carries a single `thumbnailUrl` today).
- `components/CommunityDetail/`: the detail overlay (viewer, lineage, remix/owner actions, history trap). Desktop streams the GLB immediately; mobile is deliberately tap-to-load ("View in 3D") to spare cellular data, a planned deviation from always-instant 3D. The angle strip hides once the model is live, since angle posters sit behind the canvas.
- `utils/displayName.ts`: explicit localStorage persistence of the chosen public display name (this repo has no zustand persist middleware).
- `@/shared/utils/communityPendingAction`: sessionStorage stash of a pending publish intent (plus form draft) across the OAuth redirect. Lives in shared, not here, because the designer reads it on mount to resume the flow (the callback always lands on `/`).

## Deferred to later PRs

- Mine/Liked filter chips: land with the Mine view (author filtering) PR alongside like/report actions.
- Card hover/long-press angle cycling: needs angle URLs in the list index (`toListItem`).
- Detail stats for deep links: the detail GET does not return counts, so the stats row only renders when the detail opens from a browse card. Revisit with the `/community/d/<id>` route PR.
- The Share button and publish success screen copy `/community/d/<id>` URLs; the route itself ships in the next PR, so both PRs must reach production as one deploy.
