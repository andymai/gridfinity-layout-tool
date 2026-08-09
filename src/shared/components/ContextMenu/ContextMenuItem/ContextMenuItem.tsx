import { Button, cn } from '@/design-system';

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
    <Button
      variant="ghost"
      fullWidth
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Block-level `flex`, not the Button default `inline-flex`: the menu container is
        // shrink-to-fit, and `w-full` is a percentage that intrinsic sizing ignores — so
        // inline items would share one line and their max-content widths would sum.
        'flex justify-start gap-3 rounded-none px-4 py-3 font-normal',
        destructive ? 'text-error hover:text-error' : 'text-content'
      )}
    >
      <div className={cn('w-5 h-5', !destructive && 'text-content-tertiary')}>{icon}</div>
      {label}
    </Button>
  );
}
