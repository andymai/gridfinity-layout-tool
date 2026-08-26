/**
 * Workshop assembly — descriptor (schema/defaults/migration/labels), the
 * worker- and UI-safe half of this item kind. No React, no OCCT.
 */
import { z } from 'zod';
import type { ItemTypeDescriptor } from '@/shared/items/registry';
import type { ItemEnvelope } from '@/shared/types/item';
import type {
  AssemblyBase,
  AssemblyPartNode,
  AssemblyPartParamsByType,
  AssemblyPartType,
  AssemblyStructure,
  CutterProfile,
  PartTransform,
} from '@/shared/types/assembly';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';
import { isRecord } from '@/shared/utils/isRecord';

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
  leanAxis: z.enum(['thickness', 'length']).optional(),
});

const blockParamsSchema = z.object({
  /** Presentation tilt about the part's X axis; the base stays buried. */
  tiltDeg: z.number().min(0).max(20).default(0),
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
  /** Collar recess so a tool's shoulder sits flat; 0 = off. */
  counterboreDiameter: z.number().min(0).max(90).default(0),
  counterboreDepth: z.number().min(0).max(40).default(0),
  /** Bore narrows toward the floor, gripping mixed shaft sizes. */
  boreTaperDeg: z.number().min(0).max(10).default(0),
});

const cradleParamsSchema = z.object({
  /** Presentation tilt about the part's X axis; the base stays buried. */
  tiltDeg: z.number().min(0).max(20).default(0),
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

const combParamsSchema = z.object({
  width: z.number().min(10).max(300),
  depth: z.number().min(4).max(80),
  height: z.number().min(5).max(120),
  slotCount: z.number().int().min(1).max(15),
  slotWidth: z.number().min(1).max(60),
  slotDepth: z.number().min(1).max(110),
});

const riserParamsSchema = z.object({
  width: z.number().min(10).max(300),
  stepCount: z.number().int().min(2).max(6),
  stepDepth: z.number().min(5).max(80),
  stepHeight: z.number().min(2).max(60),
});

const boreBankParamsSchema = z.object({
  width: z.number().min(10).max(300),
  depth: z.number().min(8).max(120),
  height: z.number().min(8).max(120),
  boreDiameter: z.number().min(2).max(40),
  boreDepth: z.number().min(3).max(110),
  columns: z.number().int().min(1).max(15),
  rows: z.number().int().min(1).max(6),
  angleDeg: z.number().min(0).max(30),
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

const labelSchema = z.object({
  text: z.string().min(1).max(40),
  sizeMm: z.number().min(3).max(24),
  depthMm: z.number().min(0.4).max(3),
  style: z.enum(['raised', 'recessed']),
  face: z.enum(['front', 'back', 'left', 'right', 'top']),
});

const nodeBase = {
  id: z.string().min(1).max(64),
  transform: transformSchema,
  array: arraySchema.optional(),
  mirror: z.boolean().optional(),
  label: labelSchema.optional(),
};

export const assemblyPartNodeSchema: z.ZodType<AssemblyPartNode> = z.lazy(() =>
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
      type: z.literal('comb'),
      params: combParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('riser'),
      params: riserParamsSchema,
      children: childrenSchema,
    }),
    z.object({
      ...nodeBase,
      type: z.literal('boreBank'),
      params: boreBankParamsSchema,
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

const childrenSchema = z.lazy(() => z.array(assemblyPartNodeSchema).max(MAX_ASSEMBLY_PARTS));

function countNodes(nodes: readonly AssemblyPartNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function treeDepth(nodes: readonly AssemblyPartNode[]): number {
  return nodes.length === 0 ? 0 : 1 + Math.max(...nodes.map((n) => treeDepth(n.children)));
}

const baseSchema = z.object({
  floorThickness: z.number().min(1).max(10),
  cornerRadius: z.number().min(0).max(20).optional(),
  /** Whole-build presentation wedge; the socket stays flat underneath. */
  wedge: z
    .object({
      angleDeg: z.number().min(0).max(20),
      lowEdge: z.enum(['front', 'back', 'left', 'right']),
    })
    .optional(),
});

export const assemblySchema: z.ZodType<AssemblyStructure> = z
  .object({
    kind: z.literal('assembly'),
    schemaVersion: z.literal(1),
    base: baseSchema,
    mirrorAxis: z.enum(['x', 'y']),
    parts: z.array(assemblyPartNodeSchema).max(MAX_ASSEMBLY_PARTS),
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
  block: { width: 40, depth: 20, height: 20, wedgeAngleDeg: 0, tiltDeg: 0 },
  tube: {
    boreDiameter: 16,
    wall: 2,
    height: 60,
    tiltDeg: 0,
    counterboreDiameter: 0,
    counterboreDepth: 0,
    boreTaperDeg: 0,
  },
  cradle: {
    tiltDeg: 0,
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
  comb: { width: 80, depth: 14, height: 35, slotCount: 4, slotWidth: 9, slotDepth: 25 },
  riser: { width: 60, stepCount: 3, stepDepth: 18, stepHeight: 14 },
  boreBank: {
    width: 70,
    depth: 30,
    height: 35,
    boreDiameter: 8,
    boreDepth: 28,
    columns: 5,
    rows: 2,
    angleDeg: 15,
  },
  cutter: { profile: { shape: 'circle', diameter: 6.5 }, depth: 20, clearance: 0.2, chamfer: 0.6 },
};

export const DEFAULT_PART_TRANSFORM: PartTransform = { x: 0, y: 0, seatZ: 0, rotZDeg: 0 };

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Clamp to the base schema's ranges (same rationale as `clampPartTransform`). */
export function clampAssemblyBase(base: AssemblyBase): AssemblyBase {
  return {
    floorThickness: clamp(base.floorThickness, 1, 10),
    ...(base.cornerRadius !== undefined ? { cornerRadius: clamp(base.cornerRadius, 0, 20) } : {}),
    ...(base.wedge !== undefined && base.wedge.angleDeg > 0
      ? { wedge: { angleDeg: clamp(base.wedge.angleDeg, 0, 20), lowEdge: base.wedge.lowEdge } }
      : {}),
  };
}

export function createAssemblyPartNode<K extends AssemblyPartType>(
  type: K,
  id: string,
  transform: PartTransform
): Extract<AssemblyPartNode, { type: K }> {
  // Correlated-union construction; the cast is sound because params come
  // from the same K-indexed map the node type is defined by.
  return {
    id,
    type,
    params: defaultPartParams(type),
    transform,
    children: [],
  } as unknown as Extract<AssemblyPartNode, { type: K }>;
}

/** Clamp to the transform schema's ranges, so edits can never produce a node migration would drop. */
export function clampPartTransform(t: PartTransform): PartTransform {
  return {
    x: clamp(t.x, -1000, 1000),
    y: clamp(t.y, -1000, 1000),
    seatZ: clamp(t.seatZ, -200, 200),
    rotZDeg: clamp(t.rotZDeg, -360, 360),
  };
}

/** Fresh, schema-valid starting profile for each cutter shape. */
export function defaultCutterProfile(shape: CutterProfile['shape']): CutterProfile {
  switch (shape) {
    case 'circle':
      return { shape: 'circle', diameter: 6.5 };
    case 'rectangle':
      return { shape: 'rectangle', width: 20, depth: 10, cornerRadius: 1 };
    case 'polygon':
      return { shape: 'polygon', diameter: 8, sides: 6 };
    case 'slot':
      return { shape: 'slot', length: 40, width: 3.5 };
    case 'path':
      return {
        shape: 'path',
        points: [
          { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
          { x: 20, y: 0, handleIn: null, handleOut: null, symmetric: false },
          { x: 10, y: 20, handleIn: null, handleOut: null, symmetric: false },
        ],
      };
    case 'outline':
      return {
        shape: 'outline',
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 10, y: 20 },
        ],
      };
  }
}

export function defaultPartParams<K extends AssemblyPartType>(
  type: K
): AssemblyPartParamsByType[K] {
  return structuredClone(DEFAULT_PART_PARAMS[type]);
}

function isAssemblyPartType(v: unknown): v is AssemblyPartType {
  return typeof v === 'string' && (ASSEMBLY_PART_TYPES as readonly string[]).includes(v);
}

/**
 * Salvage one node: fill gaps from defaults, validate each optional on its
 * own, recurse into children, and drop the node only when its own values
 * cannot be made valid. Keeping valid siblings and subtrees is the point —
 * one bad node must not cost a whole build.
 */
function normalizePartNode(raw: unknown, depth: number): AssemblyPartNode | null {
  if (depth > MAX_ASSEMBLY_DEPTH) return null;
  if (!isRecord(raw)) return null;
  if (!isAssemblyPartType(raw.type)) return null;
  const array = arraySchema.safeParse(raw.array);
  const candidate = {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : crypto.randomUUID(),
    type: raw.type,
    params: { ...defaultPartParams(raw.type), ...(isRecord(raw.params) ? raw.params : {}) },
    transform: { ...DEFAULT_PART_TRANSFORM, ...(isRecord(raw.transform) ? raw.transform : {}) },
    ...(array.success ? { array: array.data } : {}),
    ...(typeof raw.mirror === 'boolean' ? { mirror: raw.mirror } : {}),
    children: Array.isArray(raw.children)
      ? raw.children
          .slice(0, MAX_ASSEMBLY_PARTS)
          .map((child) => normalizePartNode(child, depth + 1))
          .filter((n): n is AssemblyPartNode => n !== null)
      : [],
  };
  const parsed = assemblyPartNodeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Trim an over-cap build instead of losing it: keep the first
 * `MAX_ASSEMBLY_PARTS` nodes in tree order and drop children below
 * `MAX_ASSEMBLY_DEPTH`, so the final parse cannot fail on the caps.
 */
function capParts(parts: AssemblyPartNode[]): AssemblyPartNode[] {
  let budget = MAX_ASSEMBLY_PARTS;
  const prune = (nodes: AssemblyPartNode[], depth: number): AssemblyPartNode[] => {
    const kept: AssemblyPartNode[] = [];
    for (const node of nodes) {
      if (budget === 0) break;
      budget -= 1;
      kept.push({
        ...node,
        children: depth < MAX_ASSEMBLY_DEPTH ? prune(node.children, depth + 1) : [],
      });
    }
    return kept;
  };
  return prune(parts, 1);
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
    parts: capParts(
      Array.isArray(obj.parts)
        ? obj.parts
            .slice(0, MAX_ASSEMBLY_PARTS)
            .map((part) => normalizePartNode(part, 1))
            .filter((n): n is AssemblyPartNode => n !== null)
        : []
    ),
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
