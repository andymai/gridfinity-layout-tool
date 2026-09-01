import { describe, expect, it } from 'vitest';
import { buildCommandTree } from './commands';
import type { NavlibConstructor } from './tdxTypes';
import { NAVLIB_COMMANDS } from './types';

interface FakeNode {
  id?: string;
  children: FakeNode[];
  push(node: FakeNode): FakeNode;
}

function makeNode(id?: string): FakeNode {
  return {
    id,
    children: [],
    push(node) {
      this.children.push(node);
      return node;
    },
  };
}

/** Minimal stand-in for the library's command-tree constructors. */
function fakeCtor(): NavlibConstructor {
  return {
    ActionTree: function () {
      return makeNode();
    },
    ActionSet: function (id: string) {
      return makeNode(id);
    },
    Category: function (id: string) {
      return makeNode(id);
    },
    Action: function (id: string) {
      return makeNode(id);
    },
  } as unknown as NavlibConstructor;
}

describe('buildCommandTree', () => {
  it('exports every command under the Default action set', () => {
    const { activeSet, tree } = buildCommandTree(fakeCtor());
    expect(activeSet).toBe('Default');

    const root = tree as unknown as FakeNode;
    const set = root.children[0];
    const category = set.children[0];
    const actionIds = category.children.map((n) => n.id);
    expect(actionIds).toEqual(NAVLIB_COMMANDS.map((c) => c.id));
  });
});
