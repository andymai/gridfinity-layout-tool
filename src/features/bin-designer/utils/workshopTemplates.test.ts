import { describe, expect, it } from 'vitest';
import { assemblySchema, DEFAULT_ASSEMBLY_STRUCTURE } from '@/shared/items/assembly/descriptor';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { FeatureColorConfig } from '@/shared/types/bin';
import { resolvePlacedParts } from '@/shared/types/assemblyPlacement';
import { buildWorkshopTemplate, WORKSHOP_TEMPLATE_IDS } from './workshopTemplates';

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

  it('returns fresh ids per build', () => {
    const a = buildWorkshopTemplate('pliersRack', envelope);
    const b = buildWorkshopTemplate('pliersRack', envelope);
    expect(a[0]?.id).not.toBe(b[0]?.id);
  });
});
