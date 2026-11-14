/**
 * The first photo among dropped or pasted files. An SVG is an image type but
 * an outline, not a photo, so it is left for the SVG import.
 */
export function firstPhoto(files: ArrayLike<File> | null | undefined): File | null {
  if (!files) return null;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') return file;
  }
  return null;
}

/** Whether a drag carries a photo, judged from its item types while it is still in the air. */
export function dragHasPhoto(items: DataTransferItemList | null | undefined): boolean {
  if (!items) return false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/') && item.type !== 'image/svg+xml') {
      return true;
    }
  }
  return false;
}
