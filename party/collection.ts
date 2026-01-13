/**
 * PartyKit Server for Collection Real-time Sync
 *
 * Each collection is a "room" that clients connect to.
 * When a layout changes, the server broadcasts to all connected clients.
 *
 * Message types:
 * - layout-updated: A layout was modified
 * - layout-added: A new layout was added to the collection
 * - layout-deleted: A layout was removed from the collection
 * - collection-updated: Collection metadata changed (name, etc.)
 * - presence: User presence/heartbeat
 */

import type * as Party from 'partykit/server';

// Message types for client communication
interface LayoutUpdatedMessage {
  type: 'layout-updated';
  layoutId: string;
  modifiedAt: number;
  modifiedBy?: string;
}

interface LayoutAddedMessage {
  type: 'layout-added';
  layoutId: string;
  name: string;
  modifiedAt: number;
}

interface LayoutDeletedMessage {
  type: 'layout-deleted';
  layoutId: string;
}

interface CollectionUpdatedMessage {
  type: 'collection-updated';
  name?: string;
  modifiedAt: number;
}

interface PresenceMessage {
  type: 'presence';
  deviceId: string;
  layoutId?: string;
}

interface PresenceUpdateMessage {
  type: 'presence-update';
  activeEditors: Record<string, number>; // layoutId -> count
  totalConnections: number;
}

type IncomingMessage = PresenceMessage;

type OutgoingMessage =
  | LayoutUpdatedMessage
  | LayoutAddedMessage
  | LayoutDeletedMessage
  | CollectionUpdatedMessage
  | PresenceUpdateMessage;

// Track connected clients and their current layout
interface ConnectionState {
  deviceId: string;
  currentLayoutId?: string;
  lastSeen: number;
}

export default class CollectionServer implements Party.Server {
  // Track connection states
  private connections: Map<string, ConnectionState> = new Map();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    // Initialize connection state
    this.connections.set(conn.id, {
      deviceId: conn.id,
      lastSeen: Date.now(),
    });

    // Send current presence state to the new connection
    this.sendPresenceUpdate(conn);

    // Connection logged for debugging
  }

  onClose(conn: Party.Connection) {
    this.connections.delete(conn.id);
    // Broadcast updated presence to remaining clients
    this.broadcastPresence();

    // Disconnection logged for debugging
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as IncomingMessage;

      if (data.type === 'presence') {
        // Update connection state with presence info
        const state = this.connections.get(sender.id);
        if (state) {
          state.deviceId = data.deviceId;
          state.currentLayoutId = data.layoutId;
          state.lastSeen = Date.now();
        }
        // Broadcast updated presence to all clients
        this.broadcastPresence();
      }
    } catch (error) {
      console.error(`[${this.room.id}] Error parsing message:`, error);
    }
  }

  /**
   * Handle HTTP requests - used by API routes to broadcast changes.
   * POST /parties/collection/:collectionId
   */
  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = (await req.json()) as OutgoingMessage;

      // Broadcast to all connected clients
      this.room.broadcast(JSON.stringify(data));

      // Broadcast logged for debugging

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error(`[${this.room.id}] Error handling request:`, error);
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Send presence update to a specific connection.
   */
  private sendPresenceUpdate(conn: Party.Connection) {
    const message: PresenceUpdateMessage = {
      type: 'presence-update',
      activeEditors: this.getActiveEditors(),
      totalConnections: this.connections.size,
    };
    conn.send(JSON.stringify(message));
  }

  /**
   * Broadcast presence update to all connected clients.
   */
  private broadcastPresence() {
    const message: PresenceUpdateMessage = {
      type: 'presence-update',
      activeEditors: this.getActiveEditors(),
      totalConnections: this.connections.size,
    };
    this.room.broadcast(JSON.stringify(message));
  }

  /**
   * Get count of active editors per layout.
   */
  private getActiveEditors(): Record<string, number> {
    const editors: Record<string, number> = {};
    const now = Date.now();
    const STALE_THRESHOLD = 60_000; // 1 minute

    for (const state of this.connections.values()) {
      // Only count recent connections
      if (now - state.lastSeen < STALE_THRESHOLD && state.currentLayoutId) {
        editors[state.currentLayoutId] = (editors[state.currentLayoutId] || 0) + 1;
      }
    }

    return editors;
  }
}
