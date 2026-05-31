import { describe, it, expect } from 'vitest';
import { identiconFromSeed, identiconCellColor, IDENTICON_GRID } from './identicon';

const CELLS = IDENTICON_GRID * IDENTICON_GRID;

describe('identiconFromSeed', () => {
  it('is deterministic for the same seed', () => {
    expect(identiconFromSeed('andy@example.com')).toEqual(identiconFromSeed('andy@example.com'));
  });

  it('produces a full 4x4 grid', () => {
    const { cells } = identiconFromSeed('seed');
    expect(cells).toHaveLength(CELLS);
  });

  it('is mirrored left-to-right', () => {
    const { cells } = identiconFromSeed('mirror-check@example.com');
    for (let row = 0; row < IDENTICON_GRID; row++) {
      const base = row * IDENTICON_GRID;
      expect(cells[base + 0]).toBe(cells[base + 3]);
      expect(cells[base + 1]).toBe(cells[base + 2]);
    }
  });

  it('never renders an all-empty or fully-solid mark', () => {
    for (let i = 0; i < 500; i++) {
      const { cells } = identiconFromSeed(`user-${i}@example.com`);
      const filled = cells.filter(Boolean).length;
      expect(filled).toBeGreaterThan(0);
      expect(filled).toBeLessThan(CELLS);
    }
  });

  it('picks a hue from the curated palette', () => {
    const hues = new Set<number>();
    for (let i = 0; i < 200; i++) {
      hues.add(identiconFromSeed(`hue-${i}`).hue);
    }
    // Distinct seeds should spread across more than one curated hue.
    expect(hues.size).toBeGreaterThan(1);
  });

  it('distinguishes different seeds', () => {
    const a = identiconFromSeed('alice@example.com');
    const b = identiconFromSeed('bob@example.com');
    const differs = a.hue !== b.hue || a.cells.some((c, i) => c !== b.cells[i]);
    expect(differs).toBe(true);
  });
});

describe('identiconCellColor', () => {
  it('desaturates when muted', () => {
    const normal = identiconCellColor(210, 0, false);
    const muted = identiconCellColor(210, 0, true);
    expect(normal).not.toBe(muted);
    expect(muted).toContain('14%');
  });

  it('varies lightness across rows for depth', () => {
    expect(identiconCellColor(210, 0, false)).not.toBe(identiconCellColor(210, 3, false));
  });
});
