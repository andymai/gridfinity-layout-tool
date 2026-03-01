import { LIBRARY_CHANNEL_NAME } from './storageKeys';

/**
 * Notify other tabs that the library index has changed.
 * Call this after saving library to IndexedDB.
 */
export function notifyLibraryChanged(): void {
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(LIBRARY_CHANNEL_NAME);
    channel.postMessage('library-updated');
  } catch {
    // BroadcastChannel not supported or postMessage failed
  } finally {
    channel?.close();
  }
}

/**
 * Create a BroadcastChannel listener for library changes.
 * Returns a cleanup function to close the channel.
 */
export function listenForLibraryChanges(onChanged: () => void): () => void {
  try {
    const channel = new BroadcastChannel(LIBRARY_CHANNEL_NAME);
    channel.onmessage = onChanged;
    return () => channel.close();
  } catch {
    // BroadcastChannel not supported
    return () => {};
  }
}
