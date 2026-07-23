/**
 * Paint-tool bin size palette, shared by the desktop SizeSelectorPopover and
 * the mobile ToolsTab so the two pickers can never drift.
 */

/** Square sizes (n × n grid units). */
export const SQUARE_SIZES = [1, 2, 3, 4, 5, 6] as const;

/** Rectangle sizes (width × depth where width < depth). */
export const RECTANGLE_SIZES: readonly { readonly w: number; readonly d: number }[] = [
  { w: 1, d: 2 },
  { w: 1, d: 3 },
  { w: 1, d: 4 },
  { w: 1, d: 5 },
  { w: 1, d: 6 },
  { w: 2, d: 3 },
  { w: 2, d: 4 },
  { w: 2, d: 5 },
  { w: 2, d: 6 },
  { w: 3, d: 4 },
  { w: 3, d: 5 },
  { w: 3, d: 6 },
  { w: 4, d: 5 },
  { w: 4, d: 6 },
  { w: 5, d: 6 },
];
