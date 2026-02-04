import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing, interactiveTransition } from '../variants';

// ─────────────────────────────────────────────────────────────────────────────
// Menu Context
// ─────────────────────────────────────────────────────────────────────────────

interface MenuContextValue {
  onClose: () => void;
  registerItem: (element: HTMLElement) => () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('Menu compound components must be used within Menu.Root');
  }
  return context;
}

// ─────────────────────────────────────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────────────────────────────────────

const overlayVariants = cva(['fixed inset-0 z-40']);

const contentVariants = cva([
  'absolute z-50',
  'min-w-[160px]',
  'bg-surface-elevated',
  'border border-stroke-subtle',
  'rounded-lg',
  'shadow-floating',
  'py-1',
  'animate-scale-in',
  'origin-top-left',
  ...focusRing,
]);

const itemVariants = cva(
  [
    'flex items-center gap-3',
    'px-3 py-2',
    'text-sm',
    'cursor-pointer',
    'outline-none',
    interactiveTransition,
  ],
  {
    variants: {
      variant: {
        default: ['text-content', 'hover:bg-surface-hover', 'focus-visible:bg-surface-hover'],
        danger: ['text-danger', 'hover:bg-danger-muted', 'focus-visible:bg-danger-muted'],
      },
      disabled: {
        true: 'opacity-40 cursor-not-allowed pointer-events-none',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const dividerVariants = cva(['h-px', 'bg-stroke-subtle', 'my-1', 'mx-2']);

// ─────────────────────────────────────────────────────────────────────────────
// Menu Root
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuRootProps {
  /**
   * Whether the menu is open.
   */
  open: boolean;

  /**
   * Called when the menu should close.
   */
  onClose: () => void;

  /**
   * Position for the menu.
   */
  position: { x: number; y: number };

  /**
   * Menu items. Use Menu.Item and Menu.Divider.
   */
  children: ReactNode;

  /**
   * Additional classes for the menu container.
   */
  className?: string;
}

/**
 * Context menu with keyboard navigation.
 *
 * Use compound components for structure:
 * - Menu.Root: Container with positioning and keyboard handling
 * - Menu.Item: Individual menu items
 * - Menu.Divider: Visual separator
 *
 * @example
 * const [menuState, setMenuState] = useState<{ open: boolean; position: Position }>({
 *   open: false,
 *   position: { x: 0, y: 0 },
 * });
 *
 * const handleContextMenu = (e: React.MouseEvent) => {
 *   e.preventDefault();
 *   setMenuState({ open: true, position: { x: e.clientX, y: e.clientY } });
 * };
 *
 * <div onContextMenu={handleContextMenu}>
 *   Right-click me
 * </div>
 *
 * <Menu.Root
 *   open={menuState.open}
 *   onClose={() => setMenuState(s => ({ ...s, open: false }))}
 *   position={menuState.position}
 * >
 *   <Menu.Item icon={<EditIcon />} onClick={handleEdit}>
 *     Edit
 *   </Menu.Item>
 *   <Menu.Item icon={<CopyIcon />} onClick={handleCopy}>
 *     Duplicate
 *   </Menu.Item>
 *   <Menu.Divider />
 *   <Menu.Item icon={<TrashIcon />} variant="danger" onClick={handleDelete}>
 *     Delete
 *   </Menu.Item>
 * </Menu.Root>
 */
function MenuRoot({ open, onClose, position, children, className }: MenuRootProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLElement[]>([]);
  // Use ref for focusedIndex - it only tracks position for keyboard nav calculations
  // and doesn't need to trigger re-renders (actual focus is managed imperatively)
  const focusedIndexRef = useRef(-1);

  // Register menu items for keyboard navigation
  const registerItem = useCallback((element: HTMLElement) => {
    itemsRef.current.push(element);
    return () => {
      itemsRef.current = itemsRef.current.filter((item) => item !== element);
    };
  }, []);

  // Focus first item when menu opens, reset when closed
  useEffect(() => {
    if (open) {
      focusedIndexRef.current = 0;
      requestAnimationFrame(() => {
        itemsRef.current[0]?.focus();
      });
    } else {
      focusedIndexRef.current = -1;
      itemsRef.current = [];
    }
  }, [open]);

  // Adjust position imperatively (no state needed, no extra renders)
  useLayoutEffect(() => {
    if (!open) return;

    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth - 8) {
      x = viewportWidth - rect.width - 8;
    }
    if (x < 8) x = 8;

    // Adjust vertical position
    if (y + rect.height > viewportHeight - 8) {
      y = viewportHeight - rect.height - 8;
    }
    if (y < 8) y = 8;

    // Apply directly to DOM (no re-render needed)
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [open, position]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      const items = itemsRef.current;
      if (items.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const currentIndex = focusedIndexRef.current;
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          focusedIndexRef.current = nextIndex;
          items[nextIndex]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const currentIndex = focusedIndexRef.current;
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          focusedIndexRef.current = prevIndex;
          items[prevIndex]?.focus();
          break;
        }
        case 'Home': {
          e.preventDefault();
          focusedIndexRef.current = 0;
          items[0]?.focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          const lastIndex = items.length - 1;
          focusedIndexRef.current = lastIndex;
          items[lastIndex]?.focus();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onClose();
          break;
        }
      }
    },
    [onClose]
  );

  // Close on click outside
  const handleOverlayClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return createPortal(
    <MenuContext.Provider value={{ onClose, registerItem }}>
      {/* Invisible overlay to catch clicks outside */}
      <div className={overlayVariants()} onClick={handleOverlayClick} aria-hidden="true" />

      {/* Menu content */}
      <div
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        aria-orientation="vertical"
        className={cn(contentVariants(), className)}
        style={{
          left: position.x,
          top: position.y,
        }}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </MenuContext.Provider>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Item
// ─────────────────────────────────────────────────────────────────────────────

type ItemVariantProps = VariantProps<typeof itemVariants>;

export interface MenuItemProps extends Omit<ItemVariantProps, 'disabled'> {
  /**
   * Item click handler.
   */
  onClick?: () => void;

  /**
   * Icon to display before the label.
   */
  icon?: ReactNode;

  /**
   * Item label.
   */
  children: ReactNode;

  /**
   * Whether the item is disabled.
   */
  disabled?: boolean;

  /**
   * Keyboard shortcut hint (displayed on the right).
   */
  shortcut?: string;
}

function MenuItem({
  onClick,
  icon,
  children,
  variant = 'default',
  disabled = false,
  shortcut,
}: MenuItemProps) {
  const { onClose, registerItem } = useMenuContext();
  const itemRef = useRef<HTMLDivElement>(null);

  // Register for keyboard navigation
  useEffect(() => {
    const element = itemRef.current;
    if (!element || disabled) return;
    return registerItem(element);
  }, [registerItem, disabled]);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    onClose();
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      ref={itemRef}
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={cn(itemVariants({ variant, disabled }))}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {icon && (
        <span className="w-5 h-5 flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <span className="text-xs text-content-tertiary ml-4" aria-hidden="true">
          {shortcut}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Divider
// ─────────────────────────────────────────────────────────────────────────────

function MenuDivider() {
  return <div role="separator" className={dividerVariants()} aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound Component Export
// ─────────────────────────────────────────────────────────────────────────────

export const Menu = {
  Root: MenuRoot,
  Item: MenuItem,
  Divider: MenuDivider,
};

export type { MenuRootProps as MenuProps };
