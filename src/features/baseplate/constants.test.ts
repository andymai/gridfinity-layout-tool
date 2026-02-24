import { describe, it, expect } from 'vitest';
import { MAX_BASEPLATE_DIMENSION, EXPLODE_GAP_MM, PIECE_COLORS, getPieceColor } from './constants';

describe('MAX_BASEPLATE_DIMENSION', () => {
  it('is 16', () => {
    expect(MAX_BASEPLATE_DIMENSION).toBe(16);
  });
});

describe('EXPLODE_GAP_MM', () => {
  it('is 10', () => {
    expect(EXPLODE_GAP_MM).toBe(10);
  });
});

describe('PIECE_COLORS', () => {
  it('has 9 entries matching the max 3x3 piece count', () => {
    expect(PIECE_COLORS.length).toBe(9);
  });

  it('contains only valid hex color strings', () => {
    for (const color of PIECE_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('contains no duplicate colors', () => {
    const unique = new Set(PIECE_COLORS);
    expect(unique.size).toBe(PIECE_COLORS.length);
  });
});

describe('getPieceColor', () => {
  it('returns the first color for index 0', () => {
    expect(getPieceColor(0)).toBe(PIECE_COLORS[0]);
  });

  it('returns the correct color for each index in range', () => {
    for (let i = 0; i < PIECE_COLORS.length; i++) {
      expect(getPieceColor(i)).toBe(PIECE_COLORS[i]);
    }
  });

  it('wraps around when index equals array length', () => {
    expect(getPieceColor(PIECE_COLORS.length)).toBe(PIECE_COLORS[0]);
  });

  it('wraps around for index one past the end', () => {
    expect(getPieceColor(PIECE_COLORS.length + 1)).toBe(PIECE_COLORS[1]);
  });

  it('wraps around for a large index', () => {
    const largeIndex = PIECE_COLORS.length * 7 + 3;
    expect(getPieceColor(largeIndex)).toBe(PIECE_COLORS[3]);
  });

  it('returns the last color for the last valid index', () => {
    const lastIndex = PIECE_COLORS.length - 1;
    expect(getPieceColor(lastIndex)).toBe(PIECE_COLORS[lastIndex]);
  });

  it('returns a string starting with #', () => {
    expect(getPieceColor(0)).toMatch(/^#/);
    expect(getPieceColor(5)).toMatch(/^#/);
  });

  it('wraps modulo is consistent with manual calculation', () => {
    for (let i = 0; i < PIECE_COLORS.length * 3; i++) {
      expect(getPieceColor(i)).toBe(PIECE_COLORS[i % PIECE_COLORS.length]);
    }
  });
});
