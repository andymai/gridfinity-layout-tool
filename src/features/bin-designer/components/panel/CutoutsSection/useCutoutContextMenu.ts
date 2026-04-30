/**
 * Right-click context menu state for the cutout workspace.
 *
 * Position is in viewport coordinates (px); the consumer component renders
 * the menu at this position when non-null.
 */

import { useCallback, useState } from 'react';

export interface CutoutContextMenu {
  readonly contextMenu: { readonly x: number; readonly y: number } | null;
  readonly openContextMenu: (x: number, y: number) => void;
  readonly closeContextMenu: () => void;
}

export function useCutoutContextMenu(): CutoutContextMenu {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const openContextMenu = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return { contextMenu, openContextMenu, closeContextMenu };
}
