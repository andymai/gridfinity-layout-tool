/**
 * Visual divider for separating sections in context menus.
 *
 * @example
 * <ContextMenuItem label="Edit" onClick={handleEdit} />
 * <ContextMenuDivider />
 * <ContextMenuItem label="Delete" onClick={handleDelete} destructive />
 */
export function ContextMenuDivider() {
  return <div className="border-t border-stroke-subtle my-1" />;
}
