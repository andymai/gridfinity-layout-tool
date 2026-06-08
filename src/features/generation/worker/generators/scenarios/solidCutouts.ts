import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const SOLID_BASE = { ...DEFAULT_BIN_PARAMS.base, solid: true };

/**
 * Reusable comparison guard: the cutout MUST actually subtract material.
 *
 * Structural-validity (the default scenario assert) can't catch a silent
 * no-op cut — an uncut bin is still valid. This was the chamfered-circle bug:
 * the chamfer loft emitted an invalid shell for the periodic ellipse profile,
 * the boolean dropped it, and the bin came out uncut but valid. A real cut
 * carves interior walls and so adds triangles over the bare solid bin.
 */
const mustCut: NonNullable<ScenarioCase['compareWith']> = {
  params: { style: 'solid', base: SOLID_BASE, cutouts: [] },
  assert: (withCut, noCut) => expect(withCut.triangleCount).toBeGreaterThan(noCut.triangleCount),
};

export const solidCutouts: ScenarioCase[] = [
  defineScenario('solid cutouts', '2\u00d72 solid with rectangle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle' })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with circle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'circle', width: 20, depth: 20 })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with hexagon (polygon) cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'polygon', sides: 6, width: 18, depth: 16 })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with hexagon cutout + insertion clearance', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'polygon', sides: 6, width: 18, depth: 16, clearance: 0.2 })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with chamfered hexagon cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({ shape: 'polygon', sides: 6, width: 18, depth: 16, chamferWidth: 1.5 }),
      ],
    },
    compareWith: mustCut,
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with chamfered circle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({ shape: 'circle', x: 30, y: 30, width: 20, depth: 20, chamferWidth: 2 }),
      ],
    },
    compareWith: mustCut,
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with chamfered ellipse cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      // Width \u2260 depth \u2192 a true ellipse. Same periodic-edge profile as the circle,
      // so it exercises the polygonal-approximation loft path that replaced the
      // invalid drawEllipse loft; the cut must still land.
      cutouts: [
        makeCutout({ shape: 'circle', x: 26, y: 32, width: 28, depth: 16, chamferWidth: 1.5 }),
      ],
    },
    compareWith: mustCut,
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with chamfered rectangle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', width: 22, depth: 16, chamferWidth: 1.5 })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with chamfered + scooped rectangle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      // Scoop fillets the loft's bottom edges (which exist at z=0) on top of the
      // chamfer flare \u2014 exercise that the two features compose without failure.
      cutouts: [
        makeCutout({ shape: 'rectangle', width: 22, depth: 16, chamferWidth: 1.5, scoopRadius: 2 }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with chamfered slot cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      // Slot's chamfer flares a derived (half-short-side) corner radius, unlike
      // the other shapes \u2014 exercise that loft path explicitly.
      cutouts: [makeCutout({ shape: 'slot', width: 30, depth: 12, chamferWidth: 1.5 })],
    },
    compareWith: mustCut,
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with slot (stadium) cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'slot', width: 30, depth: 12 })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with 3\u00d72 grid array of circles', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({
          shape: 'circle',
          x: 8,
          y: 8,
          width: 8,
          depth: 8,
          array: {
            mode: 'grid',
            cols: 3,
            rows: 2,
            pitchX: 14,
            pitchY: 14,
            count: 6,
            radius: 20,
            startAngle: 0,
            rotateToCenter: true,
          },
        }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with staggered hex array', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({
          shape: 'polygon',
          sides: 6,
          x: 6,
          y: 6,
          width: 12,
          depth: 11,
          array: {
            mode: 'staggered',
            cols: 3,
            rows: 3,
            pitchX: 14,
            pitchY: 12,
            count: 6,
            radius: 20,
            startAngle: 0,
            rotateToCenter: true,
          },
        }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with radial array (rotate-to-center)', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({
          shape: 'slot',
          x: 40,
          y: 36,
          width: 12,
          depth: 5,
          array: {
            mode: 'radial',
            cols: 1,
            rows: 1,
            pitchX: 0,
            pitchY: 0,
            count: 6,
            radius: 22,
            startAngle: 0,
            rotateToCenter: true,
          },
        }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with rectangle with scoop cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', scoopRadius: 3 })],
    },
  }),
  defineScenario(
    'solid cutouts',
    '2\u00d72 solid with rectangle, split scoop (W only) cuts only left/right walls',
    {
      params: {
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          makeCutout({
            shape: 'rectangle',
            width: 25,
            depth: 10,
            scoopRadiusW: 3,
            scoopRadiusD: 0,
          }),
        ],
      },
    }
  ),
  defineScenario(
    'solid cutouts',
    '2\u00d72 solid with rectangle, edge gate disables a single wall',
    {
      params: {
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          makeCutout({
            shape: 'rectangle',
            scoopRadiusW: 2,
            scoopRadiusD: 2,
            scoopEdges: { left: false, right: true, front: true, back: true },
          }),
        ],
      },
    }
  ),
  defineScenario('solid cutouts', '2\u00d72 solid with rounded-rectangle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', cornerRadius: 3 })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with rotated 45\u00b0 cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', rotation: 45 })],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with ellipse cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'circle', width: 20, depth: 30 })],
    },
    compareWith: mustCut,
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with grouped cutouts', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({ id: 'g-a', x: -5, y: 0, groupId: 'g1' }),
        makeCutout({ id: 'g-b', x: 10, y: 0, groupId: 'g1' }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with triangular path cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({
          shape: 'path',
          x: 10,
          y: 10,
          width: 20,
          depth: 20,
          path: [
            { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 30, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 20, y: 30, handleIn: null, handleOut: null, symmetric: false },
          ],
        }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with curved path cutout (bezier handles)', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({
          shape: 'path',
          x: 5,
          y: 5,
          width: 30,
          depth: 25,
          path: [
            { x: 5, y: 5, handleIn: null, handleOut: { dx: 10, dy: 0 }, symmetric: false },
            {
              x: 35,
              y: 5,
              handleIn: { dx: 0, dy: -10 },
              handleOut: { dx: 0, dy: 10 },
              symmetric: true,
            },
            {
              x: 35,
              y: 30,
              handleIn: { dx: 10, dy: 0 },
              handleOut: { dx: -10, dy: 0 },
              symmetric: true,
            },
            { x: 5, y: 30, handleIn: { dx: 0, dy: 10 }, handleOut: null, symmetric: false },
          ],
        }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with path cutout having closing bezier curve', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({
          shape: 'path',
          x: 8,
          y: 8,
          width: 24,
          depth: 24,
          path: [
            {
              x: 8,
              y: 20,
              handleIn: { dx: 0, dy: 8 },
              handleOut: { dx: 0, dy: -8 },
              symmetric: true,
            },
            {
              x: 20,
              y: 8,
              handleIn: { dx: -8, dy: 0 },
              handleOut: { dx: 8, dy: 0 },
              symmetric: true,
            },
            {
              x: 32,
              y: 20,
              handleIn: { dx: 0, dy: -8 },
              handleOut: { dx: 0, dy: 8 },
              symmetric: true,
            },
            {
              x: 20,
              y: 32,
              handleIn: { dx: 8, dy: 0 },
              handleOut: { dx: -8, dy: 0 },
              symmetric: true,
            },
          ],
        }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2\u00d72 solid with topOffset', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutoutConfig: { topOffset: 3 },
      cutouts: [makeCutout({ shape: 'rectangle', cutDepth: 5 })],
    },
  }),
];
