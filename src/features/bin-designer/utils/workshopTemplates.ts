/**
 * Starter templates for the Workshop: complete part trees sized to the
 * current footprint. Each build returns fresh nodes with new ids so a
 * template can be applied repeatedly; sizes derive from the envelope, so a
 * 2x1 base gets a smaller rack than a 4x2.
 */
import type { AssemblyPartNode } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { createAssemblyPartNode, defaultCutterProfile } from '@/shared/items/assembly/descriptor';

export type WorkshopTemplateId = 'pliersRack' | 'screwdriverBlock';

export const WORKSHOP_TEMPLATE_IDS: readonly WorkshopTemplateId[] = [
  'pliersRack',
  'screwdriverBlock',
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

  const rail = createAssemblyPartNode('block', crypto.randomUUID(), {
    x: w / 2,
    y: railY,
    seatZ: 0,
    rotZDeg: 0,
  });
  const railNode: AssemblyPartNode = {
    ...rail,
    params: { ...rail.params, width: w - 8, depth: railDepth, height: 30, wedgeAngleDeg: 0 },
  };

  const fin = createAssemblyPartNode('fin', crypto.randomUUID(), {
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

  const hole = createAssemblyPartNode('cutter', crypto.randomUUID(), {
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

  const block = createAssemblyPartNode('block', crypto.randomUUID(), {
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

export function buildWorkshopTemplate(
  id: WorkshopTemplateId,
  envelope: ItemEnvelope
): AssemblyPartNode[] {
  switch (id) {
    case 'pliersRack':
      return pliersRack(envelope);
    case 'screwdriverBlock':
      return screwdriverBlock(envelope);
  }
}
