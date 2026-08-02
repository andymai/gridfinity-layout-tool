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
- `components/PublishDialog/`: the shell-mounted publish dialog (`PublishDialog`, `PublishForm`, `IdentityStep`). Mobile renders it as a fullscreen sheet; desktop as a centered dialog.
- `utils/displayName.ts`: explicit localStorage persistence of the chosen public display name (this repo has no zustand persist middleware).
- `@/shared/utils/communityPendingAction`: sessionStorage stash of a pending publish intent (plus form draft) across the OAuth redirect. Lives in shared, not here, because the designer reads it on mount to resume the flow (the callback always lands on `/`).
