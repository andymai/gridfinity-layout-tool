/**
 * Cross-boundary equality test for the technique-derivation mirror.
 *
 * `deriveTechniques` (client, typed on `BinParams`) and `deriveCommunityTechniques`
 * (server, `api/lib/communityValidation.ts`, typed on sanitized `Record<string,
 * unknown>` params) MUST agree on every input: derivation drift is silent
 * (unlike validation drift, which 400s). This is the node-env `unit` vitest
 * project, which also picks up `api/**\/*.test.ts`, so both sides are importable
 * from the same test run.
 */
import { describe, expect, it } from 'vitest';

import { deriveCommunityTechniques } from '../../../api/lib/communityValidation.js';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

import { deriveTechniques } from './communityTechniques';

function withCellMask(cells: (0 | 1)[]): BinParams {
  return { ...DEFAULT_BIN_PARAMS, cellMask: { cols: 2, rows: 2, cells } };
}

const FIXTURES: readonly BinParams[] = [
  DEFAULT_BIN_PARAMS,
  {
    ...DEFAULT_BIN_PARAMS,
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 3,
      rows: 2,
      cells: [0, 1, 2, 3, 4, 5],
    },
  },
  {
    ...DEFAULT_BIN_PARAMS,
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 0, 0, 0] },
  },
  { ...DEFAULT_BIN_PARAMS, walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true } },
  { ...DEFAULT_BIN_PARAMS, scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true } },
  { ...DEFAULT_BIN_PARAMS, label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } },
  { ...DEFAULT_BIN_PARAMS, style: 'slotted' },
  { ...DEFAULT_BIN_PARAMS, lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } },
  { ...DEFAULT_BIN_PARAMS, handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true } },
  withCellMask([1, 1, 1, 0]),
  withCellMask([1, 1, 1, 1]),
  { ...DEFAULT_BIN_PARAMS, wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true } },
  {
    ...DEFAULT_BIN_PARAMS,
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 3,
      rows: 2,
      cells: [0, 1, 2, 3, 4, 5],
    },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
  },
  {
    ...DEFAULT_BIN_PARAMS,
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 1, rows: 4, cells: [0, 1, 2, 3] },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, alignment: 'center' },
  },
  {
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted',
    walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true },
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
    handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
    cellMask: { cols: 2, rows: 2, cells: [1, 1, 0, 1] },
  },
];

describe('deriveTechniques vs deriveCommunityTechniques (cross-boundary mirror)', () => {
  it('produces at least 12 fixture variations', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(12);
  });

  it.each(FIXTURES.map((params, index) => [index, params] as const))(
    'fixture %i: client and server derivations agree',
    (_index, params) => {
      const clientResult = deriveTechniques(params);
      const serverResult = deriveCommunityTechniques(params as unknown as Record<string, unknown>);
      expect(clientResult).toEqual(serverResult);
    }
  );
});
