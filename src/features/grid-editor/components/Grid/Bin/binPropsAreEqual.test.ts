import { describe, it, expect } from 'vitest';
import { binPropsAreEqual } from './binPropsAreEqual';
import type { BinProps } from './binPropsAreEqual';
import { createTestBin } from '@/test/testUtils';
import { gridUnits, heightUnits } from '@/core/types';
import type { Bin, Drawer, OverhangConfig } from '@/core/types';

const DRAWER: Drawer = { width: gridUnits(5), depth: gridUnits(4), height: heightUnits(6) };

function props(bin: Bin): BinProps {
  return {
    bin,
    drawer: DRAWER,
    cellSize: 32,
    isGhost: false,
    isSelected: false,
    onStartDrag: () => {},
    onStartResize: () => {},
  };
}

function bin(overhang?: OverhangConfig): Bin {
  return createTestBin({ x: 0, y: 0, width: 1, depth: 1, overhang });
}

describe('binPropsAreEqual — overhang', () => {
  it('treats a rebuilt but identical overhang as equal', () => {
    const a = bin({ enabled: true, left: 0, right: 14, front: 0, back: 0, feet: false });
    const b = bin({ enabled: true, left: 0, right: 14, front: 0, back: 0, feet: false });
    expect(binPropsAreEqual(props(a), props(b))).toBe(true);
  });

  it('detects a changed side', () => {
    const a = bin({ enabled: true, left: 0, right: 14, front: 0, back: 0 });
    const b = bin({ enabled: true, left: 0, right: 7, front: 0, back: 0 });
    expect(binPropsAreEqual(props(a), props(b))).toBe(false);
  });

  it('detects an overhang appearing or disappearing', () => {
    const none = bin();
    const some = bin({ enabled: true, left: 0, right: 14, front: 0, back: 0 });
    expect(binPropsAreEqual(props(none), props(some))).toBe(false);
    expect(binPropsAreEqual(props(some), props(none))).toBe(false);
  });

  it('treats two absent overhangs as equal', () => {
    expect(binPropsAreEqual(props(bin()), props(bin()))).toBe(true);
  });

  // `enabled` absent reads as on and `feet` absent reads as off, so a value
  // differing only by undefined-vs-default is not a visual change and must not
  // force a repaint.
  it('normalizes absent enabled/feet to their rendered defaults', () => {
    const implicit = bin({ left: 0, right: 14, front: 0, back: 0 });
    const explicit = bin({ enabled: true, left: 0, right: 14, front: 0, back: 0, feet: false });
    expect(binPropsAreEqual(props(implicit), props(explicit))).toBe(true);
  });

  it('still detects a genuine enabled or feet flip', () => {
    const on = bin({ left: 0, right: 14, front: 0, back: 0 });
    const off = bin({ enabled: false, left: 0, right: 14, front: 0, back: 0 });
    expect(binPropsAreEqual(props(on), props(off))).toBe(false);

    const flat = bin({ left: 0, right: 14, front: 0, back: 0 });
    const footed = bin({ left: 0, right: 14, front: 0, back: 0, feet: true });
    expect(binPropsAreEqual(props(flat), props(footed))).toBe(false);
  });
});
