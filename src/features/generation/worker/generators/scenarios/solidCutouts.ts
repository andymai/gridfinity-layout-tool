import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

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
  defineScenario('solid cutouts', '2\u00d72 solid with rectangle with scoop cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', scoopRadius: 3 })],
    },
  }),
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
