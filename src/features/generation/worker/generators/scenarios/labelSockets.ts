/**
 * Swappable-label socket mode scenarios.
 *
 * The custom asserts verify the cut pocket against the pinned interchange
 * spec (`@/shared/constants/labelPlates`) from the actual mesh — plate
 * width + 0.3mm total clearance, the click-in pocket depth (plate thickness
 * plus the seating relief), and rib band planes at floor+0.2/+0.6.
 *
 * Most socket scenarios disable the stacking lip so the mesh maxZ IS the
 * shelf top (plus the COPLANAR_OVERLAP proud lip), making pocket Z-planes
 * derivable without replicating deriveDimensions. The lipped stacking-relief
 * scenario instead derives its planes down from the lip peak.
 */

import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_RIB_HEIGHT_MM,
  LABEL_SOCKET_RIB_START_MM,
  LABEL_SOCKET_STACK_RELIEF_MM,
  LABEL_SOCKET_WALL_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { COPLANAR_OVERLAP, LIP_HEIGHT, LIP_SMALL_TAPER } from '../generatorConstants';

const SOCKET_LABEL = {
  ...DEFAULT_BIN_PARAMS.label,
  enabled: true,
  mode: 'socket' as const,
  depth: 14,
  alignment: 'center' as const,
};

const NO_LIP_BASE = { ...DEFAULT_BIN_PARAMS.base, stackingLip: false };

interface PocketExpectation {
  readonly plateWidthU: LabelPlateWidthU;
  readonly label: string;
}

/**
 * Verify the socket pocket cut into a back-anchored, center-aligned tab.
 * Derives every expected plane from params + the pinned spec, then checks
 * the mesh has vertices on them:
 *  - pocket floor at (shelf top − click pocket depth), X-extent =
 *    ±(plate + clearance)/2
 *  - horizontal rib band planes at floor+0.2 and floor+0.6 (protrusion
 *    depth and per-wall coverage are not measured here)
 */
function assertSocketPocket(result: MeshData, params: BinParams, exp: PocketExpectation): void {
  const { vertices } = result;
  // Derive the expected clearance the SAME way the worker does, so a wide-nozzle
  // scenario proves the generator actually read `params.nozzleSizeMm`.
  const clearanceMm = effectiveLabelSocketClearance(
    params.nozzleSizeMm,
    params.label.plateFitOffset
  );
  const pocketW = labelPlateWidthMm(exp.plateWidthU) + clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + clearanceMm;

  const outerD = params.depth * params.gridUnitMm - 0.5;
  const innerD = outerD - 2 * params.wallThickness;
  // Back-anchored tab: pocket sits one wall margin in from the interior
  // back-wall face at +innerD/2.
  const pocketYFar = innerD / 2 - LABEL_SOCKET_WALL_MM;
  const pocketYNear = pocketYFar - pocketD;

  let maxZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > maxZ) maxZ = vertices[i];
  }
  const shelfTopZ = maxZ - COPLANAR_OVERLAP;
  const floorZ = shelfTopZ - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;

  // Collect pocket-floor vertices: Z on the floor plane, Y inside the
  // pocket, AND face normal pointing up — gusset hypotenuse / shelf side
  // faces can graze the same Z plane, so unfiltered vertices overreport
  // the extent.
  const { normals } = result;
  let floorCount = 0;
  let floorMinX = Infinity;
  let floorMaxX = -Infinity;
  let ribBandCount = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    const nz = normals[i + 2];
    const inPocketY = y > pocketYNear - 0.05 && y < pocketYFar + 0.05;
    if (!inPocketY) continue;
    if (Math.abs(nz) < 0.9) continue;
    // Floor measurement wants strictly up-facing triangles; the rib band
    // below keeps both directions (rib undersides face down).
    if (nz > 0.9 && Math.abs(z - floorZ) < 0.05) {
      floorCount++;
      if (x < floorMinX) floorMinX = x;
      if (x > floorMaxX) floorMaxX = x;
    }
    // Rib band: horizontal faces at floor+0.2 and floor+0.6.
    if (
      Math.abs(z - (floorZ + LABEL_SOCKET_RIB_START_MM)) < 0.05 ||
      Math.abs(z - (floorZ + LABEL_SOCKET_RIB_START_MM + LABEL_SOCKET_RIB_HEIGHT_MM)) < 0.05
    ) {
      ribBandCount++;
    }
  }

  if (floorCount < 4) {
    throw new Error(`${exp.label}: no pocket floor plane found at Z=${floorZ.toFixed(2)}`);
  }
  if (ribBandCount < 4) {
    throw new Error(`${exp.label}: no rib band faces found above the pocket floor`);
  }
  // Center-aligned socket: floor spans ±pocketW/2. This pins the interchange
  // width (plate + total clearance) — a drift here breaks ecosystem plates.
  const measuredW = floorMaxX - floorMinX;
  if (Math.abs(measuredW - pocketW) > 0.1) {
    throw new Error(
      `${exp.label}: pocket width ${measuredW.toFixed(2)}mm != expected ${pocketW.toFixed(2)}mm`
    );
  }
  if (Math.abs(floorMinX + pocketW / 2) > 0.1 || Math.abs(floorMaxX - pocketW / 2) > 0.1) {
    throw new Error(
      `${exp.label}: pocket not centered (X ${floorMinX.toFixed(2)}..${floorMaxX.toFixed(2)})`
    );
  }
}

/**
 * Assert the click-in pocket floor sits on the relieved plane and that the
 * un-relieved plane is empty. Derives both down from the lip peak (mesh maxZ)
 * rather than replicating deriveDimensions.
 */
function assertRelievedPocketFloor(result: MeshData, label: string): void {
  const { vertices, normals } = result;
  let maxZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > maxZ) maxZ = vertices[i];
  }
  // maxZ is the lip peak: wallTop + LIP_HEIGHT. Walk down to the
  // interior ceiling, then apply relief + pocket depth.
  const interiorTopZ = maxZ - LIP_HEIGHT - LIP_SMALL_TAPER;
  const relievedFloorZ =
    interiorTopZ - LABEL_SOCKET_STACK_RELIEF_MM - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;
  const unrelievedFloorZ = interiorTopZ - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;
  let relieved = 0;
  let unrelieved = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    if (normals[i + 2] < 0.9) continue;
    const z = vertices[i + 2];
    if (Math.abs(z - relievedFloorZ) < 0.05) relieved++;
    if (Math.abs(z - unrelievedFloorZ) < 0.05) unrelieved++;
  }
  if (relieved < 4) {
    throw new Error(`${label}: no pocket floor at relieved Z=${relievedFloorZ.toFixed(2)}`);
  }
  if (unrelieved > 0) {
    throw new Error(
      `${label}: ${unrelieved} up-facing verts at un-relieved floor Z=` +
        `${unrelievedFloorZ.toFixed(2)} — stacking relief not applied`
    );
  }
}

export const labelSockets: ScenarioCase[] = [
  defineScenario('label sockets', '1×1 socket hosts a 1U plate', {
    params: {
      width: 1,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: SOCKET_LABEL,
    },
    customAssert: (result, params) =>
      assertSocketPocket(result, params, { plateWidthU: 1, label: '1x1-socket' }),
  }),

  defineScenario('label sockets', '3×1 socket auto-quantizes to 3U', {
    params: {
      width: 3,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: SOCKET_LABEL,
    },
    customAssert: (result, params) =>
      assertSocketPocket(result, params, { plateWidthU: 3, label: '3x1-auto' }),
  }),

  // Wide nozzle: the pocket clearance scales up, so the measured pocket
  // is wider than the 0.4mm baseline. The assert derives the expected width from
  // `params.nozzleSizeMm`, so this fails if the generator ignores the nozzle.
  defineScenario('label sockets', '3×1 socket on a 0.6mm nozzle widens the pocket', {
    params: {
      width: 3,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: SOCKET_LABEL,
      nozzleSizeMm: 0.6,
    },
    customAssert: (result, params) =>
      assertSocketPocket(result, params, { plateWidthU: 3, label: '3x1-nozzle-0.6' }),
  }),

  defineScenario('label sockets', '3×1 override forces a 1U plate', {
    params: {
      width: 3,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: SOCKET_LABEL,
      compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0], labelPlateWidths: [1] },
    },
    customAssert: (result, params) =>
      assertSocketPocket(result, params, { plateWidthU: 1, label: '3x1-override-1u' }),
  }),

  // 4 columns across a 2U bin: every column is too narrow for a 1U plate,
  // so the builder falls back to ONE bin-spanning socket (2U plate).
  defineScenario('label sockets', '2×1 four columns → bin-spanning 2U socket', {
    params: {
      width: 2,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: SOCKET_LABEL,
      compartments: { cols: 4, rows: 1, thickness: 1.2, cells: [0, 1, 2, 3] },
    },
    customAssert: (result, params) =>
      assertSocketPocket(result, params, { plateWidthU: 2, label: '2x1-spanning' }),
  }),

  // Two compartments side by side: each gets its own 1U socket. Verifies
  // pocket floors exist in both halves of the bin.
  defineScenario('label sockets', '2×1 two compartments, two 1U sockets', {
    params: {
      width: 2,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: SOCKET_LABEL,
      compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
    },
    customAssert: (result) => {
      const { vertices } = result;
      let maxZ = -Infinity;
      for (let i = 2; i < vertices.length; i += 3) {
        if (vertices[i] > maxZ) maxZ = vertices[i];
      }
      const floorZ = maxZ - COPLANAR_OVERLAP - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;
      let left = 0;
      let right = 0;
      for (let i = 0; i < vertices.length; i += 3) {
        if (Math.abs(vertices[i + 2] - floorZ) < 0.05) {
          if (vertices[i] < 0) left++;
          else right++;
        }
      }
      if (left < 4 || right < 4) {
        throw new Error(`two-sockets: expected pocket floors both sides (L=${left}, R=${right})`);
      }
    },
  }),

  // Lipped bin: the click-in socket shelf sinks by the stacking relief so a
  // seated plate (plus emboss/print proudness) can't lift a stacked bin's
  // foot, which seats only 0.25mm above the lip base plane. Derives the
  // relieved pocket floor down from the lip peak (mesh maxZ) and proves the
  // un-relieved plane is empty — i.e. the relief actually moved the shelf.
  defineScenario('label sockets', '1×1 lipped socket sinks by the stacking relief', {
    params: {
      width: 1,
      depth: 1,
      height: 5,
      label: SOCKET_LABEL,
    },
    customAssert: (result) => assertRelievedPocketFloor(result, 'lipped-relief'),
  }),

  // Shortest bin that can host a socket. The relief eats tab-height budget, so
  // the 14mm depth floor clears the 14.5mm relieved shelf by only 0.5mm — grow
  // the relief again and `buildLabelTabs` starts returning null here, which the
  // taller scenarios above would not notice.
  defineScenario('label sockets', '3u lipped socket at the tightest height budget', {
    params: {
      width: 1,
      depth: 1,
      height: 3,
      label: SOCKET_LABEL,
    },
    customAssert: (result) => assertRelievedPocketFloor(result, '3u-tightest'),
  }),

  // Half-grid 0.5U bin: nothing fits, even spanning — tabs degrade to plain
  // shelves and the bin still generates cleanly.
  defineScenario('label sockets', '0.5×1 half bin — no socket fits, plain shelf', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: { ...SOCKET_LABEL, depth: 12 },
    },
  }),

  // Socket composes with the honeycomb wall pattern (the socket cuts only
  // the shelf, never a wall, so no border clipping is involved — this guards
  // that assumption).
  defineScenario('label sockets', '2×2 socket + honeycomb walls', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      base: NO_LIP_BASE,
      label: SOCKET_LABEL,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
  }),

  // Text-mode sentinel: mode absent takes the legacy code path; the
  // snapshot pins its triangle count so socket-mode changes can't perturb
  // text-mode geometry.
  defineScenario('label sockets', '1×1 text mode unchanged', {
    params: {
      width: 1,
      depth: 1,
      height: 5,
      base: NO_LIP_BASE,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
  }),
];
