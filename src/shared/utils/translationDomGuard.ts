/**
 * Browser page-translation (Chrome's built-in translate, Google Translate,
 * some extensions) rewraps text nodes in `<font>` elements directly in the
 * live DOM. This desyncs React's virtual DOM from the real tree, so React's
 * commit phase later calls `insertBefore`/`removeChild` against a node the
 * translator already relocated — throwing
 * `NotFoundError: Failed to execute 'insertBefore' on 'Node'` mid-render.
 *
 * Guarding the two mutation methods so a cross-parent call degrades to a
 * no-op (instead of throwing) keeps the subtree alive. The translated text is
 * already where the translator put it, so skipping React's redundant move is
 * visually harmless. See facebook/react#11538.
 */

let installed = false;

export function installTranslationDomGuard(): void {
  if (installed) return;
  if (typeof Node !== 'function') return;
  installed = true;

  // eslint-disable-next-line @typescript-eslint/unbound-method -- intentional: invoked via .call(this, …) below
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  // eslint-disable-next-line @typescript-eslint/unbound-method -- intentional: invoked via .call(this, …) below
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
