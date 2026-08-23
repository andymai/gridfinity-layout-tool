import { describe, expect, it } from 'vitest';
import { assemblySchema, DEFAULT_ASSEMBLY_STRUCTURE } from '@/shared/items/assembly/descriptor';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { FeatureColorConfig } from '@/shared/types/bin';
import { resolvePlacedParts } from '@/shared/types/assemblyPlacement';
import {
  buildWorkshopTemplate,
  convertToolRackToAssembly,
  WORKSHOP_TEMPLATE_IDS,
} from './workshopTemplates';

const envelope = createDefaultEnvelope({ enabled: false } as FeatureColorConfig);

describe('buildWorkshopTemplate', () => {
  it.each(WORKSHOP_TEMPLATE_IDS)('%s validates against the assembly schema', (id) => {
    const parts = buildWorkshopTemplate(id, envelope);
    const result = assemblySchema.safeParse({ ...DEFAULT_ASSEMBLY_STRUCTURE, parts });
    expect(result.success).toBe(true);
  });

  it('sizes the pliers rack fin row to the footprint', () => {
    const parts = buildWorkshopTemplate('pliersRack', envelope);
    const fin = parts.find((n) => n.type === 'fin');
    expect(fin?.array?.count).toBeGreaterThanOrEqual(2);
    const placed = resolvePlacedParts({ ...DEFAULT_ASSEMBLY_STRUCTURE, parts });
    const w = envelope.width * envelope.gridUnitMm;
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(w);
    }
  });

  it('parents the screwdriver holes to the block', () => {
    const parts = buildWorkshopTemplate('screwdriverBlock', envelope);
    expect(parts).toHaveLength(1);
    const block = parts[0];
    expect(block?.children[0]?.type).toBe('cutter');
    expect(block?.children[0]?.array?.count).toBeGreaterThanOrEqual(2);
  });

  it('converts a tool rack into a schema-valid assembly with matching layout', () => {
    const rack = {
      kind: 'toolRack' as const,
      floorThickness: 2,
      finAngleDeg: 20,
      finThickness: 3,
      finHeight: 25,
      finCount: 6,
      slotPitch: 16,
      slotInsetMm: 8,
      backRail: { enabled: true, height: 10, thickness: 3 },
    };
    const converted = convertToolRackToAssembly(rack, envelope);
    expect(assemblySchema.safeParse(converted).success).toBe(true);
    expect(converted.base.floorThickness).toBe(2);
    const fin = converted.parts.find((n) => n.type === 'fin');
    expect(fin?.array?.count).toBe(6);
    expect(fin?.type === 'fin' && fin.params.leanDeg).toBe(20);
    const rail = converted.parts.find((n) => n.type === 'block');
    expect(rail?.type === 'block' && rail.params.height).toBe(10);
  });

  it('derives fin count from pitch when the rack omitted it', () => {
    const rack = {
      kind: 'toolRack' as const,
      floorThickness: 2,
      finAngleDeg: 15,
      finThickness: 3,
      finHeight: 25,
      slotPitch: 16,
      slotInsetMm: 8,
      backRail: { enabled: false, height: 10, thickness: 3 },
    };
    const converted = convertToolRackToAssembly(rack, envelope);
    // 4x42=168mm wide, 8mm insets: floor((168-16)/16)+1 = 10 fins.
    expect(converted.parts[0]?.array?.count).toBe(10);
    expect(converted.parts).toHaveLength(1);
  });

  it('returns fresh ids per build', () => {
    const a = buildWorkshopTemplate('pliersRack', envelope);
    const b = buildWorkshopTemplate('pliersRack', envelope);
    expect(a[0]?.id).not.toBe(b[0]?.id);
  });
});
