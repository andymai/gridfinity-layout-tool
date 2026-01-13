/**
 * PartyKit Notification Utility
 *
 * Sends notifications to PartyKit when collection data changes.
 * This allows real-time updates to all connected clients.
 */

// PartyKit host - set via environment variable in production
const PARTYKIT_HOST = process.env.PARTYKIT_HOST || 'localhost:1999';

interface LayoutUpdatedPayload {
  type: 'layout-updated';
  layoutId: string;
  modifiedAt: number;
  modifiedBy?: string;
}

interface LayoutAddedPayload {
  type: 'layout-added';
  layoutId: string;
  name: string;
  modifiedAt: number;
}

interface LayoutDeletedPayload {
  type: 'layout-deleted';
  layoutId: string;
}

interface CollectionUpdatedPayload {
  type: 'collection-updated';
  name?: string;
  modifiedAt: number;
}

type NotificationPayload =
  | LayoutUpdatedPayload
  | LayoutAddedPayload
  | LayoutDeletedPayload
  | CollectionUpdatedPayload;

/**
 * Notify PartyKit of a collection change.
 * This broadcasts to all connected clients in the collection room.
 *
 * @param collectionId - The collection ID (used as room ID)
 * @param payload - The notification payload
 */
export async function notifyPartyKit(
  collectionId: string,
  payload: NotificationPayload
): Promise<void> {
  // Skip in development if PartyKit isn't running
  if (PARTYKIT_HOST === 'localhost:1999' && process.env.NODE_ENV === 'production') {
    console.warn('[PartyKit] Skipping notification - no host configured');
    return;
  }

  const url = `http://${PARTYKIT_HOST}/parties/collection/${collectionId}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[PartyKit] Notification failed:', response.status);
    }
  } catch (error) {
    // Don't fail the main operation if PartyKit notification fails
    console.error('[PartyKit] Notification error:', error);
  }
}

/**
 * Notify that a layout was updated.
 */
export function notifyLayoutUpdated(
  collectionId: string,
  layoutId: string,
  modifiedAt: number,
  modifiedBy?: string
): Promise<void> {
  return notifyPartyKit(collectionId, {
    type: 'layout-updated',
    layoutId,
    modifiedAt,
    modifiedBy,
  });
}

/**
 * Notify that a layout was added.
 */
export function notifyLayoutAdded(
  collectionId: string,
  layoutId: string,
  name: string,
  modifiedAt: number
): Promise<void> {
  return notifyPartyKit(collectionId, {
    type: 'layout-added',
    layoutId,
    name,
    modifiedAt,
  });
}

/**
 * Notify that a layout was deleted.
 */
export function notifyLayoutDeleted(
  collectionId: string,
  layoutId: string
): Promise<void> {
  return notifyPartyKit(collectionId, {
    type: 'layout-deleted',
    layoutId,
  });
}

/**
 * Notify that collection metadata was updated.
 */
export function notifyCollectionUpdated(
  collectionId: string,
  name: string | undefined,
  modifiedAt: number
): Promise<void> {
  return notifyPartyKit(collectionId, {
    type: 'collection-updated',
    name,
    modifiedAt,
  });
}
