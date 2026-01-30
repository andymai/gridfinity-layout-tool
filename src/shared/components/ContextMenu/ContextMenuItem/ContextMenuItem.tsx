interface ContextMenuItemProps {
  /** Icon element to display (SVG) */
  icon: React.ReactNode;
  /** Label text for the action */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether this is a destructive action (red text) */
  destructive?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
}

/**
 * Single menu item for context menus.
 * Provides consistent styling, hover states, and touch targets.
 *
 * @example
 * <ContextMenuItem
 *   icon={<TrashIcon />}
 *   label="Delete"
 *   onClick={handleDelete}
 *   destructive
 * />
 */
export function ContextMenuItem({
  icon,
  label,
  onClick,
  destructive = false,
  disabled = false,
}: ContextMenuItemProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
        destructive ? 'text-error hover:bg-surface-hover' : 'text-content hover:bg-surface-hover'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`w-5 h-5 ${destructive ? '' : 'text-content-tertiary'}`}>{icon}</div>
      {label}
    </button>
  );
}
