/**
 * Context Menu Framework
 *
 * Provides reusable components and hooks for building consistent context menus
 * throughout the application.
 *
 * @example
 * import { useContextMenu, ContextMenuContainer, ContextMenuItem } from './ContextMenu';
 *
 * const { isOpen, position, show, hide, menuRef } = useContextMenu();
 *
 * return (
 *   <ContextMenuContainer isOpen={isOpen} position={position} onClose={hide} menuRef={menuRef}>
 *     <ContextMenuItem icon={<Icon />} label="Action" onClick={handleAction} />
 *   </ContextMenuContainer>
 * );
 */

export { ContextMenuContainer } from './ContextMenuContainer';
export { ContextMenuItem } from './ContextMenuItem';
export { ContextMenuDivider } from './ContextMenuDivider';
