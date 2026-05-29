// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { installTranslationDomGuard } from './translationDomGuard';

const originalRemoveChild = Node.prototype.removeChild;
const originalInsertBefore = Node.prototype.insertBefore;

describe('installTranslationDomGuard', () => {
  // The guard patches the prototype once and is idempotent, so install for the
  // whole file and restore at the end rather than per-test.
  beforeAll(() => {
    installTranslationDomGuard();
  });

  afterAll(() => {
    Node.prototype.removeChild = originalRemoveChild;
    Node.prototype.insertBefore = originalInsertBefore;
    // Drop the prototype brand so the guard can be re-installed by other files.
    Reflect.deleteProperty(Node.prototype, '__translationDomGuardInstalled__');
  });

  it('is idempotent — a second install does not re-wrap the methods', () => {
    const patchedRemove = Node.prototype.removeChild;
    const patchedInsert = Node.prototype.insertBefore;

    installTranslationDomGuard();

    expect(Node.prototype.removeChild).toBe(patchedRemove);
    expect(Node.prototype.insertBefore).toBe(patchedInsert);
  });

  it('still removes a real child node', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    expect(parent.removeChild(child)).toBe(child);
    expect(parent.contains(child)).toBe(false);
  });

  it('no-ops instead of throwing when removing a node from the wrong parent', () => {
    const parent = document.createElement('div');
    const otherParent = document.createElement('div');
    const child = document.createElement('span');
    otherParent.appendChild(child);

    // Without the guard this throws NotFoundError (the Translate crash).
    expect(() => parent.removeChild(child)).not.toThrow();
    expect(parent.removeChild(child)).toBe(child);
    // The node stays where it actually lives.
    expect(otherParent.contains(child)).toBe(true);
  });

  it('still inserts before a real reference node', () => {
    const parent = document.createElement('div');
    const ref = document.createElement('span');
    const inserted = document.createElement('b');
    parent.appendChild(ref);

    expect(parent.insertBefore(inserted, ref)).toBe(inserted);
    expect(parent.firstChild).toBe(inserted);
  });

  it('appends when reference node is null', () => {
    const parent = document.createElement('div');
    const inserted = document.createElement('b');

    expect(parent.insertBefore(inserted, null)).toBe(inserted);
    expect(parent.firstChild).toBe(inserted);
  });

  it('no-ops instead of throwing when reference node has a different parent', () => {
    const parent = document.createElement('div');
    const otherParent = document.createElement('div');
    const ref = document.createElement('span');
    const inserted = document.createElement('b');
    otherParent.appendChild(ref);

    expect(() => parent.insertBefore(inserted, ref)).not.toThrow();
    expect(parent.insertBefore(inserted, ref)).toBe(inserted);
    // Nothing was inserted into the wrong parent.
    expect(parent.contains(inserted)).toBe(false);
  });
});
