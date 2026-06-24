import { describe, it, expect } from 'vitest';
import { composeFeaturesKey } from './featureRunner';

describe('composeFeaturesKey', () => {
  it('is deterministic for identical input', () => {
    const parts = [
      ['labelTab', 'fuse', 'abc'],
      ['compartmentWalls', 'cut', 'def'],
    ];
    expect(composeFeaturesKey(parts)).toBe(composeFeaturesKey(parts));
  });

  it('does NOT collide when a builder key embeds the delimiter characters', () => {
    // These two distinct feature sets flatten to the same `name:target:key`
    // pipe-join ("labelTab:fuse:a|labelTab:fuse:b" vs "labelTab:fuse:a|b" +
    // "labelTab:fuse:" ...). JSON keeps them distinct — a regression guard for
    // the false-resume-hit bug (#2333 review).
    const a = composeFeaturesKey([
      ['labelTab', 'fuse', 'a'],
      ['labelTab', 'fuse', 'b'],
    ]);
    const b = composeFeaturesKey([['labelTab', 'fuse', 'a|labelTab:fuse:b']]);
    expect(a).not.toBe(b);
  });

  it('distinguishes keys that differ only by a colon/pipe boundary', () => {
    const a = composeFeaturesKey([['x', 'fuse', 'p:q']]);
    const b = composeFeaturesKey([['x', 'fuse:p', 'q']]);
    expect(a).not.toBe(b);
  });

  it('distinguishes the empty set from a builder with empty-string parts', () => {
    expect(composeFeaturesKey([])).not.toBe(composeFeaturesKey([['', '', '']]));
  });
});
