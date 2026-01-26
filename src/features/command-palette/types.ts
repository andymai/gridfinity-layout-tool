/**
 * Command palette types
 */

/** Command categories for grouping */
export type CommandCategory =
  | 'navigation'
  | 'edit'
  | 'layers'
  | 'view'
  | 'preview'
  | 'bins'
  | 'tools'
  | 'export';

/** A single command in the palette */
export interface Command {
  /** Unique identifier */
  id: string;
  /** Display label (will be translated) */
  labelKey: string;
  /** Category for grouping */
  category: CommandCategory;
  /** Keyboard shortcut keys (for display) */
  shortcut?: {
    keys: string | string[];
    /** Whether requires Ctrl/Cmd modifier */
    modifier?: boolean;
  };
  /** Action to execute when selected */
  action: () => void;
  /** Optional condition for when command is available */
  isAvailable?: () => boolean;
  /** Search keywords (in addition to label) */
  keywords?: string[];
}

/** Command group with translated name */
export interface CommandGroup {
  category: CommandCategory;
  labelKey: string;
  commands: Command[];
}

/** Recent command tracking */
export interface RecentCommandsState {
  /** Recently used command IDs (most recent first) */
  recentIds: string[];
  /** Maximum number of recents to track */
  maxRecents: number;
}
