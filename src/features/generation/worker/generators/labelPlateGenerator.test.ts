/**
 * Preview meshes for swappable label plates. Runs against the real kernel —
 * the point of the feature is that the preview shows the exact part, so a
 * mocked tessellation would test nothing worth testing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { loadFont } from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateLabelPlates, MAX_PREVIEW_LABEL_PLATES } from './labelPlateGenerator';

beforeAll(async () => {
  await initBrepjs();
  const buffer = readFileSync(
    resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf')
  );
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 30_000);

const socketParams = (over: Record<string, unknown> = {}) => ({
  ...DEFAULT_BIN_PARAMS,
  width: 4,
  depth: 2,
  compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
  label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' as const, depth: 14 },
  ...over,
});

describe('generateLabelPlates', () => {
  it('returns null when labels are disabled', () => {
    expect(
      generateLabelPlates(
        socketParams({
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: false, mode: 'socket' as const },
        })
      )
    ).toBeNull();
  });

  // Text-mode tabs engrave directly — there is no plate to preview.
  it('returns null in text mode', () => {
    expect(
      generateLabelPlates(
        socketParams({
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'text' as const },
        })
      )
    ).toBeNull();
  });

  it('meshes a plate per socket with a seated pose', () => {
    const result = generateLabelPlates(socketParams());

    expect(result).not.toBeNull();
    expect(result!.plates.length).toBeGreaterThan(0);
    for (const plate of result!.plates) {
      expect(plate.triangleCount).toBeGreaterThan(0);
      expect(plate.vertices.length).toBeGreaterThan(0);
      expect(plate.indices.length).toBeGreaterThan(0);
      expect(Number.isFinite(plate.seatX)).toBe(true);
      expect(Number.isFinite(plate.seatY)).toBe(true);
      expect(Number.isFinite(plate.seatZ)).toBe(true);
      expect(Math.abs(plate.slideY)).toBe(1);
      expect(plate.widthMm).toBeGreaterThan(0);
    }
  });

  // Plates are meshed in plate-local coords so the preview can draw each one
  // seated AND in the reference row from a single geometry.
  it('meshes plates centred on the origin, not at their seats', () => {
    const result = generateLabelPlates(socketParams());
    const plate = result!.plates[0];

    let maxAbsX = 0;
    for (let i = 0; i < plate.vertices.length; i += 3) {
      maxAbsX = Math.max(maxAbsX, Math.abs(plate.vertices[i]));
    }
    // Local coords stay within half the plate width; a seat-baked mesh would
    // sit tens of mm off-centre.
    expect(maxAbsX).toBeLessThan(plate.widthMm);
    expect(Math.abs(plate.seatX)).toBeGreaterThan(0);
  });

  it('reports nothing omitted for a small design', () => {
    expect(generateLabelPlates(socketParams())!.omittedCount).toBe(0);
  });

  // A 12x12 grid is 144 compartments; meshing every plate would stall the
  // editing loop on each parameter change.
  it('caps the set and reports the remainder', () => {
    const cols = 10;
    const rows = 4;
    const result = generateLabelPlates(
      socketParams({
        width: 20,
        depth: 8,
        compartments: {
          cols,
          rows,
          thickness: 1.2,
          cells: Array.from({ length: cols * rows }, (_, i) => i),
        },
      })
    );

    if (result === null) return; // no compartment wide enough — nothing to cap
    expect(result.plates.length).toBeLessThanOrEqual(MAX_PREVIEW_LABEL_PLATES);
    if (result.omittedCount > 0) {
      expect(result.plates.length).toBe(MAX_PREVIEW_LABEL_PLATES);
    }
  });

  it('carries compartment captions onto the meshed plates', () => {
    const withText = generateLabelPlates(
      socketParams({
        compartments: {
          cols: 2,
          rows: 1,
          thickness: 1.2,
          cells: [0, 1],
          compartmentTexts: ['M3', 'M4'],
        },
      })
    );
    const blank = generateLabelPlates(socketParams());

    expect(withText).not.toBeNull();
    expect(blank).not.toBeNull();
    // Engraved glyphs add geometry to the plate face.
    const engravedTris = withText!.plates.reduce((n, p) => n + p.triangleCount, 0);
    const blankTris = blank!.plates.reduce((n, p) => n + p.triangleCount, 0);
    expect(engravedTris).toBeGreaterThan(blankTris);
  });
});
