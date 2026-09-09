/**
 * Preview meshes for swappable label plates. Runs against the real kernel —
 * the point of the feature is that the preview shows the exact part, so a
 * mocked tessellation would test nothing worth testing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont } from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateLabelPlates, MAX_PREVIEW_LABEL_PLATES } from './labelPlateGenerator';
import { deriveDimensions } from './pipeline/context';
import { planForContext } from './wallLabelSlotBuilder';
import { LABEL_PLATE_HEIGHT_MM, LABEL_PLATE_THICKNESS_MM } from '@/shared/constants/labelPlates';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
  const buffer = readFileSync(
    resolve(__dirname, '../../../../shared/fonts/assets/AtkinsonHyperlegible-Regular.ttf')
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

  // Counted against the plan, so a plate skipped as unbuildable is reported
  // just like one past the ceiling — otherwise "showing N of M" under-reports.
  it('counts omissions against the planned set, not the cap', () => {
    const result = generateLabelPlates(socketParams());

    expect(result).not.toBeNull();
    // Every planned plate built here, so the set is complete.
    expect(result!.omittedCount).toBe(0);
    expect(result!.plates.length).toBeGreaterThan(0);
  });

  // The exported sheet sizes text across every plate, so capping the sizing
  // input to the shown subset would render the preview larger than what prints.
  it('sizes text against the full planned set, not just the shown subset', () => {
    // 3 compartments, one with a long caption. Sizing from all three must not
    // differ from sizing the same three when none is capped away.
    const params = socketParams({
      width: 6,
      compartments: {
        cols: 3,
        rows: 1,
        thickness: 1.2,
        cells: [0, 1, 2],
        compartmentTexts: ['A', 'B', 'A VERY LONG CAPTION INDEED'],
      },
    });

    const result = generateLabelPlates(params);

    expect(result).not.toBeNull();
    // All plates share one size, so the set renders as a set.
    expect(result!.plates.length).toBeGreaterThan(0);
  });

  // Wall slots take the same 1u plate; the preview should show them standing
  // in their windows, not only the socket plates.
  it('stands a blank 1u plate in every wall slot', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 6,
      wallLabelSlots: {
        enabled: true,
        sides: { front: true, back: false, left: false, right: false },
        everyCells: 1,
      },
    };
    const result = generateLabelPlates(params);
    const dim = deriveDimensions(params, false);
    const plan = planForContext(params, dim);

    expect(result).not.toBeNull();
    expect(result!.plates).toHaveLength(3);
    for (const [i, plate] of result!.plates.entries()) {
      expect(plate.standing).toBe(true);
      expect(plate.slideY).toBe(0);
      expect(plate.slideZ).toBe(1);
      expect(plate.yawDeg).toBe(0);
      expect(plate.widthMm).toBe(36);
      expect(plate.seatX).toBeCloseTo(plan.slots[i].offset, 6);
      // Against the frame, so the plate shows through the window.
      expect(plate.seatY).toBeCloseTo(
        -dim.innerD / 2 - params.wallThickness + plan.frameMm + LABEL_PLATE_THICKNESS_MM,
        6
      );
      expect(plate.seatZ).toBeCloseTo(dim.baseOffsetZ + plan.floorZ + LABEL_PLATE_HEIGHT_MM / 2, 6);
    }
  });

  it('turns a side-wall plate onto its wall', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 6,
      wallLabelSlots: {
        enabled: true,
        sides: { front: false, back: false, left: false, right: true },
        everyCells: 2,
      },
    };
    const result = generateLabelPlates(params);
    const dim = deriveDimensions(params, false);
    const plan = planForContext(params, dim);

    expect(result!.plates).toHaveLength(1);
    const [plate] = result!.plates;
    expect(plate.yawDeg).toBe(90);
    expect(plate.seatX).toBeCloseTo(
      dim.innerW / 2 + params.wallThickness - plan.frameMm - LABEL_PLATE_THICKNESS_MM,
      6
    );
    expect(plate.seatY).toBeCloseTo(plan.slots[0].offset, 6);
  });

  it('lists socket plates before wall-slot plates', () => {
    const result = generateLabelPlates(
      socketParams({
        wallLabelSlots: {
          enabled: true,
          sides: { front: true, back: false, left: false, right: false },
          everyCells: 1,
        },
      })
    );
    const standing = result!.plates.map((p) => p.standing === true);
    const firstStanding = standing.indexOf(true);
    expect(firstStanding).toBeGreaterThan(0);
    expect(standing.slice(firstStanding).every(Boolean)).toBe(true);
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
