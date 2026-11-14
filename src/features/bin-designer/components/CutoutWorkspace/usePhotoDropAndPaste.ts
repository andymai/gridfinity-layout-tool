import { useEffect, useState } from 'react';
import type { DragEvent, RefObject } from 'react';
import { dragHasPhoto, firstPhoto } from '../panel/CutoutsSection/scanImport/photoFile';
import { focusOwnsKeys } from '../panel/CutoutsSection/handlers/keyboardHandler';

export type PhotoArrival = 'drop' | 'paste';

const carriesFiles = (types: readonly string[] | DOMStringList): boolean =>
  Array.from(types).includes('Files');

/**
 * A photo dropped on the board, or pasted into the editor, goes to Trace a
 * photo. `onPhoto` must be stable: the paste listener re-registers when it
 * changes. `scope` is the board: a paste is ignored while it sits in an inert
 * subtree (a variant's locked editor), which a window listener can't see.
 */
export function usePhotoDropAndPaste(
  enabled: boolean,
  onPhoto: (file: File, how: PhotoArrival) => void,
  scope?: RefObject<HTMLElement | null>
) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      if (focusOwnsKeys(e.target) || scope?.current?.closest('[inert]')) return;
      // Another dialog open over the editor owns the paste.
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
      const file = firstPhoto(e.clipboardData?.files);
      if (!file) return;
      e.preventDefault();
      onPhoto(file, 'paste');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [enabled, onPhoto, scope]);

  // Any file drag is claimed, so a file that isn't a photo is refused here
  // rather than opened by the browser in place of the app.
  const dropHandlers = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!enabled || !carriesFiles(e.dataTransfer.types)) return;
      e.preventDefault();
      const photo = dragHasPhoto(e.dataTransfer.items);
      e.dataTransfer.dropEffect = photo ? 'copy' : 'none';
      setDragging(photo);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      setDragging(false);
      if (!enabled || !carriesFiles(e.dataTransfer.types)) return;
      e.preventDefault();
      const file = firstPhoto(e.dataTransfer.files);
      if (file) onPhoto(file, 'drop');
    },
  };

  return { dragging: enabled && dragging, dropHandlers };
}
