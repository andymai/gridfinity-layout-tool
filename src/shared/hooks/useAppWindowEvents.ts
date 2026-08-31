import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useLayoutStore } from '@/core/store';
import { downloadLayoutAsFile } from '@/core/storage';
import { SHORTCUTS } from '@/core/constants';

export interface AppWindowEventsDeps {
  readonly setIsHelpOpen: Dispatch<SetStateAction<boolean>>;
  readonly setCommandPaletteOpen: (open: boolean) => void;
  readonly setCommandPaletteInitialQuery: (query: string) => void;
  readonly navigateToSupporters: () => void;
  readonly navigateToDesigner: () => void;
}

/**
 * App-level window-event listeners for cross-tree surfaces that dispatch instead
 * of holding a ref to the shell: the command palette (open pre-filled, jump to
 * /supporters or /designer), the Help modal/keyboard shortcut, and the download
 * trigger. Split out of App.tsx to keep the shell within its line budget.
 */
export function useAppWindowEvents({
  setIsHelpOpen,
  setCommandPaletteOpen,
  setCommandPaletteInitialQuery,
  navigateToSupporters,
  navigateToDesigner,
}: AppWindowEventsDeps): void {
  // Allow external surfaces (e.g. HelpModal's empty-state fall-through) to open
  // the command palette pre-filled with a query via a window event.
  useEffect(() => {
    const handler = (e: CustomEvent<{ query?: string }>) => {
      setCommandPaletteInitialQuery(e.detail.query ?? '');
      setCommandPaletteOpen(true);
    };
    window.addEventListener('open-command-palette', handler as EventListener);
    return () => window.removeEventListener('open-command-palette', handler as EventListener);
  }, [setCommandPaletteOpen, setCommandPaletteInitialQuery]);

  useEffect(() => {
    const handler = () => navigateToSupporters();
    window.addEventListener('view-supporters', handler);
    return () => window.removeEventListener('view-supporters', handler);
  }, [navigateToSupporters]);

  const handleHelpKeyboard = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((SHORTCUTS.HELP as readonly string[]).includes(e.key)) {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
      }
    },
    [setIsHelpOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleHelpKeyboard);
    return () => window.removeEventListener('keydown', handleHelpKeyboard);
  }, [handleHelpKeyboard]);

  useEffect(() => {
    const handleOpenHelp = () => setIsHelpOpen(true);
    window.addEventListener('open-help-modal', handleOpenHelp);
    return () => window.removeEventListener('open-help-modal', handleOpenHelp);
  }, [setIsHelpOpen]);

  useEffect(() => {
    const handleSwitchToDesigner = () => navigateToDesigner();
    window.addEventListener('switch-to-designer', handleSwitchToDesigner);
    return () => window.removeEventListener('switch-to-designer', handleSwitchToDesigner);
  }, [navigateToDesigner]);

  useEffect(() => {
    const handleDownloadLayout = () => {
      const layout = useLayoutStore.getState().layout;
      const filename = `${layout.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
      void downloadLayoutAsFile(layout, filename);
    };
    window.addEventListener('download-layout', handleDownloadLayout);
    return () => window.removeEventListener('download-layout', handleDownloadLayout);
  }, []);
}
