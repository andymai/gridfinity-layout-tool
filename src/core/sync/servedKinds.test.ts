import { describe, it, expect, beforeEach } from 'vitest';
import { isKindServed, noteServedKinds, resetServedKinds } from './servedKinds';

describe('servedKinds', () => {
  beforeEach(() => resetServedKinds());

  it('serves an ungated kind always, and a gated one only once a manifest lists it', () => {
    expect(isKindServed('designs')).toBe(true);
    expect(isKindServed('cutoutItems')).toBe(false);
    expect(noteServedKinds({ cutoutItems: {}, cutoutFolders: {} })).toEqual([
      'cutoutItems',
      'cutoutFolders',
    ]);
    expect(isKindServed('cutoutItems')).toBe(true);
  });

  it('reports a kind as new only the first time, and drops it when a manifest leaves it out', () => {
    noteServedKinds({ cutoutItems: {} });
    expect(noteServedKinds({ cutoutItems: {} })).toEqual([]);
    noteServedKinds({});
    expect(isKindServed('cutoutItems')).toBe(false);
    expect(noteServedKinds({ cutoutItems: {} })).toEqual(['cutoutItems']);
  });
});
