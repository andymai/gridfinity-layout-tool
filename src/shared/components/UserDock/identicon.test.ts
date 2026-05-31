import { describe, it, expect } from 'vitest';
import { identiconFromSeed, identiconCellColor, hueFromHex, IDENTICON_GRID } from './identicon';

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

  it('keeps both vertical halves populated so the mark never looks half-rendered', () => {
    const half = (IDENTICON_GRID / 2) * IDENTICON_GRID;
    for (let i = 0; i < 500; i++) {
      const { cells } = identiconFromSeed(`balance-${i}@example.com`);
      const top = cells.slice(0, half).some(Boolean);
      const bottom = cells.slice(half).some(Boolean);
      expect(top).toBe(true);
      expect(bottom).toBe(true);
    }
  });

  it('enforces a minimum fill density', () => {
    for (let i = 0; i < 500; i++) {
      const { cells } = identiconFromSeed(`density-${i}@example.com`);
      // min 3 of 8 left cells, mirrored => at least 6 filled
      expect(cells.filter(Boolean).length).toBeGreaterThanOrEqual(6);
    }
  });

  it('keeps every curated hue clear of the sync-status colors', () => {
    const statusHues = [142, 221, 33, 0]; // success, info, amber, error
    const palette = new Set<number>();
    for (let i = 0; i < 400; i++) palette.add(identiconFromSeed(`palette-${i}`).hue);
    for (const hue of palette) {
      for (const status of statusHues) {
        const delta = Math.min(Math.abs(hue - status), 360 - Math.abs(hue - status));
        expect(delta).toBeGreaterThan(20);
      }
    }
  });
});

describe('hueFromHex', () => {
  it('extracts the hue from primaries', () => {
    expect(hueFromHex('#ff0000')).toBe(0);
    expect(hueFromHex('#00ff00')).toBe(120);
    expect(hueFromHex('#0000ff')).toBe(240);
  });

  it('tolerates a missing leading hash', () => {
    expect(hueFromHex('00ff00')).toBe(120);
  });

  it('falls back to 0 for invalid input', () => {
    expect(hueFromHex('not-a-color')).toBe(0);
    expect(hueFromHex('#fff')).toBe(0);
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
