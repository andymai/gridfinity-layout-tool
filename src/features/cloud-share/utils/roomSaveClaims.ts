/**
 * Shares whose loaded collab room this browser saves to the link. While a room
 * holds a claim, its uploader owns the link: the owner's local uploader saves
 * the editor's layout, which can lag the room.
 */
const claims = new Map<string, number>();

export function claimRoomSaves(shareId: string): () => void {
  claims.set(shareId, (claims.get(shareId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (claims.get(shareId) ?? 1) - 1;
    if (remaining > 0) claims.set(shareId, remaining);
    else claims.delete(shareId);
  };
}

export function roomSavesShare(shareId: string): boolean {
  return claims.has(shareId);
}
