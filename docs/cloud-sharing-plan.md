# Cloud Sharing Feature - Implementation Plan

## Summary

Add Vercel Blob-based layout sharing with user-chosen expiration (30/60/90/365 days), delete tokens, and rate limiting via Vercel KV. No accounts required.

## User Requirements

- **No accounts** - Anonymous sharing
- **User-chosen expiration** - Options: 30, 60, 90, or 365 days
- **Delete via secret token** - Sharer can remove their share
- **Protection against** - Storage spam, offensive content, link bombing
- **Rate limiting** - Vercel KV (Redis-backed)

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Client   │────▶│  Vercel API     │────▶│  Vercel Blob    │
│  (SPA)          │     │  Routes         │     │  (Storage)      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Vercel KV      │
                        │  (Rate Limits)  │
                        └─────────────────┘
```

**Share URL Format:** `https://your-app.vercel.app/s/{12-char-id}`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/share` | POST | Create share (body: layout + expiresInDays) → returns URL + delete token |
| `/api/share/[id]` | GET | Fetch shared layout |
| `/api/share/[id]` | PUT | Update existing share (requires token, resets expiration) |
| `/api/share/[id]` | DELETE | Delete share (requires token) |
| `/api/report/[id]` | POST | Report abusive content |

**Rate Limits (per IP):**
- Create: 10/hour
- View: 100/minute
- Delete: 5/hour
- Report: 10/hour

---

## Security Measures

1. **Size limit**: 500KB max layout JSON
2. **Bin limit**: 2500 bins max (matches existing constant)
3. **Content filter**: Blocklist + pattern matching on text fields
4. **Delete token**: bcrypt-hashed, 32-char hex (128-bit entropy)
5. **Share ID**: 12-char alphanumeric (62^12 combinations)
6. **Expiration options**: 30, 60, 90, or 365 days only (validated server-side)
7. **Auto-expiry**: Vercel Blob's built-in `expiresAt`

---

## Files to Create

```
api/
  share.ts              # POST /api/share
  share/
    [id].ts             # GET/DELETE /api/share/[id]
  report/
    [id].ts             # POST /api/report/[id]
  lib/
    rateLimit.ts        # Vercel KV rate limiting
    validation.ts       # Server-side validation (adapted from client)
    contentFilter.ts    # Offensive content detection

src/
  api/
    share.ts            # API client functions
  hooks/
    useCloudShare.ts    # Share/delete state management
  components/
    CloudShareTab.tsx   # New tab content for ShareModal (includes expiration picker)
```

## Files to Modify

| File | Changes |
|------|---------|
| `vercel.json` | Add rewrites for `/s/:id` and `/api/*` |
| `package.json` | Add `@vercel/blob`, `@vercel/kv`, `bcryptjs` |
| `src/store/library.ts` | Add `cloudShare` field to `LayoutEntry` type |
| `src/components/modals/ShareModal.tsx` | Add "Cloud" tab with re-share support |
| `src/components/SharedLayoutImporter.tsx` | Handle `/s/{id}` URLs |
| `src/utils/storage.ts` | Add `getCloudShareIdFromURL()` |
| `src/App.tsx` | Check for cloud share on mount |

---

## Implementation Phases

### Phase 1: API Infrastructure

1. Add dependencies: `@vercel/blob`, `@vercel/kv`, `bcryptjs`
2. Create `api/lib/rateLimit.ts` - KV-backed rate limiting
3. Create `api/lib/validation.ts` - Server-side layout validation
4. Create `api/lib/contentFilter.ts` - Basic profanity/XSS filter
5. Create `api/share.ts` - POST handler
6. Create `api/share/[id].ts` - GET/DELETE handlers
7. Create `api/report/[id].ts` - Report handler
8. Update `vercel.json` with rewrites

### Phase 2: Client Integration

9. Create `src/api/share.ts` - Fetch wrappers
10. Create `src/hooks/useCloudShare.ts` - State management
11. Create `src/components/CloudShareTab.tsx` - Success UI with delete info
12. Update `ShareModal.tsx` - Add cloud tab as default
13. Update `storage.ts` - Cloud URL detection
14. Update `SharedLayoutImporter.tsx` - Handle cloud share URLs

### Phase 3: Testing & Polish

15. Add E2E tests for share flow
16. Add unit tests for API validation
17. Add graceful fallback to URL-encoded share on failure
18. Update README with share feature docs

---

## Environment Variables

```bash
# Auto-configured when you add Blob store in Vercel dashboard
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Auto-configured when you add KV store in Vercel dashboard
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

---

## Data Stored in Blob

**Path:** `shares/{id}.json`

```typescript
{
  layout: Layout,           // Full layout object
  metadata: {
    deleteTokenHash: string,  // bcrypt hash
    expiresAt: string,        // ISO timestamp
    expiresInDays: number,    // 30, 60, 90, or 365
    createdAt: string,
    authorName?: string,
    reportCount: number,
    ipHash: string            // For abuse correlation
  }
}
```

---

## Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Expired share accessed | 404 with friendly message |
| Delete token shared publicly | Warning in UI, rate limit deletes |
| Very large layout | Client-side size check, clear error |
| Network failure on share | Retry with fallback to URL-encoded |
| Offensive content | Blocklist + patterns, report button |

---

## Cost Estimate (1000 shares/month)

| Service | Usage | Cost |
|---------|-------|------|
| Blob Storage | ~500MB | ~$0.01 |
| Blob Operations | ~11K | Free tier |
| KV Operations | ~20K | Free tier |
| **Total** | | **~$0/month** |

---

## Success Criteria

1. User can share with expiration choice (30/60/90/365 days)
2. Link works until expiration, then 404s gracefully
3. Delete token shown once, works to remove share
4. Rate limiting prevents spam
5. Offensive content blocked at upload
6. Fallback to URL-encoded if cloud fails

---

## Future Considerations (Out of Scope)

- **Community gallery** - Curated/permanent shares, would need moderation
- **Engagement-based expiry** - Extend shares that get views/imports
- **User accounts** - Would unlock persistent shares, favorites, etc.

Start with anonymous shares, revisit based on usage patterns.

---

## Design Decisions

### Shares are Snapshots (Not Live-Linked)

When you share, the layout is copied to the cloud at that moment. Later local edits don't affect the shared version. This matches user expectations for "sharing a file" rather than "collaborating on a document."

**Re-share flow:** If a user wants to update a shared layout:
1. Click "Re-share" button (appears if layout was previously shared)
2. Confirm update - same URL, same expiration reset, same delete token
3. Share is overwritten with current layout state

This keeps the same URL (no need to re-post) while maintaining the snapshot mental model.

---

## Re-share Feature

### Data Model Addition

Store share metadata locally to enable re-sharing:

```typescript
// In LayoutEntry (src/store/library.ts)
interface LayoutEntry {
  // ... existing fields
  cloudShare?: {
    id: string;           // Share ID
    deleteToken: string;  // For updates and deletion
    sharedAt: string;     // ISO timestamp
    expiresAt: string;    // ISO timestamp
  };
}
```

### API Addition

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/share/[id]` | PUT | Update existing share (requires delete token) |

### UI Flow

1. **First share:** "Share to Cloud" button → creates share → stores metadata locally
2. **Re-share:** If `cloudShare` exists and not expired, show "Update Share" button
3. **Update:** PUT to existing share ID → resets expiration timer
4. **Expired share:** Clear local metadata, show "Share to Cloud" (creates new)

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Share expired | Clear local metadata, next share creates new ID |
| Layout duplicated | Clone doesn't inherit cloudShare (gets its own on first share) |
| Delete token lost | Can't update; create new share instead |
| Multiple devices | Each device tracks its own shares (no cross-device sync of tokens)
