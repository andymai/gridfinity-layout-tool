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

// Branding the prototype (not a module-level boolean) ties the
// idempotency check to the same global object the patch mutates. A module
// re-evaluation (e.g. vi.resetModules()) can't then desync a fresh "installed"
// flag from the already-patched prototype and double-wrap the methods.
const GUARD_FLAG = '__translationDomGuardInstalled__';

export function installTranslationDomGuard(): void {
  if (typeof Node !== 'function') return;

  const proto = Node.prototype as unknown as Record<string, unknown>;
  if (proto[GUARD_FLAG]) return;
  Object.defineProperty(proto, GUARD_FLAG, {
    value: true,
    enumerable: false,
    configurable: true,
  });

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
