/**
 * Command Palette feature module.
 *
 * Provides quick access to actions and keyboard shortcuts via ⌘K / Ctrl+K.
 *
 * @example
 * ```tsx
 * import { CommandPalette, useCommandPalette } from '@/features/command-palette';
 *
 * function App() {
 *   const { open, setOpen } = useCommandPalette();
 *   return <CommandPalette open={open} onOpenChange={setOpen} />;
 * }
 * ```
 */

export { CommandPalette, ShortcutBadge } from './components';
export { useCommandPalette } from './hooks';
export { useRecentCommandsStore } from './store';
export type { CommandCategory } from './types';
