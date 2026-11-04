import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { dragHasPhoto, firstPhoto } from '../panel/CutoutsSection/scanImport/photoFile';
import { focusOwnsKeys } from '../panel/CutoutsSection/handlers/keyboardHandler';

export type PhotoArrival = 'drop' | 'paste';

/**
 * A photo dropped on the board, or pasted into the editor, goes to Trace a
 * photo. `onPhoto` must be stable: the paste listener re-registers when it changes.
 */
export function usePhotoDropAndPaste(
  enabled: boolean,
  onPhoto: (file: File, how: PhotoArrival) => void
) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      if (focusOwnsKeys(e.target)) return;
      const file = firstPhoto(e.clipboardData?.files);
      if (!file) return;
      e.preventDefault();
      onPhoto(file, 'paste');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [enabled, onPhoto]);

  const dropHandlers = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!enabled || !dragHasPhoto(e.dataTransfer.items)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragging(true);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      setDragging(false);
      if (!enabled) return;
      const file = firstPhoto(e.dataTransfer.files);
      if (!file) return;
      e.preventDefault();
      onPhoto(file, 'drop');
    },
  };

  return { dragging: enabled && dragging, dropHandlers };
}
