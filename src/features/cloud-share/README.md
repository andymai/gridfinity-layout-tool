# Cloud Share

Persistent cloud sharing via Vercel Blob with permission control.

## Key Files

| File                                  | Purpose                                        |
| ------------------------------------- | ---------------------------------------------- |
| `hooks/useCloudShare.ts`              | Main hook: share/update/delete/permission CRUD |
| `hooks/useOwnedShareSync.ts`          | 5s debounced auto-sync for owners              |
| `hooks/useCloudShareAutoSync.ts`      | 1s debounced sync in collab mode               |
| `components/CloudShareTab.tsx`        | Full UI in ShareModal                          |
| `components/ShareButton.tsx`          | Compact header button (collab mode)            |
| `components/SharedLayoutImporter.tsx` | Detects/loads shared layouts from URL          |
| `components/SharedLayoutBanner.tsx`   | View-only banner with save/discard             |

## Data Flow

```
Create: share(permission) → POST /api/share → Blob storage
        → setCloudShare() saves CloudShareInfo to library entry

Auto-sync: Owner edits → useOwnedShareSync (5s debounce)
           → PUT /api/share/{id} with fingerprint check

Import: /l/{shareId} → SharedLayoutImporter → fetchShare()
        → Add to "Shared with me" list
```

## Permission Model

- **`view`**: Read-only, anyone with link can see
- **`edit`**: Collaborative editing (requires Liveblocks flag)
- **Delete token**: Random secret, hashed server-side, required for mutations

## Gotchas

1. **Share ID = Layout UUID** - URL uses layout's own ID
2. **Shares are permanent** - no expiration, only explicit delete
3. **Staging bins never sync** - filtered from fingerprint
4. **Owner can't see own share in "Shared with me"**
5. **Delete while in collab disconnects all users**

## Auto-Sync Behavior

| Hook                    | Who           | Debounce | Trigger              |
| ----------------------- | ------------- | -------- | -------------------- |
| `useOwnedShareSync`     | Owner         | 5s       | Local edits, unmount |
| `useCloudShareAutoSync` | Collaborators | 1s       | Liveblocks mutations |

Both use fingerprint comparison to skip redundant syncs.

## API Layer

Uses Result types: `createShare()`, `updateShare()`, `fetchShare()`, `deleteShare()`

Error codes: `RATE_LIMITED`, `SIZE_LIMIT` (500KB), `BIN_LIMIT` (2500), `CONTENT_BLOCKED`
