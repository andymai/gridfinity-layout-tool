# Collaborative Layout Editing - Systems Architecture

## Executive Summary

This document describes the architecture for adding real-time collaborative editing to the Gridfinity Layout Tool. The system enables multiple users to simultaneously edit a shared layout with live cursor presence, similar to Figma or Miro.

### Key Features

- **Trust-based sharing**: Owners can share layouts as read-only or editable
- **Real-time presence**: See other users' cursors on the 2D grid
- **Synchronized editing**: Draw, drag, resize, and edit bins collaboratively
- **Selective sync**: Layout data syncs; user preferences (zoom, 3D preview) stay local
- **Conflict resolution**: Last-write-wins with operational transforms for concurrent edits
- **Offline support**: Graceful degradation with reconnection sync

---

## 1. URL Structure

### Current URL Patterns

```
/                           # Home (loads active layout from library)
/#layout/{layoutId}         # Direct link to a local layout
/s/{shareId}               # Read-only cloud share (12-char ID)
/#share={base64}           # Legacy URL-encoded share
```

### New Collaborative URL Patterns

```
/collab/{sessionId}        # Join a collaborative session
/collab/{sessionId}?name=  # Join with display name
```

**Session ID Format**: 16-character alphanumeric (e.g., `abc123XYZ789qrst`)

- Longer than current 12-char share IDs to reduce collision risk
- URL-safe characters only: `[a-zA-Z0-9]`
- Generated server-side with cryptographic randomness

### URL Transitions

```
Owner creates collab session:
  /#layout/{layoutId} → /collab/{sessionId}

Participant joins:
  /collab/{sessionId} → (loads session, no redirect)

Session ends (owner leaves or closes):
  /collab/{sessionId} → /#layout/{layoutId} (owner)
  /collab/{sessionId} → /s/{shareId} (participants, if read-only share created)
```

---

## 2. Sharing Model

### Permission Levels

```typescript
type CollabPermission = 'read' | 'edit';

interface CollabSession {
  id: string;                    // 16-char session ID
  ownerId: string;               // Connection ID of owner
  layoutId: string;              // Original layout UUID
  permission: CollabPermission;  // 'read' or 'edit'
  createdAt: number;
  expiresAt: number;             // Auto-expire after 24 hours
  participants: Participant[];
}

interface Participant {
  connectionId: string;          // WebSocket connection ID
  name: string;                  // Display name (default: "Guest N")
  color: string;                 // Cursor/avatar color
  joinedAt: number;
  cursor?: CursorPosition;       // Current cursor position
  isOwner: boolean;
}
```

### Share Flow

1. **Owner initiates**: Click "Collaborate" → choose permission level
2. **Server creates session**: Stores session metadata, generates URL
3. **Owner shares link**: URL copied to clipboard
4. **Participant joins**: Opens URL → connected to session
5. **Validation**: Server validates session exists and hasn't expired

### Permission Enforcement

| Action | Read-Only | Editable |
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
| Import as copy | ✓ | ✓ |

---

## 3. Technology Stack

### Real-Time Communication: WebSockets

**Choice**: WebSockets via a managed service (Vercel doesn't support persistent connections)

**Recommended**: [PartyKit](https://partykit.io/) or [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)

**Rationale**:
- PartyKit: Purpose-built for collaborative apps, easy Vercel integration
- Supports rooms (sessions), presence, and broadcast
- Handles reconnection automatically
- Scales horizontally with edge deployment

**Alternative**: [Liveblocks](https://liveblocks.io/) - Higher-level abstraction with built-in presence and storage

### State Synchronization: Hybrid Approach

**Choice**: Snapshot + Operations (not pure CRDT)

**Rationale**:
- Layout data is relatively small (<500KB)
- Operations are discrete and atomic (add bin, move bin, etc.)
- Full CRDT (e.g., Yjs, Automerge) adds complexity for marginal benefit
- Last-write-wins is acceptable for this use case (collaborative, not adversarial)

### Message Protocol

```typescript
// Client → Server
type ClientMessage =
  | { type: 'join'; sessionId: string; name?: string }
  | { type: 'cursor'; position: CursorPosition | null }
  | { type: 'operation'; op: LayoutOperation; version: number }
  | { type: 'ping' }
  | { type: 'leave' };

// Server → Client
type ServerMessage =
  | { type: 'welcome'; participant: Participant; session: SessionInfo; layout: Layout; version: number }
  | { type: 'participant_joined'; participant: Participant }
  | { type: 'participant_left'; connectionId: string }
  | { type: 'cursor_update'; connectionId: string; position: CursorPosition | null }
  | { type: 'operation'; op: LayoutOperation; connectionId: string; version: number }
  | { type: 'sync'; layout: Layout; version: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };
```

---

## 4. Cursor Presence System

### Cursor Position Data

```typescript
interface CursorPosition {
  // Grid coordinates (not pixels)
  x: number;
  y: number;
  // Current interaction state
  interaction?: InteractionHint;
}

type InteractionHint =
  | { type: 'idle' }
  | { type: 'selecting'; rect: Rect }
  | { type: 'dragging'; binIds: string[] }
  | { type: 'resizing'; binIds: string[]; handle: ResizeHandle }
  | { type: 'drawing'; rect: Rect };
```

### Cursor Rendering

- Render cursors as colored pointers above the grid (z-index above bins)
- Show participant name label next to cursor
- Animate cursor movement (lerp for smoothness)
- Fade out when cursor leaves grid
- Show interaction hint (e.g., selection box, drag preview)

### Throttling

- Cursor updates throttled to 60fps locally (16ms)
- Network transmission throttled to 20fps (50ms) to reduce bandwidth
- Use requestAnimationFrame for smooth interpolation between updates

### Component Structure

```
src/components/Grid/
├── CollabCursors.tsx        # Renders all participant cursors
├── CollabCursor.tsx         # Individual cursor with name label
└── CollabPresenceBar.tsx    # Shows participant list/avatars
```

---

## 5. State Synchronization

### Synchronized State (Shared)

```typescript
interface SyncedState {
  layout: Layout;            // Full layout data
  version: number;           // Monotonic version counter
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

1. **Initial sync**: On join, receive full layout snapshot + version
2. **Incremental sync**: Operations broadcast to all participants
3. **Resync on reconnect**: Request full snapshot if version mismatch
4. **Conflict detection**: Version numbers prevent stale writes

---

## 6. Operation Types

### Layout Operations

```typescript
type LayoutOperation =
  // Bin operations
  | { type: 'bin.add'; bin: Bin }
  | { type: 'bin.update'; binId: string; changes: Partial<Bin> }
  | { type: 'bin.delete'; binIds: string[] }
  | { type: 'bin.move'; binId: string; x: number; y: number; layerId?: string }
  | { type: 'bin.resize'; binId: string; x: number; y: number; width: number; depth: number }
  | { type: 'bin.duplicate'; sourceIds: string[]; newBins: Bin[] }

  // Layer operations
  | { type: 'layer.add'; layer: Layer }
  | { type: 'layer.update'; layerId: string; changes: Partial<Layer> }
  | { type: 'layer.delete'; layerId: string }
  | { type: 'layer.reorder'; layerIds: string[] }

  // Category operations
  | { type: 'category.add'; category: Category }
  | { type: 'category.update'; categoryId: string; changes: Partial<Category> }
  | { type: 'category.delete'; categoryId: string }

  // Drawer operations
  | { type: 'drawer.update'; changes: Partial<Drawer> }

  // Layout metadata
  | { type: 'layout.rename'; name: string }
  | { type: 'layout.settings'; changes: Partial<LayoutSettings> };

interface LayoutSettings {
  printBedSize: number;
  gridUnitMm: number;
  heightUnitMm: number;
}
```

### Operation Envelope

```typescript
interface OperationEnvelope {
  id: string;              // UUID for deduplication
  op: LayoutOperation;
  clientVersion: number;   // Version client had when creating op
  timestamp: number;       // Client timestamp
  connectionId: string;    // Sender (added by server)
}
```

---

## 7. Conflict Resolution

### Strategy: Last-Write-Wins (LWW) with Validation

For a simple trust-based system, LWW is acceptable. More sophisticated CRDTs add complexity without significant benefit for this use case.

### Conflict Scenarios

| Scenario | Resolution |
|----------|------------|
| Two users add bins at same position | Both bins created, collision validation fails on second |
| User A moves bin, User B deletes it | Delete wins (tombstone check) |
| User A resizes bin, User B moves it | Last operation wins |
| Drawer resize invalidates bins | Bins auto-moved to staging |
| Layer deleted with bins | Bins moved to staging |

### Server-Side Validation

```typescript
function applyOperation(state: SyncedState, op: OperationEnvelope): Result<SyncedState, ConflictError> {
  // 1. Check operation references exist
  if (op.op.type === 'bin.update') {
    const bin = state.layout.bins.find(b => b.id === op.op.binId);
    if (!bin) {
      return err({ code: 'ENTITY_NOT_FOUND', entityId: op.op.binId });
    }
  }

  // 2. Validate operation (bounds, collisions)
  const validation = validateOperation(state.layout, op.op);
  if (!validation.valid) {
    return err({ code: 'VALIDATION_FAILED', reason: validation.reason });
  }

  // 3. Apply operation
  const newLayout = applyToLayout(state.layout, op.op);

  // 4. Increment version
  return ok({ layout: newLayout, version: state.version + 1 });
}
```

### Client-Side Optimistic Updates

```typescript
// In useCollabStore.ts
function sendOperation(op: LayoutOperation) {
  // 1. Apply optimistically
  const optimisticState = applyLocally(op);
  setLayout(optimisticState);

  // 2. Send to server
  send({ type: 'operation', op, version: currentVersion });

  // 3. Track pending operation
  pendingOps.set(op.id, op);
}

function handleOperationAck(serverVersion: number, opId: string) {
  // Remove from pending
  pendingOps.delete(opId);
  setVersion(serverVersion);
}

function handleOperationReject(opId: string, error: ConflictError) {
  // Rollback optimistic update
  const op = pendingOps.get(opId);
  if (op) {
    rollback(op);
    pendingOps.delete(opId);
  }

  // Show toast error
  addToast({ type: 'error', message: `Edit rejected: ${error.reason}` });
}
```

---

## 8. Server Architecture

### Session Server (PartyKit Room)

```typescript
// parties/session.ts (PartyKit)
import type * as Party from "partykit/server";

export default class SessionRoom implements Party.Server {
  state: SyncedState;
  participants: Map<string, Participant>;

  constructor(readonly party: Party.Party) {
    this.state = { layout: createDefaultLayout(), version: 0 };
    this.participants = new Map();
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Assign participant color and name
    const participant = createParticipant(conn.id, this.participants.size);
    this.participants.set(conn.id, participant);

    // Send welcome with current state
    conn.send(JSON.stringify({
      type: 'welcome',
      participant,
      session: this.getSessionInfo(),
      layout: this.state.layout,
      version: this.state.version,
    }));

    // Broadcast join to others
    this.broadcast({
      type: 'participant_joined',
      participant,
    }, [conn.id]);
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;

    switch (msg.type) {
      case 'cursor':
        this.handleCursor(sender.id, msg.position);
        break;
      case 'operation':
        this.handleOperation(sender.id, msg.op, msg.version);
        break;
      // ...
    }
  }

  handleCursor(connectionId: string, position: CursorPosition | null) {
    const participant = this.participants.get(connectionId);
    if (participant) {
      participant.cursor = position;
      this.broadcast({
        type: 'cursor_update',
        connectionId,
        position,
      }, [connectionId]);
    }
  }

  handleOperation(connectionId: string, op: LayoutOperation, clientVersion: number) {
    // Check version for stale operations
    if (clientVersion < this.state.version - 10) {
      // Too far behind, request resync
      this.sendTo(connectionId, { type: 'sync', ...this.state });
      return;
    }

    // Apply operation
    const result = applyOperation(this.state, { op, connectionId, clientVersion });

    if (isOk(result)) {
      this.state = result.value;
      // Broadcast to all (including sender for confirmation)
      this.broadcast({
        type: 'operation',
        op,
        connectionId,
        version: this.state.version,
      });
    } else {
      // Reject operation
      this.sendTo(connectionId, {
        type: 'error',
        code: result.error.code,
        message: result.error.message,
      });
    }
  }

  async onClose(conn: Party.Connection) {
    this.participants.delete(conn.id);
    this.broadcast({ type: 'participant_left', connectionId: conn.id });

    // If owner left, session becomes read-only or ends
    if (conn.id === this.ownerId) {
      this.handleOwnerDisconnect();
    }
  }
}
```

### Session Management API

```typescript
// api/collab/create.ts
export async function POST(req: Request) {
  const { layoutId, permission, layout } = await req.json();

  // Generate session ID
  const sessionId = generateSessionId(); // 16 chars

  // Create session in PartyKit
  const response = await fetch(`https://project.partykit.dev/parties/session/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'init',
      layout,
      permission,
      ownerId: 'pending', // Set on first connection
    }),
  });

  return Response.json({
    sessionId,
    url: `${BASE_URL}/collab/${sessionId}`,
  });
}

// api/collab/[sessionId].ts
export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  // Check if session exists
  const session = await getSessionInfo(params.sessionId);

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.expiresAt < Date.now()) {
    return Response.json({ error: 'Session expired' }, { status: 410 });
  }

  return Response.json({
    sessionId: session.id,
    permission: session.permission,
    participantCount: session.participants.length,
    createdAt: session.createdAt,
  });
}
```

---

## 9. Client Architecture

### New Stores

```typescript
// src/store/collab.ts
interface CollabState {
  // Connection state
  isConnected: boolean;
  connectionId: string | null;
  sessionId: string | null;
  permission: CollabPermission | null;

  // Participants
  participants: Map<string, Participant>;
  localParticipant: Participant | null;

  // Sync state
  version: number;
  pendingOps: Map<string, LayoutOperation>;

  // Actions
  connect: (sessionId: string, name?: string) => Promise<void>;
  disconnect: () => void;
  sendOperation: (op: LayoutOperation) => void;
  updateCursor: (position: CursorPosition | null) => void;
}
```

### Hooks

```typescript
// src/hooks/useCollab.ts
export function useCollab() {
  const { connect, disconnect, isConnected, permission } = useCollabStore();
  const layout = useLayoutStore(state => state.layout);
  const { execute } = useUndoableAction();

  // Wrap operations for collab mode
  const executeCollab = useCallback((op: LayoutOperation, action: () => void) => {
    if (isConnected && permission === 'edit') {
      // Send to server (optimistic)
      sendOperation(op);
    }

    // Always apply locally
    execute(action);
  }, [isConnected, permission, execute]);

  return { isConnected, permission, executeCollab };
}

// src/hooks/useCollabCursor.ts
export function useCollabCursor(gridRef: RefObject<HTMLElement>) {
  const { isConnected, updateCursor } = useCollabStore();
  const { getGridCoords } = useGridCoords(gridRef);

  useEffect(() => {
    if (!isConnected) return;

    const handleMouseMove = throttle((e: MouseEvent) => {
      const coords = getGridCoords(e.clientX, e.clientY);
      updateCursor(coords);
    }, 50); // 20fps

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isConnected, getGridCoords, updateCursor]);
}

// src/hooks/useCollabPresence.ts
export function useCollabPresence() {
  const participants = useCollabStore(state => state.participants);
  const localId = useCollabStore(state => state.connectionId);

  const others = useMemo(() =>
    Array.from(participants.values()).filter(p => p.connectionId !== localId),
    [participants, localId]
  );

  return { others, total: participants.size };
}
```

### Modified Components

```typescript
// Grid/index.tsx - Add cursor layer
export function Grid() {
  const { isConnected } = useCollab();

  return (
    <div className="grid-container">
      <GridCanvas />
      <Overlay />
      {isConnected && <CollabCursors />}  {/* New */}
    </div>
  );
}

// Grid/CollabCursors.tsx
export function CollabCursors() {
  const { others } = useCollabPresence();

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {others.map(participant => (
        <CollabCursor
          key={participant.connectionId}
          participant={participant}
        />
      ))}
    </div>
  );
}
```

---

## 10. Local Caching Strategy

### Session Persistence

```typescript
// Store in sessionStorage (not localStorage) - cleared on tab close
interface CollabCache {
  sessionId: string;
  lastVersion: number;
  lastLayout: Layout;           // For quick reconnect
  pendingOps: OperationEnvelope[];  // Unsent operations
}
```

### Reconnection Flow

```
1. Connection lost
   ↓
2. Store current state + pending ops in sessionStorage
   ↓
3. Show "Reconnecting..." banner
   ↓
4. Attempt reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
   ↓
5. On reconnect:
   a. Send last known version
   b. Server responds with full sync if behind, or delta if close
   c. Replay pending ops
   ↓
6. Resume normal operation
```

### Offline Mode

When disconnected for extended period:
- Show persistent banner with reconnection status
- Allow local editing (queued)
- On reconnect, merge changes (may conflict)
- If conflicts unresolvable, offer "Save as Copy"

---

## 11. Backwards Compatibility

### URL Handling

```typescript
// src/hooks/useLayoutRouting.ts
function handleRoute() {
  const path = window.location.pathname;

  // New: Collab sessions
  if (path.startsWith('/collab/')) {
    const sessionId = path.split('/')[2];
    return { type: 'collab', sessionId };
  }

  // Existing: Cloud shares
  if (path.startsWith('/s/')) {
    const shareId = path.split('/')[2];
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
```

### Feature Detection

```typescript
// Graceful degradation if collab not supported
function canUseCollab(): boolean {
  return (
    typeof WebSocket !== 'undefined' &&
    navigator.onLine
  );
}

// In UI, hide "Collaborate" button if not supported
```

### Migration from Existing Shares

Users with existing cloud shares can:
1. Keep using `/s/{shareId}` for read-only sharing
2. Create collab session from any layout (local or imported)
3. No automatic migration of existing shares

---

## 12. Security Considerations

### Trust Model

This is a **trust-based** system:
- Anyone with the link can join
- Editable sessions allow full edit access
- No authentication required

### Safeguards

1. **Session expiration**: Auto-expire after 24 hours
2. **Rate limiting**: Operation rate per connection (100/min)
3. **Size limits**: Same as cloud share (500KB, 2500 bins)
4. **Content filtering**: Same blocklist as cloud share
5. **Owner controls**: Owner can revoke session, kick participants
6. **Audit trail**: Log operations for abuse detection (server-side)

### Future Enhancements (Not MVP)

- Password-protected sessions
- Participant approval (lobby)
- Fine-grained permissions (view layer X only)
- Identity via Vercel/social auth

---

## 13. UI Components

### New Components

```
src/components/
├── collab/
│   ├── CollabProvider.tsx       # Context provider for collab state
│   ├── CollabBanner.tsx         # "You're in a collaborative session"
│   ├── CollabPresenceBar.tsx    # Avatar strip showing participants
│   ├── CollabCursors.tsx        # Container for remote cursors
│   ├── CollabCursor.tsx         # Individual cursor with name
│   ├── CollabShareModal.tsx     # Create/join session dialog
│   └── CollabSettingsPanel.tsx  # Session settings for owner
├── Grid/
│   └── CollabOverlay.tsx        # Remote user interaction previews
```

### UI State

```typescript
// Additional UI store state
interface CollabUIState {
  showCollabPanel: boolean;
  showParticipantList: boolean;
  collabTooltipDismissed: boolean;
}
```

### Responsive Considerations

- Desktop: Presence bar in header, cursors visible
- Tablet: Presence bar collapses to avatar count
- Mobile: Simplified presence (count only), no cursor rendering

---

## 14. Performance Considerations

### Bandwidth

| Data Type | Frequency | Size (approx) |
|-----------|-----------|---------------|
| Cursor updates | 20/sec per user | 50 bytes |
| Operations | Variable | 100-500 bytes |
| Full sync | On join/reconnect | 50-500 KB |
| Ping/pong | 1/30sec | 20 bytes |

For 5 users: ~5 KB/sec cursor data

### Optimizations

1. **Cursor batching**: Server batches cursor updates, sends at 10fps
2. **Delta compression**: Operations include only changed fields
3. **Selective broadcast**: Cursor updates skip sender
4. **Connection pooling**: Reuse WebSocket for multiple sessions (future)

### Client Performance

- Cursor rendering: Pure CSS transforms, no re-renders
- Operation application: Same as current (Immer optimized)
- Participant list: Virtualized if >20 participants

---

## 15. Implementation Phases

### Phase 1: Foundation (MVP)

- [ ] PartyKit integration and session server
- [ ] Session creation/joining API
- [ ] Basic WebSocket connection in client
- [ ] Full state sync on join
- [ ] Operation broadcast (no conflict resolution)

### Phase 2: Presence

- [ ] Cursor position broadcasting
- [ ] Cursor rendering component
- [ ] Participant list/avatars
- [ ] Interaction hints (selection, drag preview)

### Phase 3: Robust Sync

- [ ] Version-based conflict detection
- [ ] Optimistic updates with rollback
- [ ] Reconnection handling
- [ ] Offline queue

### Phase 4: Polish

- [ ] Session settings (rename, permissions)
- [ ] Owner controls (kick, end session)
- [ ] Mobile responsive adjustments
- [ ] Analytics integration

### Phase 5: Future

- [ ] Password protection
- [ ] Participant approval
- [ ] Comments/annotations
- [ ] Version history (time travel)

---

## 16. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER A (Owner)                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────┐  │
│  │ UI Store│◄──►│ Layout  │◄──►│ Collab  │◄──►│   WebSocket     │  │
│  │ (local) │    │ Store   │    │ Store   │    │   Connection    │  │
│  └─────────┘    └─────────┘    └─────────┘    └────────┬────────┘  │
│                                                         │           │
└─────────────────────────────────────────────────────────┼───────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PARTYKIT SERVER                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Session    │    │    State     │    │     Broadcast        │  │
│  │   Manager    │◄──►│   (Layout +  │◄──►│     Manager          │  │
│  │              │    │   Version)   │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────┬───────────┘  │
│                                                      │              │
└──────────────────────────────────────────────────────┼──────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           USER B (Participant)                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────┐  │
│  │ UI Store│◄──►│ Layout  │◄──►│ Collab  │◄──►│   WebSocket     │  │
│  │ (local) │    │ Store   │    │ Store   │    │   Connection    │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Legend:
  ◄──► Bidirectional sync
  ───► Unidirectional flow
```

---

## 17. Appendix: Alternative Technologies Considered

### Real-Time Layer

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **PartyKit** | Purpose-built, easy, edge | New platform, lock-in | ✓ Recommended |
| Cloudflare Durable Objects | Powerful, fast | Complex, Cloudflare lock-in | Good alternative |
| Liveblocks | High-level API, presence built-in | Cost at scale, abstraction | Good for faster MVP |
| Socket.io + Server | Familiar, flexible | Self-hosted, scaling | Not for Vercel |
| WebRTC (peer-to-peer) | Low latency, no server | NAT issues, no authority | Not suitable |

### Sync Strategy

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Snapshot + Ops** | Simple, predictable | Conflicts possible | ✓ Recommended |
| Yjs (CRDT) | Automatic merge, offline | Complex, bundle size | Over-engineered |
| Automerge | Rich history, branching | Learning curve, size | Over-engineered |
| OT (Operational Transform) | Industry standard | Complex implementation | Too complex |

---

## 18. Glossary

- **Session**: A collaborative editing instance with unique ID
- **Owner**: The user who created the session
- **Participant**: Any user in the session (including owner)
- **Operation**: An atomic change to the layout
- **Version**: Monotonic counter for state ordering
- **Presence**: Real-time information about participants (cursor, activity)
- **Optimistic Update**: Apply change locally before server confirmation
- **Tombstone**: Marker for deleted entities to prevent resurrection

---

## 19. References

- [PartyKit Documentation](https://docs.partykit.io/)
- [Figma Multiplayer Engineering](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [CRDTs and Collaborative Editing (Ink & Switch)](https://www.inkandswitch.com/local-first/)
- [Liveblocks Architecture](https://liveblocks.io/docs/concepts/how-liveblocks-works)
