/**
 * Starter templates for the Workshop: complete part trees sized to the
 * current footprint. Each build returns fresh nodes with new ids so a
 * template can be applied repeatedly; sizes derive from the envelope, so a
 * 2x1 base gets a smaller rack than a 4x2.
 */
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope, ToolRackStructure } from '@/shared/types/item';
import {
  clampPartTransform,
  createAssemblyPartNode,
  defaultCutterProfile,
} from '@/shared/items/assembly/descriptor';
import { generateUUID } from '@/shared/utils/uuid';

export type WorkshopTemplateId =
  | 'pliersRack'
  | 'screwdriverBlock'
  | 'plierComb'
  | 'screwdriverStation'
  | 'angledBitBank'
  | 'wrenchRail';

export const WORKSHOP_TEMPLATE_IDS: readonly WorkshopTemplateId[] = [
  'pliersRack',
  'screwdriverBlock',
  'plierComb',
  'screwdriverStation',
  'angledBitBank',
  'wrenchRail',
];

function extent(envelope: ItemEnvelope): { w: number; d: number } {
  return { w: envelope.width * envelope.gridUnitMm, d: envelope.depth * envelope.gridUnitMm };
}

/**
 * The tool rack's successor: leaning fins arrayed across the width in front
 * of a back rail. Fins run front-to-back (a 90° turn of the fin's X-axis
 * length), leaning back toward the rail.
 */
function pliersRack(envelope: ItemEnvelope): AssemblyPartNode[] {
  const { w, d } = extent(envelope);
  const railDepth = 8;
  const railY = d - railDepth / 2 - 4;
  const finLength = Math.max(12, Math.min(d - railDepth - 14, 60));
  const pitch = 16;
  const inset = 10;
  const count = Math.max(2, Math.min(64, Math.floor((w - 2 * inset) / pitch) + 1));

  const rail = createAssemblyPartNode('block', generateUUID(), {
    x: w / 2,
    y: railY,
    seatZ: 0,
    rotZDeg: 0,
  });
  const railNode: AssemblyPartNode = {
    ...rail,
    params: { ...rail.params, width: w - 8, depth: railDepth, height: 30, wedgeAngleDeg: 0 },
  };

  const fin = createAssemblyPartNode('fin', generateUUID(), {
    x: inset,
    y: railY - railDepth / 2 - finLength / 2,
    seatZ: 0,
    rotZDeg: 90,
  });
  const finNode: AssemblyPartNode = {
    ...fin,
    params: { ...fin.params, length: finLength, thickness: 3, height: 28, leanDeg: 18 },
    array: { count, dx: pitch, dy: 0 },
  };

  return [railNode, finNode];
}

/** A drilled driver block: one block with a row of chamfered hole cutters. */
function screwdriverBlock(envelope: ItemEnvelope): AssemblyPartNode[] {
  const { w, d } = extent(envelope);
  const blockW = w - 16;
  const blockD = Math.min(d - 16, 34);
  const pitch = 18;
  const count = Math.max(2, Math.min(64, Math.floor((blockW - 20) / pitch) + 1));

  const hole = createAssemblyPartNode('cutter', generateUUID(), {
    x: -((count - 1) * pitch) / 2,
    y: 0,
    seatZ: 0,
    rotZDeg: 0,
  });
  const holeNode: AssemblyPartNode = {
    ...hole,
    params: {
      ...hole.params,
      profile: defaultCutterProfile('circle'),
      depth: 24,
      clearance: 0.3,
      chamfer: 1,
    },
    array: { count, dx: pitch, dy: 0 },
  };

  const block = createAssemblyPartNode('block', generateUUID(), {
    x: w / 2,
    y: d / 2,
    seatZ: 0,
    rotZDeg: 0,
  });
  const blockNode: AssemblyPartNode = {
    ...block,
    params: { ...block.params, width: blockW, depth: blockD, height: 28, wedgeAngleDeg: 0 },
    children: [holeNode],
  };

  return [blockNode];
}

function plierComb(envelope: ItemEnvelope): AssemblyPartNode[] {
  const { w, d } = extent(envelope);
  const width = w - 16;
  const slotCount = Math.max(2, Math.min(15, Math.floor(width / 26)));
  const comb = createAssemblyPartNode('comb', generateUUID(), {
    x: w / 2,
    y: d / 2,
    seatZ: 0,
    rotZDeg: 0,
  });
  return [
    {
      ...comb,
      params: {
        ...comb.params,
        width,
        depth: Math.min(16, d - 12),
        height: 42,
        slotCount,
        slotWidth: 13,
        slotDepth: 32,
      },
    },
  ];
}

function screwdriverStation(envelope: ItemEnvelope): AssemblyPartNode[] {
  const { w, d } = extent(envelope);
  const stepDepth = Math.min(24, Math.max(14, d / 3));
  const riser = createAssemblyPartNode('riser', generateUUID(), {
    x: w / 2,
    y: d - stepDepth - 6,
    seatZ: 0,
    rotZDeg: 0,
  });
  const bankDepth = Math.min(22, stepDepth);
  const bank = createAssemblyPartNode('boreBank', generateUUID(), {
    x: 0,
    y: stepDepth / 2,
    seatZ: 0,
    rotZDeg: 0,
  });
  const bankNode: AssemblyPartNode = {
    ...bank,
    params: {
      ...bank.params,
      width: w - 28,
      depth: bankDepth,
      height: 30,
      boreDiameter: 9,
      boreDepth: 24,
      columns: Math.max(2, Math.min(15, Math.floor((w - 28) / 20))),
      rows: 1,
      angleDeg: 12,
    },
    label: { text: 'DRIVERS', sizeMm: 7, depthMm: 0.6, style: 'recessed', face: 'front' },
  };
  return [
    {
      ...riser,
      params: { ...riser.params, width: w - 20, stepCount: 2, stepDepth, stepHeight: 16 },
      children: [bankNode],
    },
  ];
}

function angledBitBank(envelope: ItemEnvelope): AssemblyPartNode[] {
  const { w, d } = extent(envelope);
  const bank = createAssemblyPartNode('boreBank', generateUUID(), {
    x: w / 2,
    y: d / 2,
    seatZ: 0,
    rotZDeg: 0,
  });
  return [
    {
      ...bank,
      params: {
        ...bank.params,
        width: w - 16,
        depth: Math.min(34, d - 12),
        height: 36,
        boreDiameter: 8,
        boreDepth: 30,
        columns: Math.max(2, Math.min(15, Math.floor((w - 16) / 14))),
        rows: 2,
        angleDeg: 18,
      },
      label: { text: 'BITS', sizeMm: 9, depthMm: 0.8, style: 'recessed', face: 'front' },
    },
  ];
}

function wrenchRail(envelope: ItemEnvelope): AssemblyPartNode[] {
  const { w, d } = extent(envelope);
  const width = w - 16;
  const comb = createAssemblyPartNode('comb', generateUUID(), {
    x: w / 2,
    y: d / 2,
    seatZ: 0,
    rotZDeg: 0,
  });
  return [
    {
      ...comb,
      params: {
        ...comb.params,
        width,
        depth: Math.min(14, d - 12),
        height: 46,
        slotCount: Math.max(2, Math.min(15, Math.floor(width / 18))),
        slotWidth: 7,
        slotDepth: 30,
      },
      label: { text: 'WRENCHES', sizeMm: 7, depthMm: 0.6, style: 'raised', face: 'front' },
    },
  ];
}

export function buildWorkshopTemplate(
  id: WorkshopTemplateId,
  envelope: ItemEnvelope
): AssemblyPartNode[] {
  switch (id) {
    case 'pliersRack':
      return pliersRack(envelope);
    case 'screwdriverBlock':
      return screwdriverBlock(envelope);
    case 'plierComb':
      return plierComb(envelope);
    case 'screwdriverStation':
      return screwdriverStation(envelope);
    case 'angledBitBank':
      return angledBitBank(envelope);
    case 'wrenchRail':
      return wrenchRail(envelope);
  }
}

/**
 * Convert a saved slanted tool rack into an equivalent Workshop build:
 * the back rail becomes a block, the fin row becomes one fin node with a
 * linear array (same count/pitch derivation the rack generator used), and
 * the floor carries over on the base. Geometry matches the rack's layout —
 * fins are depth-running plates arrayed across the width, leaning back.
 */
export function convertToolRackToAssembly(
  rack: ToolRackStructure,
  envelope: ItemEnvelope
): AssemblyStructure {
  const w = envelope.width * envelope.gridUnitMm;
  const d = envelope.depth * envelope.gridUnitMm;
  const pitch = rack.slotPitch ?? 16;
  const usableW = w - 2 * rack.slotInsetMm;
  // Same derivation as the rack generator's resolveFins: finCount wins,
  // otherwise round(usable / pitch) + 1, spacing spread across the usable run.
  const count = Math.max(2, Math.min(64, rack.finCount ?? Math.round(usableW / pitch) + 1));
  const spacing = count > 1 ? usableW / (count - 1) : 0;

  const parts: AssemblyPartNode[] = [];

  if (rack.backRail.enabled) {
    // Flush to the back edge, full footprint width — the rack generator's
    // placement, so a migrated rack keeps its exact outline. Rail values are
    // clamped into the block schema (rack rails could be thinner/shorter
    // than a block allows); an unclamped value would make migration drop
    // the rail entirely on the next load.
    const rail = createAssemblyPartNode(
      'block',
      generateUUID(),
      clampPartTransform({
        x: w / 2,
        y: d - rack.backRail.thickness / 2,
        seatZ: 0,
        rotZDeg: 0,
      })
    );
    parts.push({
      ...rail,
      params: {
        ...rail.params,
        width: Math.min(Math.max(w, 2), 400),
        depth: Math.min(Math.max(rack.backRail.thickness, 2), 400),
        height: Math.min(Math.max(rack.backRail.height, 1), 200),
        wedgeAngleDeg: 0,
      },
    });
  }

  // Fins span the full depth and fuse into the rail, as in the generator.
  // leanAxis 'length' + the 90° turn reproduces the rack's back-lean: the
  // shear runs along the plate (local +X), which the rotation maps to +Y.
  const finLength = Math.max(12, Math.min(d, 400));
  const fin = createAssemblyPartNode(
    'fin',
    generateUUID(),
    clampPartTransform({
      x: rack.slotInsetMm,
      y: d / 2,
      seatZ: 0,
      rotZDeg: 90,
    })
  );
  parts.push({
    ...fin,
    params: {
      ...fin.params,
      length: finLength,
      thickness: Math.min(Math.max(rack.finThickness, 0.8), 20),
      height: Math.min(Math.max(rack.finHeight, 4), 200),
      leanDeg: Math.min(Math.max(rack.finAngleDeg, 0), 45),
      leanAxis: 'length',
    },
    ...(count > 1 ? { array: { count, dx: Math.min(spacing, 500), dy: 0 } } : {}),
  });

  return {
    kind: 'assembly',
    schemaVersion: 1,
    base: {
      floorThickness: Math.min(Math.max(rack.floorThickness, 1), 10),
      ...(rack.cornerRadius !== undefined
        ? { cornerRadius: Math.min(Math.max(rack.cornerRadius, 0), 20) }
        : {}),
    },
    mirrorAxis: 'x',
    parts,
  };
}
