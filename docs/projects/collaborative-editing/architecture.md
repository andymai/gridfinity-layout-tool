# Collaborative Layout Editing - Systems Architecture

**Document Version**: 2.1
**Last Updated**: January 2026
**Status**: Implemented

## Executive Summary

This document describes the architecture for adding real-time collaborative editing to the Gridfinity Layout Tool. The system extends the existing cloud sharing model with permission levels (view/edit), following the Google Docs paradigm.

### Key Design Decisions

- **Google Docs model**: One URL per layout with configurable permission (view vs edit)
- **Single URL**: `/s/{id}` for both modes—permission stored server-side
- **Persistent collaboration**: No session expiration—collaboration persists with the layout
- **Liveblocks**: Managed service for real-time sync, presence, and conflict resolution
- **Cloud-first**: Editable layouts live on server; local copy becomes a linked reference

---

## 1. URL Structure

### Current URL Patterns

```
/                           # Home (loads active layout from library)
/#layout/{layoutId}         # Direct link to a local layout
/s/{shareId}               # Cloud share (12-char ID)
/#share={base64}           # Legacy URL-encoded share
```

### Updated URL Patterns

```
/s/{shareId}               # Cloud share (view or edit based on server-side permission)
/s/{shareId}?name=Alex     # Join with custom display name
```

**Key insight**: The URL never changes—permission is stored server-side. This matches Google Docs exactly:
- `/s/abc123` with `permission: 'view'` → View-only mode
- `/s/abc123` with `permission: 'edit'` → Real-time editing mode

### Permission Flow

```
Owner enables editing:
  Server updates permission to 'edit'
  URL stays /s/{shareId}
  Connected users gain edit ability

Owner disables editing:
  Server updates permission to 'view'
  URL stays /s/{shareId}
  Connected users' edit controls disabled
```

---

## 2. Sharing Model

### Permission Levels

```typescript
type SharePermission = 'view' | 'edit';

interface CloudShare {
  id: string;                    // 12-char share ID (existing)
  layoutId: string;              // Original layout UUID
  permission: SharePermission;   // 'view' or 'edit'
  ownerId: string;               // Browser fingerprint or stored ID
  createdAt: number;
  updatedAt: number;
  // No expiresAt - collaboration persists until owner deletes
}
```

### Linked Layout Model

When collaboration is enabled, the owner's local layout becomes a "linked" reference:

```typescript
interface LayoutEntry {
  id: string;                    // Local layout UUID
  name: string;
  timestamps: { created: number; modified: number };
  preview?: LayoutPreview;
  cloudShare?: CloudShareInfo;   // Existing
  linkedShare?: LinkedShareInfo; // New: indicates this is a linked layout
}

interface LinkedShareInfo {
  shareId: string;               // The cloud share ID
  permission: SharePermission;   // Current permission level
  linkedAt: number;              // When linking was established
}
```

### Share Flow

1. **Owner clicks Share**: Opens share panel with permission selector
2. **Owner selects "Edit"**:
   - Layout uploaded to cloud (if not already)
   - Liveblocks room created with layout data
   - Local layout marked as "linked"
   - Permission set to 'edit' on server
3. **Owner copies link**: URL is always `/s/{shareId}`
4. **Participant joins**: Opens `/s/{shareId}` → server returns permission → connects to Liveblocks room
5. **Owner changes to "View"**:
   - Permission updated on server to 'view'
   - Liveblocks room set to read-only
   - Connected users' edit controls disabled
   - URL stays the same

### Permission Enforcement

| Action | View-Only | Editable |
|--------|-----------|----------|
| View layout | ✓ | ✓ |
| See cursors | ✓ | ✓ |
| Pan/zoom | ✓ (local only) | ✓ (local only) |
| 3D preview | ✓ (local only) | ✓ (local only) |
| Draw bins | ✗ | ✓ |
| Move/resize | ✗ | ✓ |
| Edit labels | ✗ | ✓ |
| Modify categories | ✗ | ✓ |
| Change drawer settings | ✗ | ✓ |
| Save as copy | ✓ | ✓ |

---

## 3. Technology Stack

### Real-Time Communication: Liveblocks

**Choice**: [Liveblocks](https://liveblocks.io/) - managed real-time collaboration platform

**Rationale**:
- Purpose-built for collaborative apps (presence, storage, sync)
- React hooks for easy integration (`@liveblocks/react`)
- Built-in presence system with cursor support
- Handles reconnection, conflict resolution automatically
- Serverless-friendly (works with Vercel)
- Scales automatically

**Key Liveblocks Concepts**:
- **Room**: A collaborative space (one per shared layout)
- **Storage**: Synced JSON data (layout state)
- **Presence**: Ephemeral data per user (cursor position, selection)
- **Broadcast**: One-off messages to all users

### Storage Strategy

**Layout Storage**: Liveblocks Storage (primary) + Vercel Blob (backup/export)

When collaboration is enabled:
1. Layout data synced to Liveblocks Storage
2. Periodic snapshots saved to Vercel Blob (for import/export)
3. Local storage contains only linked reference

When collaboration is disabled:
1. Final state exported from Liveblocks
2. Saved to local storage
3. Liveblocks room can be cleaned up

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ UI Store│◄──►│ Layout  │◄──►│  Liveblocks │◄──►│  WebSocket  │  │
│  │ (local) │    │ Store   │    │   React     │    │  Connection │  │
│  └─────────┘    └─────────┘    └─────────────┘    └──────┬──────┘  │
│                                                          │          │
└──────────────────────────────────────────────────────────┼──────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          LIVEBLOCKS                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │    Room      │    │   Storage    │    │      Presence        │  │
│  │  (per share) │◄──►│   (layout    │◄──►│   (cursors, users)   │  │
│  │              │    │    data)     │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL                                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  API Routes  │    │  Vercel Blob │    │     Vercel KV        │  │
│  │  (share      │◄──►│  (snapshots, │◄──►│   (rate limiting,    │  │
│  │   metadata)  │    │   exports)   │    │    metadata)         │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Liveblocks Integration

### Room Configuration

```typescript
// Room ID matches share ID
const roomId = `gridfinity-${shareId}`;

// Room configuration
interface LiveblocksConfig {
  roomId: string;
  initialPresence: {
    cursor: null;
    name: string;
    color: string;
  };
  initialStorage: {
    layout: Layout;
    version: number;
  };
}
```

### Presence Data

```typescript
interface UserPresence {
  cursor: CursorPosition | null;
  name: string;
  color: string;
  interaction?: InteractionHint;
}

interface CursorPosition {
  x: number;  // Grid coordinates
  y: number;
}

type InteractionHint =
  | { type: 'idle' }
  | { type: 'selecting'; rect: Rect }
  | { type: 'dragging'; binIds: string[] }
  | { type: 'resizing'; binIds: string[]; handle: ResizeHandle }
  | { type: 'drawing'; rect: Rect };
```

### Storage Structure

```typescript
// Liveblocks Storage root
interface LiveblocksStorage {
  layout: LiveObject<Layout>;
  metadata: LiveObject<{
    ownerId: string;
    permission: SharePermission;
    version: number;
    // Cloud persistence credentials (set by owner, used by all)
    deleteToken?: string;
    shareExpiration?: number;
  }>;
}
```

**Note**: The `deleteToken` and `shareExpiration` fields enable any collaborator to persist changes to Vercel Blob (see Section 5.1).

### React Integration

```typescript
// src/liveblocks.config.ts
import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

export const {
  RoomProvider,
  useMyPresence,
  useOthers,
  useStorage,
  useMutation,
  useBroadcastEvent,
} = createRoomContext<UserPresence, LiveblocksStorage>(client);
```

---

## 5. State Synchronization

### Synchronized State (Liveblocks Storage)

```typescript
interface SyncedState {
  layout: Layout;            // Full layout data
  metadata: {
    ownerId: string;
    permission: SharePermission;
    version: number;
  };
}

// Layout includes:
// - name, drawer, printBedSize, gridUnitMm, heightUnitMm
// - categories, layers, bins
```

### Local State (Not Synced)

```typescript
interface LocalState {
  // UI preferences
  zoom: number;
  showOtherLayers: boolean;
  showLabels: boolean;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;

  // Selection (local to avoid conflicts)
  selectedBinIds: string[];
  activeLayerId: string;
  activeCategoryId: string;

  // 3D preview
  showIsometricPreview: boolean;
  isometricRotation: number;
  layerViewMode: 'focus' | 'stack' | 'all';

  // Interaction
  interaction: Interaction | null;
  halfBinMode: boolean;
}
```

### Sync Strategy

1. **Initial sync**: On room enter, Liveblocks provides full storage
2. **Live sync**: Mutations automatically broadcast to all clients
3. **Reconnection**: Liveblocks handles state reconciliation
4. **Conflict resolution**: Liveblocks uses operational transformation

### 5.1 Cloud Persistence (Vercel Blob Sync)

While Liveblocks handles real-time sync between connected users, changes must also be persisted to Vercel Blob so that:
- New viewers joining later see the latest layout
- The layout survives if all collaborators disconnect
- The share continues to work if Liveblocks room is cleaned up

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REAL-TIME LAYER                          │
│                                                              │
│   User A ◄──────► Liveblocks ◄──────► User B                │
│     │              Storage              │                    │
│     │                                   │                    │
│     └──────────┬───────────────────────┘                    │
│                │                                             │
│                ▼                                             │
│   ┌─────────────────────────────┐                           │
│   │  useCloudShareAutoSync      │  (any collaborator)       │
│   │  - Debounced (5s)           │                           │
│   │  - On local edits only      │                           │
│   │  - Reads deleteToken from   │                           │
│   │    Liveblocks storage       │                           │
│   └──────────────┬──────────────┘                           │
│                  │                                           │
└──────────────────┼───────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  PERSISTENCE LAYER                           │
│                                                              │
│   ┌──────────────────────┐                                  │
│   │     Vercel Blob      │  ← updateShare(shareId,          │
│   │   (layout snapshots) │      deleteToken, layout)        │
│   └──────────────────────┘                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Implementation

**Token Sharing**: The owner's `deleteToken` is stored in Liveblocks metadata when they join. This allows any collaborator to call the update API.

```typescript
// CollabProvider.tsx - Owner sets credentials in initialStorage
const initialStorage: LiveblocksStorage = useMemo(() => ({
  layout,
  metadata: {
    ownerId: userId,
    permission: 'edit',
    version: 1,
    // Shared so any collaborator can persist to blob
    deleteToken: cloudShare?.deleteToken,
    shareExpiration: cloudShare ? lastShareExpiration : undefined,
  },
}), []);
```

**Auto-Sync Hook**: `useCloudShareAutoSync` reads credentials from Liveblocks and debounces updates to Vercel Blob.

```typescript
// useCloudShareAutoSync.ts
export function useCloudShareAutoSync(shareId: string | null, enabled: boolean): void {
  // Read credentials from Liveblocks storage (shared by owner)
  const deleteToken = useStorage((root) => root?.metadata?.deleteToken);
  const shareExpiration = useStorage((root) => root?.metadata?.shareExpiration);

  // Only sync 'local' edits (from this user's mutations)
  // Skip 'init' and 'remote' changes to avoid loops
  const lastEditSource = useLayoutStore((state) => state.lastEditSource);

  useEffect(() => {
    if (!enabled || !deleteToken || lastEditSource !== 'local') return;

    // Debounced: sync after 5 seconds of inactivity
    const timer = setTimeout(() => {
      updateShare(shareId, deleteToken, layout, shareExpiration);
    }, 5000);

    return () => clearTimeout(timer);
  }, [layout, lastEditSource, ...]);
}
```

#### Key Design Decisions

1. **Any collaborator syncs**: Since the `deleteToken` is shared via Liveblocks, whichever user makes the last edit will trigger the blob sync. This distributes the persistence responsibility.

2. **Debounced updates**: 5-second debounce prevents excessive API calls during rapid editing.

3. **Local edits only**: The `lastEditSource` check prevents sync loops:
   - `'local'` → User made an edit → Sync to blob
   - `'remote'` → Received from Liveblocks → Don't re-sync
   - `'init'` → Initial load → Don't sync

4. **Sync on unmount**: When a collaborator leaves, any pending changes are flushed immediately.

---

## 6. Operation Types

### Layout Mutations

Using Liveblocks `useMutation` for atomic operations:

```typescript
// Example mutation
const addBin = useMutation(({ storage }, bin: Bin) => {
  const layout = storage.get("layout");
  const bins = layout.get("bins");
  bins.push(bin);
}, []);

// All layout operations
const mutations = {
  // Bin operations
  addBin: (bin: Bin) => void;
  updateBin: (binId: string, changes: Partial<Bin>) => void;
  deleteBins: (binIds: string[]) => void;
  moveBin: (binId: string, x: number, y: number, layerId?: string) => void;
  resizeBin: (binId: string, x: number, y: number, width: number, depth: number) => void;

  // Layer operations
  addLayer: (layer: Layer) => void;
  updateLayer: (layerId: string, changes: Partial<Layer>) => void;
  deleteLayer: (layerId: string) => void;
  reorderLayers: (layerIds: string[]) => void;

  // Category operations
  addCategory: (category: Category) => void;
  updateCategory: (categoryId: string, changes: Partial<Category>) => void;
  deleteCategory: (categoryId: string) => void;

  // Drawer operations
  updateDrawer: (changes: Partial<Drawer>) => void;

  // Layout metadata
  renameLayout: (name: string) => void;
  updateSettings: (changes: Partial<LayoutSettings>) => void;
};
```

### Permission Checking

```typescript
function useCanEdit(): boolean {
  const storage = useStorage((root) => root.metadata);
  const self = useSelf();

  // Owner can always edit
  if (storage.ownerId === self.id) return true;

  // Others depend on permission level
  return storage.permission === 'edit';
}

// Usage in components
function AddBinButton() {
  const canEdit = useCanEdit();
  const addBin = useAddBinMutation();

  return (
    <button disabled={!canEdit} onClick={() => addBin(...)}>
      Add Bin
    </button>
  );
}
```

---

## 7. Cursor Presence System

### Cursor Data Flow

```typescript
// Update own cursor position
const [myPresence, updateMyPresence] = useMyPresence();

function handleMouseMove(e: MouseEvent) {
  const gridCoords = getGridCoords(e.clientX, e.clientY);
  updateMyPresence({ cursor: gridCoords });
}

function handleMouseLeave() {
  updateMyPresence({ cursor: null });
}
```

### Rendering Remote Cursors

```typescript
// src/components/collab/CollabCursors.tsx
function CollabCursors() {
  const others = useOthers();

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {others.map(({ connectionId, presence }) => {
        if (!presence.cursor) return null;

        return (
          <CollabCursor
            key={connectionId}
            position={presence.cursor}
            name={presence.name}
            color={presence.color}
            interaction={presence.interaction}
          />
        );
      })}
    </div>
  );
}
```

### Cursor Throttling

Liveblocks automatically throttles presence updates. Additional client-side throttling:

```typescript
// Throttle to 20fps (50ms)
const throttledUpdateCursor = useCallback(
  throttle((cursor: CursorPosition) => {
    updateMyPresence({ cursor });
  }, 50),
  [updateMyPresence]
);
```

---

## 8. Client Architecture

### New Components

```
src/components/
├── collab/
│   ├── CollabProvider.tsx       # Liveblocks RoomProvider wrapper
│   ├── CollabBanner.tsx         # "Collaborating with..." banner
│   ├── CollabPresenceBar.tsx    # Avatar strip showing participants
│   ├── CollabCursors.tsx        # Container for remote cursors
│   ├── CollabCursor.tsx         # Individual cursor with name
│   └── CollabInteractionPreview.tsx  # Remote drag/resize previews
├── Grid/
│   └── (existing, modified to support collab)
```

### Implemented Hooks

```typescript
// src/hooks/useCollabMode.ts
// Detects if app is in collaborative editing mode based on URL and feature flag
export function useCollabMode(): {
  isCollaborative: boolean;
  shareId: string | null;
};

// src/hooks/useCollabSync.ts
// Bidirectional sync between Liveblocks storage and Zustand store
// Handles initial sync with state machine (pending → initializing → ready)
export function useCollabSync(): void;

// src/hooks/useCloudShareAutoSync.ts
// Debounced persistence to Vercel Blob (see Section 5.1)
// Reads deleteToken from Liveblocks, syncs on local edits
export function useCloudShareAutoSync(
  shareId: string | null,
  enabled: boolean
): void;

// src/hooks/useCollab.ts (planned)
export function useCollab(): {
  isConnected: boolean;
  participants: User[];
  self: User | null;
  canEdit: boolean;
  participantCount: number;
};

// src/hooks/useCollabPresence.ts (planned)
export function useCollabPresence(): {
  updateCursor: (cursor: CursorPosition | null) => void;
  updateInteraction: (interaction: InteractionHint) => void;
  others: UserPresence[];
};
```

### Store Integration

The existing Zustand stores work alongside Liveblocks:

```typescript
// When in collaborative mode:
// - Layout data comes from Liveblocks storage
// - Local state (zoom, selection) stays in Zustand
// - Mutations go through Liveblocks

function useLayoutData() {
  const isCollaborative = useIsCollaborative();

  // Collaborative mode: use Liveblocks
  const collabLayout = useStorage((root) => root.layout);

  // Local mode: use Zustand
  const localLayout = useLayoutStore((state) => state.layout);

  return isCollaborative ? collabLayout : localLayout;
}
```

---

## 9. API Endpoints

### Share API Extensions

```typescript
// PUT /api/share/[id]
// Update share permission
interface UpdateShareRequest {
  permission: 'view' | 'edit';
}

interface UpdateShareResponse {
  id: string;
  permission: SharePermission;
  liveblocksRoomId: string;  // For client to connect
}
```

### Liveblocks Auth Endpoint

```typescript
// POST /api/liveblocks-auth
// Authenticate user for Liveblocks room access

import { Liveblocks } from "@liveblocks/node";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY,
});

export async function POST(req: Request) {
  const { room, userId, userName } = await req.json();

  // Verify share exists and get permission
  const share = await getShare(room.replace('gridfinity-', ''));
  if (!share) {
    return Response.json({ error: 'Share not found' }, { status: 404 });
  }

  // Create session with appropriate permissions
  const session = liveblocks.prepareSession(userId, {
    userInfo: { name: userName, color: assignColor(userId) },
  });

  // Grant access based on share permission
  if (share.permission === 'edit') {
    session.allow(room, session.FULL_ACCESS);
  } else {
    session.allow(room, session.READ_ACCESS);
  }

  const { body, status } = await session.authorize();
  return new Response(body, { status });
}
```

---

## 10. Feature Flag Integration

### Labs Store Extension

```typescript
// src/store/labs.ts (existing)
interface LabsState {
  flags: {
    collaborativeEditing: boolean;
    // ... other flags
  };
}

// Feature flag check
export function useCollaborativeEditingEnabled() {
  return useLabsStore((state) => state.flags.collaborativeEditing);
}
```

### Conditional Loading

```typescript
// Only load Liveblocks when feature is enabled and share has edit permission
const CollabProvider = lazy(() =>
  import('./components/collab/CollabProvider')
);

function App() {
  const collabEnabled = useCollaborativeEditingEnabled();
  const sharePermission = useSharePermission(); // from server

  if (collabEnabled && sharePermission === 'edit') {
    return (
      <Suspense fallback={<Loading />}>
        <CollabProvider>
          <MainApp />
        </CollabProvider>
      </Suspense>
    );
  }

  return <MainApp />;
}
```

### Fallback Behavior

When feature flag is disabled:
- `/s/{id}` always loads in view-only mode (ignores server permission)
- Share panel shows only "Copy link" (no permission selector)
- No Liveblocks bundle loaded

---

## 11. Security Considerations

### Trust Model

This is a **trust-based** system:
- Anyone with the edit link can make changes
- No authentication required
- Owner identified by browser fingerprint (stored in localStorage)

### Token Sharing Security

The `deleteToken` is shared via Liveblocks storage to enable distributed blob persistence:

**Implications**:
- Any collaborator with the share link can update the Vercel Blob
- The token is visible to all room participants via Liveblocks storage
- Token exposure is limited to active room participants (not publicly discoverable)

**Mitigations**:
- Token only grants update access, not delete access (rate-limited)
- Collaborative shares are inherently trust-based (users with edit links are trusted)
- Token is not stored permanently on client devices (only in Liveblocks)
- Owner can revoke access by deleting the share entirely

**Rationale**: This trade-off enables better UX (any collaborator can persist changes) while maintaining the existing trust model of shared links.

### Safeguards

1. **Owner verification**: Owner ID stored in share metadata, verified on permission changes
2. **Rate limiting**: 100 operations/min per connection (Liveblocks + server-side)
3. **Size limits**: Same as cloud share (500KB, 2500 bins)
4. **Content filtering**: Same blocklist as cloud share
5. **Audit trail**: Operations logged for abuse detection

### Future Enhancements (Not in MVP)

- Password-protected shares
- Participant approval (lobby)
- Fine-grained permissions
- Identity via auth providers

---

## 12. Backwards Compatibility

### URL Handling

```typescript
// src/hooks/useLayoutRouting.ts
function handleRoute() {
  const path = window.location.pathname;
  const collabEnabled = useCollaborativeEditingEnabled();

  // Cloud share (permission determined server-side)
  if (path.startsWith('/s/')) {
    const shareId = path.split('/')[2];
    // Permission is fetched from server, not from URL
    return { type: 'share', shareId };
  }

  // Existing: Hash-based routing
  const hash = window.location.hash;
  if (hash.startsWith('#layout/')) {
    return { type: 'layout', layoutId: hash.slice(8) };
  }
  if (hash.startsWith('#share=')) {
    return { type: 'legacy-share', data: hash.slice(7) };
  }

  return { type: 'home' };
}

// After fetching share data from server:
function handleShareLoad(share: CloudShare) {
  const collabEnabled = useCollaborativeEditingEnabled();

  if (collabEnabled && share.permission === 'edit') {
    // Enable collaboration mode
    return { mode: 'collab', canEdit: true };
  }

  // View-only mode
  return { mode: 'view', canEdit: false };
}
```

### Migration from Existing Shares

- Existing `/s/{id}` shares continue to work (default permission: 'view')
- No automatic migration to collaborative mode
- Owner can enable editing via share panel (creates Liveblocks room, sets permission to 'edit')

---

## 13. Performance Considerations

### Bundle Size

Liveblocks adds ~30KB gzipped. Mitigated by:
- Lazy loading when feature flag enabled
- Only loading when share permission is 'edit'
- Code splitting for collab components

### Bandwidth

| Data Type | Frequency | Size (approx) |
|-----------|-----------|---------------|
| Cursor updates | 20/sec per user | 50 bytes |
| Operations | Variable | 100-500 bytes |
| Initial sync | On join | 50-500 KB |

For 5 users: ~5 KB/sec cursor data

### Optimizations

1. **Cursor batching**: Liveblocks batches presence updates
2. **Storage efficiency**: Liveblocks uses structural sharing
3. **Lazy presence**: Only send cursor when over grid
4. **Mobile reduction**: Fewer cursor updates on mobile

---

## 14. Error Handling

### Connection States

```typescript
type CollabStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

function useCollabStatus(): CollabStatus {
  const room = useRoom();
  const status = room.getStatus();

  switch (status) {
    case 'initial':
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'reconnecting':
      return 'reconnecting';
    case 'disconnected':
      return 'disconnected';
  }
}
```

### Error Recovery

```typescript
// Liveblocks handles most reconnection automatically
// Custom handling for edge cases:

function useCollabErrorHandler() {
  const room = useRoom();

  useEffect(() => {
    return room.subscribe('error', (error) => {
      if (error.code === 'ROOM_NOT_FOUND') {
        // Share was deleted
        toast.error('This layout no longer exists');
        navigate('/');
      } else if (error.code === 'FORBIDDEN') {
        // Permission revoked
        toast.info('You no longer have access to edit');
        // Refresh to get view-only mode
        window.location.reload();
      }
    });
  }, [room]);
}
```

---

## 15. Testing Strategy

### Unit Tests

- Mutation logic (bin operations, layer operations)
- Permission checking logic
- URL routing logic
- Feature flag behavior

### Integration Tests

- Liveblocks connection flow
- Presence synchronization
- Storage synchronization
- Permission enforcement

### E2E Tests

```typescript
// e2e/collab.spec.ts
test('two users can edit layout together', async ({ browser }) => {
  // User 1: Enable collaboration
  const page1 = await browser.newPage();
  await page1.goto('/');
  await enableCollaboration(page1);
  const collabUrl = await getCollabUrl(page1);

  // User 2: Join collaboration
  const page2 = await browser.newPage();
  await page2.goto(collabUrl);
  await waitForConnection(page2);

  // User 2: Add a bin
  await addBin(page2, { x: 0, y: 0, width: 2, height: 2 });

  // User 1: Should see the bin
  await expect(page1.locator('[data-testid="bin"]')).toHaveCount(1);
});
```

---

## 16. Glossary

- **Owner**: The user who created and controls the layout
- **Collaborator**: Any user connected to a collaborative layout
- **Permission level**: Whether collaborators can view or edit
- **Linked layout**: Local layout that references a cloud-stored original
- **Liveblocks Room**: A collaborative space for a specific layout
- **Presence**: Ephemeral user data (cursor, interaction state)
- **Storage**: Persistent synchronized data (layout)

---

## 17. References

- [Liveblocks Documentation](https://liveblocks.io/docs)
- [Liveblocks React API](https://liveblocks.io/docs/api-reference/liveblocks-react)
- [Google Docs Sharing Model](https://support.google.com/docs/answer/2494822)

---

## 18. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01 | Engineering Team | Initial draft with session-based model, PartyKit |
| 2.0 | 2026-01 | Engineering Team | Revised to Google Docs model, Liveblocks |
| 2.1 | 2026-01 | Engineering Team | Added Section 5.1 (Cloud Persistence), token sharing architecture, security considerations for distributed blob sync |
