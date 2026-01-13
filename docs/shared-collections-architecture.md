# Shared Collections - Technical Architecture

> **Status:** Approved for Implementation
> **Last Updated:** January 2026
> **Target Users:** Teams sharing layouts across devices (e.g., robotics workshops)

## Table of Contents

1. [Overview](#overview)
2. [Core Model](#core-model)
3. [Data Types](#data-types)
4. [Storage Architecture](#storage-architecture)
5. [Backend API](#backend-api)
6. [Sync Mechanism](#sync-mechanism)
7. [Conflict Resolution](#conflict-resolution)
8. [UI Components](#ui-components)
9. [Help & Onboarding](#help--onboarding)
10. [Migration Strategy](#migration-strategy)
11. [File Structure](#file-structure)
12. [Testing Strategy](#testing-strategy)
13. [Implementation Phases](#implementation-phases)

---

## Overview

### What It Is

Shared Collections allow multiple people to collaborate on a set of layouts without requiring user accounts. Anyone with the collection link can view and edit layouts. Changes sync automatically via polling.

### Key Features

- **Link-based sharing** - No accounts, anyone with URL can join
- **Edit & view-only links** - Share full access or read-only as needed
- **Multiple layouts per collection** - Up to 50 layouts grouped together
- **Auto-sync** - Changes push automatically, poll every 30 seconds
- **Offline support** - Queue changes locally, sync when reconnected
- **Conflict resolution** - Detect concurrent edits, let user choose resolution
- **Data preservation** - Local cache with IndexedDB ensures no data loss
- **QR code sharing** - Easy sharing for workshop environments

### What It's Not

- Not real-time collaboration (no cursors, no live presence beyond "someone is editing")
- Not version history (no ability to revert to previous versions)
- Not granular access control (two modes only: edit or view-only)

---

## Core Model

### Decision Summary

| Aspect | Decision |
|--------|----------|
| Layout scope | Exclusive - each layout belongs to one collection only |
| Local vs collection | Separate - local layouts stay distinct from collection layouts |
| Multi-collection | Yes - users can be members of multiple collections |
| Delete rights | Anyone with edit link can delete (trust-based) |
| Layout limit | 50 layouts per collection (warning at 45+) |
| Expiration | 2 years of inactivity |
| URL format | `/c/{id}` for edit, `/c/{id}/view` for read-only |
| Layout ordering | By modified time (most recent first) |
| Duplicate names | Auto-suffix with (2), (3), etc. |

### Layout Operations

| Action | Behavior |
|--------|----------|
| Add to collection | Create new OR copy from local (one at a time) |
| Copy out | Save collection layout to My Layouts |
| Rename collection | Anyone can rename |
| Rename layout | Anyone can rename any layout |
| Duplicate layout | Creates copy in same collection with auto-suffixed name |
| Remove layout | Anyone can remove (with warning about affecting others) |

### Sharing Options

| Feature | Details |
|---------|---------|
| Edit link | `/c/{id}` - Full access: view, edit, add, delete |
| View-only link | `/c/{id}/view` - Browse and view only, no modifications |
| QR code | Generate QR code button for easy workshop sharing |
| Link previews | Open Graph meta tags for Slack/Discord/social media |

### Collection Membership

| Aspect | Behavior |
|--------|----------|
| Leave collection | Explicit "Leave Collection" button in menu |
| Auto-cleanup | Collections not accessed in 30 days fade from list (can re-join via link) |
| Local cache | Preserved on leave - can recover layouts if needed |

### Navigation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYOUT MANAGER MODAL                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┬──────────────────┐                        │
│  │   My Layouts     │   Collections    │  ← Segmented control   │
│  └──────────────────┴──────────────────┘                        │
│                                                                  │
│  "My Layouts" mode:                                             │
│  └── Shows local layouts (existing behavior)                    │
│                                                                  │
│  "Collections" mode:                                            │
│  └── Shows list of joined collections                           │
│      └── Click collection → shows layouts inside                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Types

### New Types (`src/types.ts`)

```typescript
// ============================================================
// SHARED COLLECTIONS TYPES
// ============================================================

/**
 * A shared collection that groups multiple layouts under one URL.
 * Anyone with the link can view and edit layouts in the collection.
 */
export interface Collection {
  id: string;                      // 12-char alphanumeric (e.g., "abc123def456")
  name: string;                    // Display name, max 64 chars
  createdAt: number;               // Unix timestamp ms
  modifiedAt: number;              // Updated on any layout change
  expiresAt: number;               // Auto-delete after 2 years inactivity
  layoutCount: number;             // Cached count for display
}

/**
 * Lightweight reference to a layout within a collection.
 * Used for listing without loading full layout data.
 */
export interface CollectionLayoutRef {
  id: string;                      // Layout UUID
  name: string;                    // Layout name
  modifiedAt: number;              // Last modified timestamp
  modifiedBy?: string;             // Device identifier (for presence)
  preview: LayoutPreview;          // Cached thumbnail data
}

/**
 * Response from poll endpoint - minimal data for change detection.
 */
export interface CollectionPollResponse {
  collectionModifiedAt: number;    // Collection's last modification
  layouts: Array<{
    id: string;
    modifiedAt: number;
    activeEditors: number;         // Count of devices editing (heartbeat-based)
  }>;
}

/**
 * Conflict information when server has newer version.
 */
export interface CollectionConflict {
  layoutId: string;
  layoutName: string;
  localVersion: Layout;
  serverVersion: Layout;
  localModifiedAt: number;
  serverModifiedAt: number;
}

/**
 * Local state for tracking collection membership.
 * Stored in localStorage for quick access.
 */
export interface CollectionMembership {
  collectionId: string;
  collectionName: string;
  joinedAt: number;
  lastSyncAt: number;
  lastAccessedAt: number;          // For sorting collections by recency
}

/**
 * Timestamps tracked for each layout in a collection.
 */
export interface LayoutSyncState {
  modifiedAt: number;              // Server's authoritative timestamp
  localModifiedAt?: number;        // When we last modified locally (before push)
  lastSyncAt: number;              // When we last synced with server
}
```

---

## Storage Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT STORAGE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  localStorage (small, fast, synchronous)                        │
│  ├── gridfinity-library-v1         # Layout library index       │
│  ├── gridfinity-settings-v1        # User preferences           │
│  ├── gridfinity-collections-v1     # Collection memberships     │
│  └── gridfinity-migrated-v1        # Migration flag             │
│                                                                  │
│  IndexedDB: "gridfinity-db" (large, async, compressed)          │
│  ├── layouts                       # Object store               │
│  │   └── {uuid} → { id, data: compressedJSON }                  │
│  └── collection-cache              # Object store               │
│      └── {collId}:{layoutId} → { id, data: compressedJSON,      │
│                                   syncState: LayoutSyncState }  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     SERVER STORAGE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Vercel Blob                                                    │
│  ├── collections/{id}/meta.json    # Collection metadata        │
│  └── collections/{id}/layouts/{layoutId}.json  # Full layouts   │
│                                                                  │
│  Upstash Redis                                                  │
│  ├── collection:{id}:modified      # Last modified timestamp    │
│  ├── collection:{id}:layouts       # Hash: layoutId → modifiedAt│
│  ├── collection:{id}:heartbeat     # Hash: deviceId → timestamp │
│  └── ratelimit:collection:{ip}     # Rate limiting              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Compression

All layout data in IndexedDB is compressed using LZ-string:

```typescript
import LZString from 'lz-string';

// Compress before storing
const compressed = LZString.compressToUTF16(JSON.stringify(layout));
await db.put('layouts', { id: layoutId, data: compressed });

// Decompress when reading
const record = await db.get('layouts', layoutId);
const layout = JSON.parse(LZString.decompressFromUTF16(record.data));
```

**Size reduction:** ~60-70% (50KB layout → ~15-20KB compressed)

### Storage Limits

| Storage | Limit | Our Usage (Power User) |
|---------|-------|------------------------|
| localStorage | 5 MB | ~100 KB (metadata only) |
| IndexedDB | 50+ MB | ~5-10 MB (100 layouts compressed) |

---

## Backend API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/collection` | Create new collection |
| `GET` | `/api/collection/:id` | Get collection + layout list |
| `GET` | `/api/collection/:id/view` | Get collection (view-only mode) |
| `PUT` | `/api/collection/:id` | Update collection metadata (rename) |
| `DELETE` | `/api/collection/:id` | Delete entire collection |
| `GET` | `/api/collection/:id/poll` | Lightweight poll for changes |
| `POST` | `/api/collection/:id/heartbeat` | Report active editing |
| `POST` | `/api/collection/:id/layout` | Add layout to collection |
| `GET` | `/api/collection/:id/layout/:layoutId` | Get full layout data |
| `PUT` | `/api/collection/:id/layout/:layoutId` | Update layout (with conflict check) |
| `DELETE` | `/api/collection/:id/layout/:layoutId` | Remove layout from collection |
| `GET` | `/api/collection/:id/og-image` | Generate Open Graph image for link previews |
| `GET` | `/api/collection/:id/qr` | Generate QR code image |

### Request/Response Schemas

#### Create Collection

```typescript
// POST /api/collection
// Request:
{
  name: string;                    // Collection name (max 64 chars)
  initialLayout?: Layout;          // Optional first layout
}

// Response (201):
{
  id: string;                      // 12-char alphanumeric
  name: string;
  createdAt: number;
  expiresAt: number;               // 2 years from now
  url: string;                     // Full shareable URL
  layouts: CollectionLayoutRef[];  // Empty or contains initial layout
}
```

#### Poll for Changes

```typescript
// GET /api/collection/:id/poll
// Headers:
//   If-Modified-Since: <timestamp>  (optional, for 304 responses)

// Response (200):
{
  modifiedAt: number;
  layouts: Array<{
    id: string;
    modifiedAt: number;
    activeEditors: number;         // From heartbeat data
  }>;
}

// Response (304): Not Modified (if collection unchanged)
```

#### Update Layout (with Conflict Detection)

```typescript
// PUT /api/collection/:id/layout/:layoutId
// Request:
{
  layout: Layout;
  expectedModifiedAt: number;      // Optimistic concurrency control
}

// Response (200): Success
{
  modifiedAt: number;              // New server timestamp
}

// Response (409): Conflict
{
  code: 'CONFLICT';
  serverModifiedAt: number;
  serverLayout: Layout;            // Current server version
}
```

#### Heartbeat (Presence)

```typescript
// POST /api/collection/:id/heartbeat
// Request:
{
  layoutId: string;                // Layout being edited
  deviceId: string;                // Unique device identifier
}

// Response (200):
{
  acknowledged: true;
}

// Heartbeats expire after 60 seconds of no updates
```

### Rate Limits

| Action | Limit | Window |
|--------|-------|--------|
| Create collection | 5 | per hour per IP |
| Add layout | 20 | per hour per IP |
| Update layout | 120 | per hour per IP |
| Poll | 2000 | per hour per IP |
| Heartbeat | 2000 | per hour per IP |
| Fetch layout | 200 | per hour per IP |

### Error Responses

```typescript
interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;             // For rate limiting
}

// Error codes:
// - NOT_FOUND: Collection or layout doesn't exist
// - CONFLICT: Concurrent modification detected
// - RATE_LIMITED: Too many requests
// - VALIDATION_ERROR: Invalid input
// - COLLECTION_FULL: 50 layout limit reached
// - PAYLOAD_TOO_LARGE: Layout exceeds 500KB
// - COLLECTION_EXPIRED: Collection auto-deleted
```

---

## Sync Mechanism

### State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYNC STATE MACHINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    join collection    ┌───────────┐               │
│  │   IDLE   │ ──────────────────────▶│  SYNCING  │               │
│  └──────────┘                        └─────┬─────┘               │
│       ▲                                    │                     │
│       │ leave collection                   │ initial sync done   │
│       │                                    ▼                     │
│       │                             ┌───────────┐                │
│       │                             │  POLLING  │◀───────┐       │
│       │                             └─────┬─────┘        │       │
│       │                                   │              │       │
│       │                    poll response  │   30 seconds │       │
│       │              ┌────────────────────┼──────────────┘       │
│       │              │                    │                      │
│       │              ▼                    ▼                      │
│       │      ┌─────────────┐      ┌─────────────┐               │
│       │      │ NO_CHANGES  │      │   CHANGED   │               │
│       │      └──────┬──────┘      └──────┬──────┘               │
│       │             │                    │                       │
│       │             │                    │ fetch changed layouts │
│       │             │                    ▼                       │
│       │             │            ┌─────────────┐                │
│       │             │            │   MERGING   │                │
│       │             │            └──────┬──────┘                │
│       │             │                   │                        │
│       │             │      ┌────────────┼────────────┐          │
│       │             │      ▼            ▼            ▼          │
│       │             │  ┌───────┐  ┌──────────┐  ┌──────────┐   │
│       │             │  │ CLEAN │  │ PUSH_NEW │  │ CONFLICT │   │
│       │             │  │(apply)│  │ (upload) │  │ (prompt) │   │
│       │             │  └───┬───┘  └────┬─────┘  └────┬─────┘   │
│       │             │      │           │             │          │
│       │             └──────┴───────────┴─────────────┘          │
│       │                              │                           │
│       └──────────────────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Polling Behavior

| Condition | Behavior |
|-----------|----------|
| Tab visible, online | Poll every 30 seconds |
| Tab hidden | Pause polling |
| Tab becomes visible | Immediate poll, then resume 30s interval |
| Offline | Pause polling, queue local changes |
| Back online | Immediate poll, push queued changes |

### Change Detection Logic

```typescript
function processPollResponse(poll: CollectionPollResponse) {
  for (const serverRef of poll.layouts) {
    const local = getLocalLayout(serverRef.id);
    const syncState = getSyncState(serverRef.id);

    if (!local) {
      // New layout from another device
      fetchAndAddLayout(serverRef.id);
      continue;
    }

    if (syncState.modifiedAt === serverRef.modifiedAt) {
      // No changes
      continue;
    }

    const hasLocalChanges = syncState.localModifiedAt !== undefined;
    const serverIsNewer = serverRef.modifiedAt > syncState.modifiedAt;

    if (hasLocalChanges && serverIsNewer) {
      // CONFLICT: Both sides changed
      showConflictDialog(serverRef.id);
    } else if (hasLocalChanges && !serverIsNewer) {
      // Only local changes: push to server
      pushLayout(serverRef.id);
    } else if (!hasLocalChanges && serverIsNewer) {
      // Only server changed: pull and apply
      fetchAndUpdateLayout(serverRef.id);
    }
  }

  // Handle deleted layouts
  for (const localId of getLocalLayoutIds()) {
    if (!poll.layouts.find(s => s.id === localId)) {
      handleLayoutDeleted(localId);
    }
  }
}
```

### Auto-Push (Debounced)

```typescript
// Push changes 2-3 seconds after user stops editing
const PUSH_DEBOUNCE_MS = 2500;

function onLayoutChange(layoutId: string, layout: Layout) {
  // Mark as locally modified
  updateSyncState(layoutId, { localModifiedAt: Date.now() });

  // Save to IndexedDB immediately
  saveToIndexedDB(layoutId, layout);

  // Debounce push to server
  debouncedPush(layoutId, layout);
}

const debouncedPush = debounce(async (layoutId: string, layout: Layout) => {
  if (!navigator.onLine) {
    // Queue for later
    addToOfflineQueue(layoutId, layout);
    return;
  }

  const syncState = getSyncState(layoutId);
  const result = await pushLayout(layoutId, layout, syncState.modifiedAt);

  if (result.success) {
    updateSyncState(layoutId, {
      modifiedAt: result.modifiedAt,
      localModifiedAt: undefined,
    });
  } else if (result.code === 'CONFLICT') {
    showConflictDialog(layoutId, result.serverLayout);
  }
}, PUSH_DEBOUNCE_MS);
```

### Update Highlighting

When changes are pulled from server, briefly highlight affected bins:

```typescript
function applyServerChanges(layoutId: string, serverLayout: Layout) {
  const localLayout = getLocalLayout(layoutId);

  // Find changed bins
  const changedBinIds = findChangedBins(localLayout, serverLayout);

  // Apply changes
  importLayout(serverLayout, layoutId);

  // Highlight changed bins for 2 seconds
  if (changedBinIds.length > 0) {
    setHighlightedBins(changedBinIds);
    setTimeout(() => setHighlightedBins([]), 2000);
  }
}
```

---

## Conflict Resolution

### Detection

Conflict occurs when:
1. User has local changes (`localModifiedAt` is set)
2. Server version is newer (`serverModifiedAt > modifiedAt`)

### Resolution Options

| Option | Description | Server Action |
|--------|-------------|---------------|
| Keep mine | Overwrite server with local | PUT with `force: true` |
| Use theirs | Discard local, use server | Apply server version locally |
| Save both | Keep server, save local as copy | POST new layout with timestamped name |

### UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Conflict Detected                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Station 2" was modified by someone else while you             │
│  were editing.                                                   │
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │   Your Changes      │    │   Their Changes     │             │
│  │   ┌───┬───┬───┐     │    │   ┌───┬───┬───┐     │             │
│  │   │ █ │ █ │   │     │    │   │ █ │   │ █ │     │             │
│  │   ├───┼───┼───┤     │    │   ├───┼───┼───┤     │             │
│  │   │   │ █ │ █ │     │    │   │ █ │ █ │   │     │             │
│  │   └───┴───┴───┘     │    │   └───┴───┴───┘     │             │
│  │   Modified: now     │    │   Modified: 30s ago │             │
│  └─────────────────────┘    └─────────────────────┘             │
│                                                                  │
│  ○ Keep my changes                                              │
│    ⚠️ This will replace the other person's changes              │
│                                                                  │
│  ○ Use their changes                                            │
│    Your changes will be discarded                               │
│                                                                  │
│  ○ Save both                                                    │
│    Theirs stays, yours saved as "Station 2 (Jan 13, 2:30 PM)"  │
│                                                                  │
│                              [Cancel]  [Resolve]                 │
└─────────────────────────────────────────────────────────────────┘
```

### Blocking Behavior

- Conflict modal is **blocking** - user must resolve before continuing
- While conflict modal is open, polling continues but changes to conflicted layout are held
- Multiple conflicts queue up and are resolved one at a time

---

## UI Components

### Component Tree

```
src/components/collection/
├── CollectionBrowser.tsx          # Main modal for browsing collections
│   ├── CollectionList.tsx         # List of joined collections
│   │   └── CollectionListItem.tsx # Single collection row
│   ├── CollectionDetail.tsx       # Layouts within a collection
│   │   ├── CollectionHeader.tsx   # Name, share link, actions
│   │   ├── CollectionLayoutGrid.tsx
│   │   │   └── CollectionLayoutCard.tsx
│   │   └── AddLayoutButton.tsx
│   └── CollectionEmptyState.tsx   # No collections joined
├── CollectionBanner.tsx           # Subtle banner when editing
├── CollectionSyncStatus.tsx       # Sync status indicator
├── ConflictDialog.tsx             # Conflict resolution modal
├── CreateCollectionModal.tsx      # Create new collection
├── JoinCollectionPreview.tsx      # Preview before joining
├── CollectionTutorial.tsx         # "How it works" modal
├── QuickTipsOverlay.tsx           # First-time tips
└── ExpiredCollectionDialog.tsx    # Recovery options
```

### Layout Manager Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  Layout Manager                                            [×]  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┬──────────────────┐                        │
│  │   My Layouts     │   Collections ⓘ  │  ← Info tooltip       │
│  └──────────────────┴──────────────────┘                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  📁 FRC Team 1234 Workshop          [Open]                  ││
│  │     3 layouts • Last active 2h ago                          ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │  📁 Home Garage Organization        [Open]                  ││
│  │     7 layouts • Last active 3d ago                          ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                                                              ││
│  │                 [+ Create Collection]                        ││
│  │                                                              ││
│  │     ─────────── or ───────────                              ││
│  │                                                              ││
│  │     [📋 Paste a collection link to join]                    ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Collection Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                📁 FRC Team 1234 Workshop                │
│                        [Share ▼] [Rename] [⋮ More]              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ ┌───┬───┐   │  │ ┌───┬───┐   │  │ ┌───┬───┐   │              │
│  │ │▓▓▓│▓▓▓│   │  │ │▓▓▓│   │   │  │ │   │▓▓▓│   │              │
│  │ ├───┼───┤   │  │ ├───┼───┤   │  │ ├───┼───┤   │              │
│  │ │   │▓▓▓│   │  │ │▓▓▓│▓▓▓│   │  │ │▓▓▓│▓▓▓│   │              │
│  │ └───┴───┘   │  │ └───┴───┘   │  │ └───┴───┘   │              │
│  │             │  │             │  │             │              │
│  │ Station 1   │  │ Station 2   │  │ Tool Drawer │              │
│  │ ✓ Synced    │  │ 👤 Editing  │  │ ✓ Synced    │              │
│  │ 10s ago     │  │ 2m ago      │  │ 5m ago      │              │
│  │        [⋮]  │  │        [⋮]  │  │        [⋮]  │  ← Layout menu│
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────┐                                                │
│  │             │   Layout menu options:                         │
│  │     +       │   • Open                                       │
│  │             │   • Rename                                     │
│  │ Add Layout  │   • Duplicate                                  │
│  │             │   • Save to My Layouts                         │
│  └─────────────┘   • Remove from Collection                     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ✓ Synced 10s ago    45/50 layouts              [↻ Refresh]    │
└─────────────────────────────────────────────────────────────────┘

Share dropdown:
┌─────────────────────────┐
│ 📋 Copy edit link       │
│ 👁️ Copy view-only link  │
│ ▢▢ Show QR code         │
└─────────────────────────┘
```

### Collection Banner (During Editing)

```
┌─────────────────────────────────────────────────────────────────┐
│  📁 FRC Team 1234 Workshop • ✓ Synced              [View All]  │
└─────────────────────────────────────────────────────────────────┘

States:
• "📁 {name} • ✓ Synced" - All changes saved
• "📁 {name} • ⟳ Syncing..." - Pushing changes
• "📁 {name} • ⚠️ Offline" - Changes queued locally
• "📁 {name} • ⚠️ Conflict" - Needs resolution (click to resolve)

View-only mode banner:
┌─────────────────────────────────────────────────────────────────┐
│  👁️ FRC Team 1234 Workshop • View Only            [View All]   │
└─────────────────────────────────────────────────────────────────┘
```

### QR Code Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Share via QR Code                                         [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌─────────────────┐                          │
│                    │ ▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓│                          │
│                    │ ▓     ▓ ▓     ▓│                          │
│                    │ ▓ ▓▓▓ ▓ ▓ ▓▓▓ ▓│                          │
│                    │ ▓ ▓▓▓ ▓ ▓ ▓▓▓ ▓│                          │
│                    │ ▓     ▓ ▓     ▓│                          │
│                    │ ▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓│                          │
│                    └─────────────────┘                          │
│                                                                  │
│     ○ Edit access (can view and modify)                         │
│     ○ View-only (can browse, cannot edit)                       │
│                                                                  │
│     Scan to join "FRC Team 1234 Workshop"                       │
│                                                                  │
│                    [Download PNG]  [Copy Link]                   │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile Layout

```
┌──────────────────────────┐
│  Collections        [×]  │
├──────────────────────────┤
│                          │
│  📁 FRC Team 1234        │
│     3 layouts • 2h ago   │
│                    [>]   │
│  ────────────────────    │
│  📁 Home Garage          │
│     7 layouts • 3d ago   │
│                    [>]   │
│  ────────────────────    │
│                          │
│  [+ Create Collection]   │
│                          │
│  Paste link to join:     │
│  ┌────────────────────┐  │
│  │                    │  │
│  └────────────────────┘  │
│                          │
└──────────────────────────┘
```

---

## Help & Onboarding

### Tooltips

| Element | Tooltip Text |
|---------|-------------|
| Collections tab (ⓘ) | "Share layouts with your team. Anyone with the link can view and edit." |
| Sync status (✓) | "All changes saved. Last synced X seconds ago." |
| Sync status (⟳) | "Saving your changes..." |
| Sync status (⚠️) | "Couldn't sync. Will retry automatically." |
| Presence badge (👤) | "Someone else is currently editing this layout." |
| Share button | "Share this collection with edit or view-only access." |
| Copy edit link | "Anyone with this link can view and edit layouts." |
| Copy view-only link | "Anyone with this link can view but not edit." |
| QR code button | "Generate a QR code for easy sharing." |
| Delete Collection | "Permanently delete this collection and all its layouts." |
| Remove Layout | "Remove this layout from the collection." |
| Duplicate Layout | "Create a copy of this layout in the collection." |
| Rename Layout | "Change this layout's name." |
| Add Layout | "Add a new layout or copy one from My Layouts." |
| View All (banner) | "Open the collection browser to see all shared layouts." |
| Leave Collection | "Remove this collection from your list. Your cached layouts will be preserved." |

### Empty State

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         📁                                       │
│                  No Collections Yet                              │
│                                                                  │
│     Collections let you share layouts with your team.           │
│     Anyone with the link can view and edit layouts              │
│     together — no account required.                              │
│                                                                  │
│     Perfect for:                                                 │
│     • Workshop organization with teammates                       │
│     • Sharing drawer designs across devices                      │
│     • Collaborative planning sessions                            │
│                                                                  │
│              [+ Create Your First Collection]                    │
│                                                                  │
│     ─────────── or paste a link to join ───────────             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Join Preview

```
┌─────────────────────────────────────────────────────────────────┐
│  Join Collection                                           [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│     📁 FRC Team 1234 Workshop                                   │
│                                                                  │
│     3 layouts shared in this collection                         │
│                                                                  │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐                       │
│     │ preview │  │ preview │  │ preview │                       │
│     └─────────┘  └─────────┘  └─────────┘                       │
│                                                                  │
│     Joining gives you access to view and edit these             │
│     layouts. Changes you make will be visible to others         │
│     with this link.                                              │
│                                                                  │
│                        [Cancel]  [Join Collection]               │
└─────────────────────────────────────────────────────────────────┘
```

### First-Time Quick Tips

Shown once when user first opens a collection:

```
Tip 1/4: "Click any layout to start editing"
         [Highlights layout cards]

Tip 2/4: "Changes save automatically and sync every 30 seconds"
         [Highlights sync status]

Tip 3/4: "The 👤 badge means someone else is editing"
         [Highlights presence indicator]

Tip 4/4: "Use 'Share Link' to invite teammates"
         [Highlights share button]
```

### Tutorial Modal

Accessible via `[?]` icon in collection header:

```
┌─────────────────────────────────────────────────────────────────┐
│  How Collections Work                                      [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Page 1 of 3                                              [•○○] │
│                                                                  │
│                         📁                                       │
│                                                                  │
│              What are Collections?                              │
│                                                                  │
│     Collections let multiple people work on layouts             │
│     together. Share a link, and anyone can view and             │
│     edit — no accounts needed.                                   │
│                                                                  │
│                                                                  │
│                                          [Next →]               │
└─────────────────────────────────────────────────────────────────┘

Page 2: How Sync Works
- Your changes save automatically
- Layouts sync every 30 seconds
- If someone else edits at the same time, you'll choose which version to keep

Page 3: Tips for Teams
- Use clear layout names so teammates know what's what
- The 👤 icon shows when someone is actively editing
- Anyone can add, rename, or remove layouts
```

### Warning Dialogs

#### Delete Collection

```
┌─────────────────────────────────────────────────────────────────┐
│  Delete Collection?                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  This will permanently delete "FRC Team 1234 Workshop"          │
│  and all 3 layouts inside.                                       │
│                                                                  │
│  ⚠️ This affects everyone with the link.                        │
│  This cannot be undone.                                          │
│                                                                  │
│                              [Cancel]  [Delete Collection]       │
└─────────────────────────────────────────────────────────────────┘
```

#### Remove Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Remove Layout?                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Remove "Station 2" from this collection?                       │
│                                                                  │
│  ⚠️ This affects everyone with the link.                        │
│                                                                  │
│  □ Save a copy to My Layouts first                              │
│                                                                  │
│                              [Cancel]  [Remove]                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Leave with Unsynced Changes

```
┌─────────────────────────────────────────────────────────────────┐
│  Unsynced Changes                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  You have changes that haven't synced yet.                      │
│                                                                  │
│  • Wait for sync to complete (usually a few seconds)            │
│  • Or leave now and changes will sync in the background         │
│                                                                  │
│                              [Wait]  [Leave Anyway]              │
└─────────────────────────────────────────────────────────────────┘
```

### Error Messages

| Scenario | Message |
|----------|---------|
| Offline | "You're offline. Changes saved locally and will sync when reconnected." |
| Sync failed (retrying) | "Couldn't save just now. Retrying automatically..." |
| Sync failed (gave up) | "Unable to sync after several attempts. Check your connection and try again." |
| Collection not found | "This collection no longer exists. It may have been deleted." |
| Collection expired | "This collection expired due to inactivity. Your cached layouts can be restored." |
| Rate limited | "Too many requests. Please wait a moment before trying again." |
| Layout too large | "This layout is too large to sync (max 500KB). Try removing some bins or notes." |
| Collection full | "This collection has reached its limit of 50 layouts." |

---

## Migration Strategy

### Current → Target State

```
BEFORE (Current Users):
localStorage
├── gridfinity-library-v1
├── gridfinity-layout-{uuid}
├── gridfinity-layout-{uuid}
└── gridfinity-settings-v1

AFTER (Migrated):
localStorage
├── gridfinity-library-v1        # Unchanged
├── gridfinity-settings-v1       # Unchanged
├── gridfinity-collections-v1    # NEW
└── gridfinity-migrated-v1       # NEW (flag)

IndexedDB: gridfinity-db
├── layouts/{uuid}               # Migrated from localStorage
└── collection-cache/            # NEW (empty until collections used)
```

### Migration Code

```typescript
async function initializeStorage(): Promise<void> {
  const migrated = localStorage.getItem('gridfinity-migrated-v1');

  if (!migrated) {
    await migrateToIndexedDB();
  }
}

async function migrateToIndexedDB(): Promise<void> {
  const library = loadLibrary();
  if (!library) {
    // Fresh install, just mark as migrated
    localStorage.setItem('gridfinity-migrated-v1', Date.now().toString());
    return;
  }

  const db = await openDatabase();

  for (const entry of library.entries) {
    // Skip if already migrated
    const existing = await db.get('layouts', entry.id);
    if (existing) continue;

    // Read from localStorage
    const key = `gridfinity-layout-${entry.id}`;
    const layoutJson = localStorage.getItem(key);
    if (!layoutJson) continue;

    // Compress and store
    const compressed = LZString.compressToUTF16(layoutJson);
    await db.put('layouts', { id: entry.id, data: compressed });
  }

  localStorage.setItem('gridfinity-migrated-v1', Date.now().toString());
}
```

### Rollout Phases

| Phase | Duration | Behavior |
|-------|----------|----------|
| 1. Dual-write | 2 weeks | Write to both localStorage AND IndexedDB |
| 2. Prefer IndexedDB | 2 weeks | Read from IndexedDB, fallback to localStorage |
| 3. Cleanup | Ongoing | Remove old localStorage keys for migrated layouts |

### Fallback

If IndexedDB is unavailable:

```typescript
async function getLayoutStorage(): Promise<LayoutStorage> {
  if (await isIndexedDBAvailable()) {
    return new IndexedDBStorage();
  }

  console.warn('IndexedDB unavailable, falling back to localStorage');
  return new LocalStorageAdapter(); // Existing behavior
}
```

---

## Collection Expiration & Recovery

### Expiration Rules

- Collections expire after **2 years** of inactivity
- Activity = any read or write operation on the collection
- Expiration check runs server-side during API calls

### Recovery Flow

When user opens an expired collection link:

```
┌─────────────────────────────────────────────────────────────────┐
│  Collection Expired                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "FRC Team 1234 Workshop" expired due to inactivity.            │
│                                                                  │
│  Good news: You have 3 layouts saved locally.                   │
│                                                                  │
│  ☑ Station 1          (last edited Jan 2024)                    │
│  ☑ Station 2          (last edited Jan 2024)                    │
│  ☑ Tool Drawer        (last edited Dec 2023)                    │
│                                                                  │
│  ○ Restore selected to My Layouts                               │
│  ○ Create new collection with selected layouts                  │
│  ○ Discard all (cannot be undone)                               │
│                                                                  │
│                                      [Cancel]  [Continue]        │
└─────────────────────────────────────────────────────────────────┘
```

When no local cache exists (different device):

```
┌─────────────────────────────────────────────────────────────────┐
│  Collection Not Found                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  This collection no longer exists. It may have expired          │
│  or been deleted.                                                │
│                                                                  │
│  If you have layouts cached on another device, open the         │
│  link there to recover them.                                     │
│                                                                  │
│                                              [OK]                │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### New Files

```
src/
├── api/
│   └── collection.ts                    # API client functions
├── store/
│   └── collection.ts                    # Zustand store
├── hooks/
│   ├── useCollectionSync.ts             # Polling and sync logic
│   ├── useCollectionPresence.ts         # Heartbeat for presence
│   └── useCollectionConflict.ts         # Conflict detection
├── components/
│   └── collection/
│       ├── CollectionBrowser.tsx        # Main browser modal
│       ├── CollectionList.tsx           # List of collections
│       ├── CollectionListItem.tsx       # Single collection row
│       ├── CollectionDetail.tsx         # Layouts in collection
│       ├── CollectionHeader.tsx         # Name, actions
│       ├── CollectionLayoutGrid.tsx     # Layout cards grid
│       ├── CollectionLayoutCard.tsx     # Single layout card
│       ├── AddLayoutButton.tsx          # Add layout actions
│       ├── CollectionBanner.tsx         # Editing banner
│       ├── CollectionSyncStatus.tsx     # Sync indicator
│       ├── CollectionEmptyState.tsx     # No collections
│       ├── ConflictDialog.tsx           # Conflict resolution
│       ├── CreateCollectionModal.tsx    # Create collection
│       ├── JoinCollectionPreview.tsx    # Join preview
│       ├── CollectionTutorial.tsx       # Help modal
│       ├── QuickTipsOverlay.tsx         # First-time tips
│       └── ExpiredCollectionDialog.tsx  # Expiration recovery
├── utils/
│   ├── indexedDB.ts                     # IndexedDB wrapper
│   └── compression.ts                   # LZ-string helpers
└── types.ts                             # Add collection types

api/                                     # Vercel serverless
├── collection.ts                        # POST: Create
└── collection/
    ├── [id].ts                          # GET/PUT/DELETE collection
    └── [id]/
        ├── poll.ts                      # GET: Poll for changes
        ├── heartbeat.ts                 # POST: Presence heartbeat
        ├── layout.ts                    # POST: Add layout
        └── layout/
            └── [layoutId].ts            # GET/PUT/DELETE layout
```

### Modified Files

```
src/
├── components/
│   ├── modals/LayoutManagerModal.tsx    # Add Collections tab
│   └── Header.tsx                       # Add to Share menu
├── hooks/
│   └── useLayoutRouting.ts              # Handle /c/{id} URLs
├── store/
│   └── layout.ts                        # Add collection context
├── utils/
│   └── storage.ts                       # Add IndexedDB support
├── types.ts                             # Add collection types
└── App.tsx                              # Initialize IndexedDB
```

---

## Testing Strategy

### Unit Tests

```
src/test/collection/
├── api.test.ts                  # API client functions
├── store.test.ts                # Collection store
├── sync.test.ts                 # Sync logic
├── conflict.test.ts             # Conflict detection
├── compression.test.ts          # LZ-string compression
├── indexedDB.test.ts            # IndexedDB wrapper
└── migration.test.ts            # localStorage → IndexedDB
```

### Integration Tests

```
src/test/collection/integration/
├── flow.test.ts                 # Create → join → edit flow
├── offline.test.ts              # Offline queue behavior
├── multidevice.test.ts          # Simulated multi-device
└── expiration.test.ts           # Expiration and recovery
```

### E2E Tests

```
e2e/
├── collection-create.spec.ts    # Create collection
├── collection-join.spec.ts      # Join via URL
├── collection-edit.spec.ts      # Edit layouts
├── collection-sync.spec.ts      # Sync behavior
├── collection-conflict.spec.ts  # Conflict resolution
├── collection-mobile.spec.ts    # Mobile experience
└── collection-offline.spec.ts   # Offline handling
```

---

## Implementation Phases

### Phase 1: Storage Foundation (3-4 days)

- [ ] Add `lz-string` dependency
- [ ] Create IndexedDB wrapper (`src/utils/indexedDB.ts`)
- [ ] Create compression utilities (`src/utils/compression.ts`)
- [ ] Implement migration logic
- [ ] Update storage.ts to use IndexedDB
- [ ] Write unit tests for storage layer

### Phase 2: Backend API (4-5 days)

- [ ] Create collection API endpoints (CRUD)
- [ ] Add view-only access endpoint
- [ ] Add Redis keys for collection metadata
- [ ] Implement rate limiting
- [ ] Add validation (max layouts, payload size, duplicate name suffixing)
- [ ] Create Open Graph image endpoint
- [ ] Create QR code image endpoint
- [ ] Write API tests

### Phase 3: Collection Store (2-3 days)

- [ ] Create collection Zustand store
- [ ] Implement membership management
- [ ] Add sync state tracking
- [ ] Implement view-only mode detection
- [ ] Add collection auto-cleanup (30 days inactive fade)
- [ ] Connect to API client
- [ ] Write store tests

### Phase 4: Core UI (5-6 days)

- [ ] Create CollectionBrowser modal
- [ ] Add Collections tab to Layout Manager
- [ ] Build CollectionList and CollectionDetail views
- [ ] Implement CollectionLayoutCard with context menu
- [ ] Add CreateCollectionModal
- [ ] Add JoinCollectionPreview
- [ ] Build ShareDropdown (edit link, view-only link, QR)
- [ ] Create QRCodeModal with download
- [ ] Add LayoutLimitWarning (45+ layouts)
- [ ] Add LeaveCollectionDialog
- [ ] Mobile-responsive layouts

### Phase 5: Sync Mechanism (3-4 days)

- [ ] Implement useCollectionSync hook
- [ ] Add polling with visibility detection
- [ ] Implement auto-push (debounced)
- [ ] Add offline queue
- [ ] Implement change highlighting
- [ ] Add CollectionBanner component
- [ ] Add ViewOnlyBanner component

### Phase 6: Presence & Conflicts (2-3 days)

- [ ] Implement heartbeat system
- [ ] Add presence indicators to UI
- [ ] Build ConflictDialog
- [ ] Implement conflict resolution logic
- [ ] Write conflict tests

### Phase 7: Layout Operations (2 days)

- [ ] Implement rename layout in collection
- [ ] Implement duplicate layout in collection (with auto-suffix)
- [ ] Implement save to My Layouts (copy out)
- [ ] Add remove layout with save-first option

### Phase 8: Help & Onboarding (2-3 days)

- [ ] Add all tooltips (comprehensive)
- [ ] Create empty state
- [ ] Build QuickTipsOverlay (first-time)
- [ ] Create CollectionTutorial modal
- [ ] Add warning dialogs (delete, remove, leave, overwrite)
- [ ] Write error messages

### Phase 9: Polish & Testing (3-4 days)

- [ ] E2E test coverage
- [ ] Accessibility audit
- [ ] Performance testing (large collections)
- [ ] Edge case handling
- [ ] Documentation

### Total Estimate: 26-35 days (~5-6 weeks)

---

## Appendix: Dependencies

### New Dependencies

| Package | Size (gzip) | Purpose |
|---------|-------------|---------|
| `lz-string` | ~3 KB | Compression |
| `idb` | ~1.5 KB | IndexedDB wrapper |
| `qrcode` | ~12 KB | QR code generation (server-side) |

### Existing Dependencies Used

- `zustand` - State management
- `immer` - Immutable updates
- `@vercel/blob` - Blob storage
- `@upstash/redis` - Redis client

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **Collection** | A group of layouts shared via a single URL |
| **Membership** | A user's relationship to a collection (tracked locally) |
| **Sync State** | Timestamps tracking local vs server versions |
| **Presence** | Indication that someone is actively editing |
| **Heartbeat** | Periodic signal that a device is actively editing |
| **Conflict** | When both local and server have changes since last sync |
| **Push** | Uploading local changes to server |
| **Pull** | Downloading server changes to local |
| **Poll** | Periodic check for server changes |
