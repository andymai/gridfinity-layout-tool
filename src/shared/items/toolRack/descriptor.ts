/**
 * Slanted tool rack — descriptor (schema/defaults/migration/labels), the
 * worker- and UI-safe half of this item kind. No React, no OCCT.
 */
import { z } from 'zod';
import type { ItemTypeDescriptor } from '@/shared/items/registry';
import type { ItemEnvelope, ToolRackStructure } from '@/shared/types/item';

export const MAX_RACK_FIN_ANGLE = 45;

export const MIN_RACK_FINS = 2;

export const DEFAULT_TOOL_RACK_STRUCTURE: ToolRackStructure = {
  kind: 'toolRack',
  floorThickness: 2,
  finAngleDeg: 20,
  finThickness: 3,
  finHeight: 25,
  // Explicit so the panel reading and the generated preview agree from the
  // first render — the generator only auto-derives from slotPitch when omitted.
  finCount: 6,
  slotPitch: 16,
  slotInsetMm: 8,
  backRail: { enabled: true, height: 10, thickness: 3 },
};

const backRailSchema = z.object({
  enabled: z.boolean(),
  height: z.number().min(0).max(200),
  thickness: z.number().min(0.4).max(20),
});

export const toolRackSchema: z.ZodType<ToolRackStructure> = z.object({
  kind: z.literal('toolRack'),
  floorThickness: z.number().min(0.8).max(20),
  finAngleDeg: z.number().min(0).max(MAX_RACK_FIN_ANGLE),
  finThickness: z.number().min(0.8).max(20),
  finHeight: z.number().min(4).max(200),
  finCount: z.number().int().min(MIN_RACK_FINS).max(64).optional(),
  slotPitch: z.number().min(2).max(200).optional(),
  slotInsetMm: z.number().min(0).max(100),
  backRail: backRailSchema,
  cornerRadius: z.number().min(0).max(50).optional(),
});

function migrateRack(raw: unknown): ToolRackStructure {
  const merged = {
    ...DEFAULT_TOOL_RACK_STRUCTURE,
    ...(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}),
    kind: 'toolRack' as const,
  };
  const parsed = toolRackSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_TOOL_RACK_STRUCTURE;
}

export const toolRackDescriptor: ItemTypeDescriptor<ToolRackStructure> = {
  kind: 'toolRack',
  schema: toolRackSchema,
  defaults: () => ({
    ...DEFAULT_TOOL_RACK_STRUCTURE,
    backRail: { ...DEFAULT_TOOL_RACK_STRUCTURE.backRail },
  }),
  migrate: (raw: unknown, _envelope: ItemEnvelope) => migrateRack(raw),
  labelKey: 'binDesigner.itemKind.toolRack',
  descriptionKey: 'binDesigner.itemKind.toolRack.description',
  exportFileName: (envelope) => `tool_rack_${envelope.width}x${envelope.depth}`,
};
