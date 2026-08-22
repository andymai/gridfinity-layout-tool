/**
 * Workshop assembly — descriptor (schema/defaults/migration/labels), the
 * worker- and UI-safe half of this item kind. No React, no OCCT.
 */
import { z } from 'zod';
import type { ItemTypeDescriptor } from '@/shared/items/registry';
import type { ItemEnvelope } from '@/shared/types/item';
import type {
  AssemblyPartNode,
  AssemblyPartParamsByType,
  AssemblyPartType,
  AssemblyStructure,
  PartTransform,
} from '@/shared/types/assembly';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';

/** Hard ceiling on total nodes; the printability checker advises far below it. */
export const MAX_ASSEMBLY_PARTS = 256;

export const MAX_ASSEMBLY_DEPTH = 8;

const transformSchema = z.object({
  x: z.number().min(-1000).max(1000),
  y: z.number().min(-1000).max(1000),
  seatZ: z.number().min(-200).max(200),
  rotZDeg: z.number().min(-360).max(360),
});

const arraySchema = z.object({
  count: z.number().int().min(2).max(64),
  dx: z.number().min(-500).max(500),
  dy: z.number().min(-500).max(500),
});

const postParamsSchema = z.object({
  diameter: z.number().min(2).max(60),
  height: z.number().min(4).max(200),
  taperDeg: z.number().min(0).max(15),
  tipChamfer: z.number().min(0).max(5),
});

const finParamsSchema = z.object({
  length: z.number().min(4).max(400),
  thickness: z.number().min(0.8).max(20),
  height: z.number().min(4).max(200),
  leanDeg: z.number().min(0).max(45),
});

const blockParamsSchema = z.object({
  width: z.number().min(2).max(400),
  depth: z.number().min(2).max(400),
  height: z.number().min(1).max(200),
  wedgeAngleDeg: z.number().min(0).max(60),
});

const tubeParamsSchema = z.object({
  boreDiameter: z.number().min(2).max(80),
  wall: z.number().min(0.8).max(10),
  height: z.number().min(4).max(200),
  tiltDeg: z.number().min(0).max(30),
});

const cradleParamsSchema = z.object({
  length: z.number().min(4).max(400),
  width: z.number().min(4).max(100),
  height: z.number().min(4).max(100),
  grooveStyle: z.enum(['round', 'vee']),
  grooveWidth: z.number().min(2).max(80),
  grooveDepth: z.number().min(1).max(60),
});

const hookParamsSchema = z.object({
  stemHeight: z.number().min(4).max(200),
  reach: z.number().min(4).max(100),
  lipHeight: z.number().min(0).max(60),
  thickness: z.number().min(0.8).max(20),
  width: z.number().min(2).max(100),
});

const archParamsSchema = z.object({
  span: z.number().min(8).max(400),
  height: z.number().min(8).max(200),
  style: z.enum(['rod', 'bridge']),
  rodDiameter: z.number().min(2).max(40),
  bridgeWidth: z.number().min(2).max(60),
  uprightThickness: z.number().min(2).max(30),
  depth: z.number().min(4).max(60),
});

const pathPointSchema = z.object({
  x: z.number().min(-2000).max(2000),
  y: z.number().min(-2000).max(2000),
  handleIn: z
    .object({ dx: z.number().min(-2000).max(2000), dy: z.number().min(-2000).max(2000) })
    .nullable(),
  handleOut: z
    .object({ dx: z.number().min(-2000).max(2000), dy: z.number().min(-2000).max(2000) })
    .nullable(),
  symmetric: z.boolean(),
});

const cutterProfileSchema = z.discriminatedUnion('shape', [
  z.object({ shape: z.literal('circle'), diameter: z.number().min(0.5).max(200) }),
  z.object({
    shape: z.literal('rectangle'),
    width: z.number().min(0.5).max(400),
    depth: z.number().min(0.5).max(400),
    cornerRadius: z.number().min(0).max(50),
  }),
  z.object({
    shape: z.literal('polygon'),
    diameter: z.number().min(0.5).max(200),
    sides: z.number().int().min(3).max(12),
  }),
  z.object({
    shape: z.literal('slot'),
    length: z.number().min(1).max(400),
    width: z.number().min(0.5).max(200),
  }),
  z.object({ shape: z.literal('path'), points: z.array(pathPointSchema).min(2).max(2000) }),
  z.object({
    shape: z.literal('outline'),
    points: z
      .array(z.object({ x: z.number().min(-2000).max(2000), y: z.number().min(-2000).max(2000) }))
      .min(3)
      .max(5000),
  }),
]);

const cutterParamsSchema = z.object({
  profile: cutterProfileSchema,
  depth: z.number().min(0.5).max(200),
  clearance: z.number().min(0).max(5),
  chamfer: z.number().min(0).max(5),
});

const nodeBase = {
  id: z.string().min(1).max(64),
  transform: transformSchema,
  array: arraySchema.optional(),
  mirror: z.boolean().optional(),
};

const partNodeSchema: z.ZodType<AssemblyPartNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      ...nodeBase,
      type: z.literal('post'),
      params: postParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('fin'),
      params: finParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('block'),
      params: blockParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('tube'),
      params: tubeParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('cradle'),
      params: cradleParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('hook'),
      params: hookParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('arch'),
      params: archParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('cutter'),
      params: cutterParamsSchema,
      children: childrenSchema,
    }),
  ])
);

const childrenSchema = z.lazy(() => z.array(partNodeSchema));

function countNodes(nodes: readonly AssemblyPartNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function treeDepth(nodes: readonly AssemblyPartNode[]): number {
  return nodes.length === 0 ? 0 : 1 + Math.max(...nodes.map((n) => treeDepth(n.children)));
}

const baseSchema = z.object({
  floorThickness: z.number().min(1).max(10),
  cornerRadius: z.number().min(0).max(20).optional(),
});

export const assemblySchema: z.ZodType<AssemblyStructure> = z
  .object({
    kind: z.literal('assembly'),
    schemaVersion: z.literal(1),
    base: baseSchema,
    mirrorAxis: z.enum(['x', 'y']),
    parts: z.array(partNodeSchema),
  })
  .refine((s) => countNodes(s.parts) <= MAX_ASSEMBLY_PARTS, {
    message: `an assembly holds at most ${MAX_ASSEMBLY_PARTS} parts`,
  })
  .refine((s) => treeDepth(s.parts) <= MAX_ASSEMBLY_DEPTH, {
    message: `parts stack at most ${MAX_ASSEMBLY_DEPTH} deep`,
  });

export const DEFAULT_ASSEMBLY_STRUCTURE: AssemblyStructure = {
  kind: 'assembly',
  schemaVersion: 1,
  base: { floorThickness: 2 },
  mirrorAxis: 'x',
  parts: [],
};

export const DEFAULT_PART_PARAMS: {
  readonly [K in AssemblyPartType]: AssemblyPartParamsByType[K];
} = {
  post: { diameter: 8, height: 40, taperDeg: 0, tipChamfer: 1 },
  fin: { length: 60, thickness: 3, height: 25, leanDeg: 20 },
  block: { width: 40, depth: 20, height: 20, wedgeAngleDeg: 0 },
  tube: { boreDiameter: 16, wall: 2, height: 60, tiltDeg: 0 },
  cradle: {
    length: 30,
    width: 20,
    height: 15,
    grooveStyle: 'round',
    grooveWidth: 12,
    grooveDepth: 6,
  },
  hook: { stemHeight: 30, reach: 20, lipHeight: 8, thickness: 4, width: 15 },
  arch: {
    span: 60,
    height: 50,
    style: 'rod',
    rodDiameter: 8,
    bridgeWidth: 10,
    uprightThickness: 6,
    depth: 15,
  },
  cutter: { profile: { shape: 'circle', diameter: 6.5 }, depth: 20, clearance: 0.2, chamfer: 0.6 },
};

export const DEFAULT_PART_TRANSFORM: PartTransform = { x: 0, y: 0, seatZ: 0, rotZDeg: 0 };

export function defaultPartParams<K extends AssemblyPartType>(
  type: K
): AssemblyPartParamsByType[K] {
  return structuredClone(DEFAULT_PART_PARAMS[type]);
}

function isAssemblyPartType(v: unknown): v is AssemblyPartType {
  return typeof v === 'string' && (ASSEMBLY_PART_TYPES as readonly string[]).includes(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Salvage one node: fill gaps from defaults, recurse into children, drop the
 * node only when its own values cannot be made valid. Keeping valid siblings
 * and subtrees is the point — one bad node must not cost a whole build.
 */
function normalizePartNode(raw: unknown): AssemblyPartNode | null {
  if (!isRecord(raw)) return null;
  if (!isAssemblyPartType(raw.type)) return null;
  const candidate = {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : crypto.randomUUID(),
    type: raw.type,
    params: { ...defaultPartParams(raw.type), ...(isRecord(raw.params) ? raw.params : {}) },
    transform: { ...DEFAULT_PART_TRANSFORM, ...(isRecord(raw.transform) ? raw.transform : {}) },
    ...(raw.array !== undefined ? { array: raw.array } : {}),
    ...(raw.mirror !== undefined ? { mirror: raw.mirror } : {}),
    children: Array.isArray(raw.children)
      ? raw.children.map(normalizePartNode).filter((n): n is AssemblyPartNode => n !== null)
      : [],
  };
  const parsed = partNodeSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  const withoutOptionals = partNodeSchema.safeParse({
    ...candidate,
    array: undefined,
    mirror: undefined,
  });
  return withoutOptionals.success ? withoutOptionals.data : null;
}

function assemblyDefaults(): AssemblyStructure {
  return {
    ...DEFAULT_ASSEMBLY_STRUCTURE,
    base: { ...DEFAULT_ASSEMBLY_STRUCTURE.base },
    parts: [],
  };
}

function migrateAssembly(raw: unknown): AssemblyStructure {
  const obj = isRecord(raw) ? raw : {};
  const candidate = {
    kind: 'assembly' as const,
    schemaVersion: 1 as const,
    base: {
      ...DEFAULT_ASSEMBLY_STRUCTURE.base,
      ...(isRecord(obj.base) ? obj.base : {}),
    },
    mirrorAxis: obj.mirrorAxis === 'y' ? ('y' as const) : ('x' as const),
    parts: Array.isArray(obj.parts)
      ? obj.parts.map(normalizePartNode).filter((n): n is AssemblyPartNode => n !== null)
      : [],
  };
  const parsed = assemblySchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  const defaultBase = assemblySchema.safeParse({
    ...candidate,
    base: { ...DEFAULT_ASSEMBLY_STRUCTURE.base },
  });
  return defaultBase.success ? defaultBase.data : assemblyDefaults();
}

export const assemblyDescriptor: ItemTypeDescriptor<AssemblyStructure> = {
  kind: 'assembly',
  schema: assemblySchema,
  defaults: assemblyDefaults,
  migrate: (raw: unknown, _envelope: ItemEnvelope) => migrateAssembly(raw),
  labelKey: 'binDesigner.itemKind.assembly',
  descriptionKey: 'binDesigner.itemKind.assembly.description',
  exportFileName: (envelope) => `workshop_${envelope.width}x${envelope.depth}`,
};
