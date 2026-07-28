import { describe, it, expect } from 'vitest';
import {
  socketProfileSections,
  socketProfileSectionsSimplified,
  socketBottomInset,
  PROFILE_INSET_TOP,
  PROFILE_INSET_MID,
  PROFILE_INSET_BOT,
} from './socketProfile';
import {
  SOCKET_HEIGHT,
  SOCKET_BIG_TAPER,
  SOCKET_VERTICAL_PART,
  CLEARANCE,
} from './generatorConstants';

describe('socketProfileSections', () => {
  it('reproduces the historical breakpoints exactly at the standard depth', () => {
    // Built from the SAME expressions the pre-feature socketBuilder /
    // baseplatePockets inlined, so this asserts bit-for-bit identity — any drift
    // here means existing geometry snapshots would churn.
    expect(socketProfileSections(SOCKET_HEIGHT)).toEqual([
      { z: 0, inset: PROFILE_INSET_TOP },
      { z: -(CLEARANCE / 2), inset: PROFILE_INSET_TOP },
      { z: -SOCKET_BIG_TAPER, inset: PROFILE_INSET_MID },
      { z: -(SOCKET_BIG_TAPER + SOCKET_VERTICAL_PART), inset: PROFILE_INSET_MID },
      { z: -SOCKET_HEIGHT, inset: PROFILE_INSET_BOT },
    ]);
    expect(PROFILE_INSET_TOP).toBe(0);
    expect(PROFILE_INSET_MID).toBeCloseTo(2.15, 10);
    expect(PROFILE_INSET_BOT).toBeCloseTo(2.95, 10);
  });

  it('bottoms out at exactly -socketHeightMm for any depth', () => {
    for (const h of [2, 2.5, 3, 4, 5]) {
      const sections = socketProfileSections(h);
      expect(sections[sections.length - 1].z).toBeCloseTo(-h, 10);
      expect(sections[0].z).toBe(0);
    }
  });

  it('keeps the top of the profile byte-identical to standard (removes only from the bottom)', () => {
    const std = socketProfileSections(SOCKET_HEIGHT);
    for (const h of [4.5, 4, 3.5, 3, 2.5]) {
      const sections = socketProfileSections(h);
      // Every standard breakpoint shallower than the cut is copied verbatim — the
      // mating chamfer never scales or moves, so a low bin stays flush with a
      // standard baseplate pocket / bin lip at every engaged depth.
      const kept = std.filter((s) => s.z > -h);
      expect(sections.slice(0, kept.length)).toEqual(kept);
      // Non-increasing Z, bottoming out exactly at -h.
      for (let i = 1; i < sections.length; i++) {
        expect(sections[i].z).toBeLessThanOrEqual(sections[i - 1].z);
      }
      expect(sections[sections.length - 1].z).toBeCloseTo(-h, 10);
    }
  });

  it('caps the bottom flat where the standard taper sits at that depth (H=4)', () => {
    const sections = socketProfileSections(4);
    const bottom = sections[sections.length - 1];
    expect(bottom.z).toBeCloseTo(-4, 10);
    // At depth 4 the standard profile is on the straight wall (inset 2.15), so the
    // flat bottom cap sits there — the 0.8mm bottom fillet (depth 4.2–5) got
    // removed, not the tapers.
    expect(bottom.inset).toBeCloseTo(PROFILE_INSET_MID, 10);
  });

  it('at Minimal (H=2) keeps the top standard and caps flat on the big taper — no squish', () => {
    const std = socketProfileSections(SOCKET_HEIGHT);
    const sections = socketProfileSections(2);
    // Top flat is untouched — identical to standard, NOT scaled down to -0.1.
    expect(sections[0]).toEqual(std[0]);
    expect(sections[1]).toEqual(std[1]);
    // Flat bottom partway down the big taper: depth 2, inset interpolated to 1.75mm.
    const bottom = sections[sections.length - 1];
    expect(bottom.z).toBeCloseTo(-2, 10);
    expect(bottom.inset).toBeCloseTo(1.75, 2);
  });
});

describe('socketBottomInset', () => {
  it('is PROFILE_INSET_BOT at standard height and shrinks for low profiles', () => {
    expect(socketBottomInset(SOCKET_HEIGHT)).toBeCloseTo(PROFILE_INSET_BOT, 10);
    expect(socketBottomInset(4)).toBeCloseTo(PROFILE_INSET_MID, 10); // on the straight wall
    expect(socketBottomInset(2)).toBeCloseTo(1.75, 2); // partway up the big taper
  });
});

describe('socketProfileSectionsSimplified', () => {
  it('is a top+bottom pair reaching -socketHeightMm', () => {
    expect(socketProfileSectionsSimplified(SOCKET_HEIGHT)).toEqual([
      { z: 0, inset: PROFILE_INSET_TOP },
      { z: -5, inset: PROFILE_INSET_BOT },
    ]);
    expect(socketProfileSectionsSimplified(2)[1].z).toBeCloseTo(-2, 10);
  });
});
