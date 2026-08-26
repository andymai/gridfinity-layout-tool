/**
 * Server-side validation for Workshop assembly designs — a hand-written
 * mirror of the client's zod schema in src/shared/items/assembly/descriptor.ts
 * (api/ cannot import from src/; keep the two in sync). The server is the
 * final authority: anything out of range here 400s regardless of client.
 */
import {
  isNumber,
  inRange,
  isString,
  isBoolean,
  isObject,
  validationError,
} from './validationUtils.js';
import { validateFeatureColors } from './designerValidation.js';
import { checkText } from './contentFilter.js';

export const MAX_ASSEMBLY_PARTS = 256;
export const MAX_ASSEMBLY_DEPTH = 8;
const MAX_PATH_POINTS = 2000;
const MAX_OUTLINE_POINTS = 5000;

export const PART_TYPES = new Set([
  'post',
  'fin',
  'block',
  'tube',
  'cradle',
  'hook',
  'arch',
  'comb',
  'riser',
  'boreBank',
  'cutter',
]);

export type AssemblyValidationResult =
  { valid: true } | { valid: false; error: { code: 'INVALID_PARAMS'; message: string } };

const fail = (message: string): AssemblyValidationResult =>
  validationError('INVALID_PARAMS', message);

function num(v: unknown, min: number, max: number): boolean {
  return isNumber(v) && inRange(v, min, max);
}

function validTransform(t: unknown): boolean {
  return (
    isObject(t) &&
    num(t.x, -1000, 1000) &&
    num(t.y, -1000, 1000) &&
    num(t.seatZ, -200, 200) &&
    num(t.rotZDeg, -360, 360)
  );
}

function validArray(a: unknown): boolean {
  return (
    isObject(a) &&
    isNumber(a.count) &&
    Number.isInteger(a.count) &&
    inRange(a.count, 2, 64) &&
    num(a.dx, -500, 500) &&
    num(a.dy, -500, 500)
  );
}

function validPoint(p: unknown, bound: number): boolean {
  return isObject(p) && num(p.x, -bound, bound) && num(p.y, -bound, bound);
}

function validHandle(h: unknown): boolean {
  if (h === null) return true;
  return isObject(h) && num(h.dx, -2000, 2000) && num(h.dy, -2000, 2000);
}

function validProfile(profile: unknown): boolean {
  if (!isObject(profile)) return false;
  switch (profile.shape) {
    case 'circle':
      return num(profile.diameter, 0.5, 200);
    case 'rectangle':
      return (
        num(profile.width, 0.5, 400) &&
        num(profile.depth, 0.5, 400) &&
        num(profile.cornerRadius, 0, 50)
      );
    case 'polygon':
      return (
        num(profile.diameter, 0.5, 200) &&
        isNumber(profile.sides) &&
        Number.isInteger(profile.sides) &&
        inRange(profile.sides, 3, 12)
      );
    case 'slot':
      return num(profile.length, 1, 400) && num(profile.width, 0.5, 200);
    case 'path': {
      const points = profile.points;
      if (!Array.isArray(points) || points.length < 2 || points.length > MAX_PATH_POINTS) {
        return false;
      }
      return points.every(
        (p) =>
          validPoint(p, 2000) &&
          isObject(p) &&
          validHandle(p.handleIn) &&
          validHandle(p.handleOut) &&
          isBoolean(p.symmetric)
      );
    }
    case 'outline': {
      const points = profile.points;
      if (!Array.isArray(points) || points.length < 3 || points.length > MAX_OUTLINE_POINTS) {
        return false;
      }
      return points.every((p) => validPoint(p, 2000));
    }
    default:
      return false;
  }
}

function validParams(type: string, params: unknown): boolean {
  if (!isObject(params)) return false;
  switch (type) {
    case 'post':
      return (
        num(params.diameter, 2, 60) &&
        num(params.height, 4, 200) &&
        num(params.taperDeg, 0, 15) &&
        num(params.tipChamfer, 0, 5)
      );
    case 'fin':
      return (
        num(params.length, 4, 400) &&
        num(params.thickness, 0.8, 20) &&
        num(params.height, 4, 200) &&
        num(params.leanDeg, 0, 45) &&
        (params.leanAxis === undefined ||
          params.leanAxis === 'thickness' ||
          params.leanAxis === 'length')
      );
    case 'block':
      return (
        num(params.width, 2, 400) &&
        num(params.depth, 2, 400) &&
        num(params.height, 1, 200) &&
        num(params.wedgeAngleDeg, 0, 60) &&
        (params.tiltDeg === undefined || num(params.tiltDeg, 0, 20))
      );
    case 'tube':
      return (
        num(params.boreDiameter, 2, 80) &&
        num(params.wall, 0.8, 10) &&
        num(params.height, 4, 200) &&
        num(params.tiltDeg, 0, 30) &&
        (params.counterboreDiameter === undefined || num(params.counterboreDiameter, 0, 90)) &&
        (params.counterboreDepth === undefined || num(params.counterboreDepth, 0, 40)) &&
        (params.boreTaperDeg === undefined || num(params.boreTaperDeg, 0, 10))
      );
    case 'cradle':
      return (
        num(params.length, 4, 400) &&
        num(params.width, 4, 100) &&
        num(params.height, 4, 100) &&
        (params.grooveStyle === 'round' || params.grooveStyle === 'vee') &&
        num(params.grooveWidth, 2, 80) &&
        num(params.grooveDepth, 1, 60) &&
        (params.tiltDeg === undefined || num(params.tiltDeg, 0, 20))
      );
    case 'hook':
      return (
        num(params.stemHeight, 4, 200) &&
        num(params.reach, 4, 100) &&
        num(params.lipHeight, 0, 60) &&
        num(params.thickness, 0.8, 20) &&
        num(params.width, 2, 100)
      );
    case 'arch':
      return (
        num(params.span, 8, 400) &&
        num(params.height, 8, 200) &&
        (params.style === 'rod' || params.style === 'bridge') &&
        num(params.rodDiameter, 2, 40) &&
        num(params.bridgeWidth, 2, 60) &&
        num(params.uprightThickness, 2, 30) &&
        num(params.depth, 4, 60)
      );
    case 'comb':
      return (
        num(params.width, 10, 300) &&
        num(params.depth, 4, 80) &&
        num(params.height, 5, 120) &&
        num(params.slotCount, 1, 15) &&
        Number.isInteger(params.slotCount) &&
        num(params.slotWidth, 1, 60) &&
        num(params.slotDepth, 1, 110)
      );
    case 'riser':
      return (
        num(params.width, 10, 300) &&
        num(params.stepCount, 2, 6) &&
        Number.isInteger(params.stepCount) &&
        num(params.stepDepth, 5, 80) &&
        num(params.stepHeight, 2, 60)
      );
    case 'boreBank':
      return (
        num(params.width, 10, 300) &&
        num(params.depth, 8, 120) &&
        num(params.height, 8, 120) &&
        num(params.boreDiameter, 2, 40) &&
        num(params.boreDepth, 3, 110) &&
        num(params.columns, 1, 15) &&
        Number.isInteger(params.columns) &&
        num(params.rows, 1, 6) &&
        Number.isInteger(params.rows) &&
        num(params.angleDeg, 0, 30)
      );
    case 'cutter':
      return (
        validProfile(params.profile) &&
        num(params.depth, 0.5, 200) &&
        num(params.clearance, 0, 5) &&
        num(params.chamfer, 0, 5)
      );
    default:
      return false;
  }
}

export function validateAssemblyEnvelope(envelope: unknown): AssemblyValidationResult {
  if (!isObject(envelope)) return fail('envelope must be an object');
  if (!num(envelope.width, 0.5, 24) || !num(envelope.depth, 0.5, 24)) {
    return fail('envelope footprint out of range');
  }
  if (!num(envelope.gridUnitMm, 10, 100) || !num(envelope.heightUnitMm, 1, 20)) {
    return fail('envelope units out of range');
  }
  const attachment = envelope.attachment;
  if (!isObject(attachment)) return fail('envelope.attachment must be an object');
  if (
    !isBoolean(attachment.magnetHoles) ||
    !isBoolean(attachment.screwHoles) ||
    !num(attachment.magnetDiameter, 1, 20) ||
    !num(attachment.magnetDepth, 0.5, 10) ||
    !num(attachment.screwDiameter, 1, 10)
  ) {
    return fail('envelope.attachment out of range');
  }
  const featureColorsError = validateFeatureColors(envelope.featureColors);
  if (featureColorsError) return fail(featureColorsError);
  return { valid: true };
}

export function validateAssemblyStructure(structure: unknown): AssemblyValidationResult {
  if (!isObject(structure)) return fail('structure must be an object');
  if (structure.kind !== 'assembly') return fail('structure.kind must be assembly');
  if (structure.schemaVersion !== 1) return fail('unsupported assembly schemaVersion');
  const base = structure.base;
  if (!isObject(base) || !num(base.floorThickness, 1, 10)) {
    return fail('base.floorThickness out of range');
  }
  if (base.cornerRadius !== undefined && !num(base.cornerRadius, 0, 20)) {
    return fail('base.cornerRadius out of range');
  }
  if (base.wedge !== undefined) {
    if (!isObject(base.wedge) || !num(base.wedge.angleDeg, 0, 20)) {
      return fail('base.wedge out of range');
    }
    const lowEdge = base.wedge.lowEdge;
    if (lowEdge !== 'front' && lowEdge !== 'back' && lowEdge !== 'left' && lowEdge !== 'right') {
      return fail('base.wedge.lowEdge invalid');
    }
  }
  if (structure.mirrorAxis !== 'x' && structure.mirrorAxis !== 'y') {
    return fail('mirrorAxis must be x or y');
  }
  if (!Array.isArray(structure.parts)) return fail('parts must be an array');

  let count = 0;
  const stack: Array<{ node: unknown; depth: number }> = (structure.parts as unknown[]).map(
    (node) => ({ node, depth: 1 })
  );
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    const { node, depth } = item;
    count += 1;
    if (count > MAX_ASSEMBLY_PARTS) return fail(`more than ${MAX_ASSEMBLY_PARTS} parts`);
    if (depth > MAX_ASSEMBLY_DEPTH) return fail(`parts nested deeper than ${MAX_ASSEMBLY_DEPTH}`);
    if (!isObject(node)) return fail('part must be an object');
    if (!isString(node.id) || node.id.length === 0 || node.id.length > 64) {
      return fail('part id out of range');
    }
    if (!isString(node.type) || !PART_TYPES.has(node.type)) return fail('unknown part type');
    if (!validTransform(node.transform)) return fail('part transform out of range');
    if (node.array !== undefined && !validArray(node.array)) return fail('part array out of range');
    if (node.mirror !== undefined && !isBoolean(node.mirror)) return fail('part mirror invalid');
    if (node.label !== undefined && !validLabel(node.label)) return fail('part label invalid');
    if (!validParams(node.type, node.params)) return fail(`invalid ${node.type} params`);
    if (!Array.isArray(node.children)) return fail('part children must be an array');
    for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
  }
  return { valid: true };
}

const LABEL_FACES = new Set(['front', 'back', 'left', 'right', 'top']);

function validLabel(label: unknown): boolean {
  if (!isObject(label)) return false;
  if (!isString(label.text) || label.text.length === 0 || label.text.length > 40) return false;
  if (!checkText(label.text).passed) return false;
  return (
    num(label.sizeMm, 3, 24) &&
    num(label.depthMm, 0.4, 3) &&
    (label.style === 'raised' || label.style === 'recessed') &&
    isString(label.face) &&
    LABEL_FACES.has(label.face)
  );
}

/** Socket stack height above Z=0, mirroring GRIDFINITY_SPEC.SOCKET_HEIGHT. */
const SOCKET_HEIGHT_MM = 5;

const PART_PARAM_KEYS: Record<string, readonly string[]> = {
  post: ['diameter', 'height', 'taperDeg', 'tipChamfer'],
  fin: ['length', 'thickness', 'height', 'leanDeg', 'leanAxis'],
  block: ['width', 'depth', 'height', 'wedgeAngleDeg', 'tiltDeg'],
  tube: [
    'boreDiameter',
    'wall',
    'height',
    'tiltDeg',
    'counterboreDiameter',
    'counterboreDepth',
    'boreTaperDeg',
  ],
  cradle: ['length', 'width', 'height', 'grooveStyle', 'grooveWidth', 'grooveDepth', 'tiltDeg'],
  hook: ['stemHeight', 'reach', 'lipHeight', 'thickness', 'width'],
  arch: ['span', 'height', 'style', 'rodDiameter', 'bridgeWidth', 'uprightThickness', 'depth'],
  comb: ['width', 'depth', 'height', 'slotCount', 'slotWidth', 'slotDepth'],
  riser: ['width', 'stepCount', 'stepDepth', 'stepHeight'],
  boreBank: [
    'width',
    'depth',
    'height',
    'boreDiameter',
    'boreDepth',
    'columns',
    'rows',
    'angleDeg',
  ],
  cutter: ['profile', 'depth', 'clearance', 'chamfer'],
};

function sanitizePoint(p: Record<string, unknown>): Record<string, unknown> {
  return { x: p.x, y: p.y };
}

function sanitizeHandle(h: unknown): unknown {
  if (h === null || !isObject(h)) return null;
  return { dx: h.dx, dy: h.dy };
}

function sanitizeProfile(profile: Record<string, unknown>): Record<string, unknown> {
  switch (profile.shape) {
    case 'circle':
      return { shape: 'circle', diameter: profile.diameter };
    case 'rectangle':
      return {
        shape: 'rectangle',
        width: profile.width,
        depth: profile.depth,
        cornerRadius: profile.cornerRadius,
      };
    case 'polygon':
      return { shape: 'polygon', diameter: profile.diameter, sides: profile.sides };
    case 'slot':
      return { shape: 'slot', length: profile.length, width: profile.width };
    case 'path':
      return {
        shape: 'path',
        points: (profile.points as Record<string, unknown>[]).map((point) => ({
          ...sanitizePoint(point),
          handleIn: sanitizeHandle(point.handleIn),
          handleOut: sanitizeHandle(point.handleOut),
          symmetric: point.symmetric,
        })),
      };
    default:
      return {
        shape: 'outline',
        points: (profile.points as Record<string, unknown>[]).map(sanitizePoint),
      };
  }
}

function sanitizePartParams(
  type: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PART_PARAM_KEYS[type] ?? []) {
    const value = params[key];
    if (value === undefined) continue;
    out[key] = key === 'profile' ? sanitizeProfile(value as Record<string, unknown>) : value;
  }
  return out;
}

/** Part-top height above its own seat; mirrors the client's partSeatHeight. */
function seatHeightMm(type: string, params: Record<string, unknown>): number {
  if (type === 'cutter') return 0;
  if (type === 'hook') {
    const stem = params.stemHeight as number;
    return Math.max(stem, stem - (params.thickness as number) + (params.lipHeight as number));
  }
  if (type === 'riser') {
    return (params.stepCount as number) * (params.stepHeight as number);
  }
  return (params.height as number) ?? 0;
}

export interface SanitizedAssembly {
  envelope: Record<string, unknown>;
  structure: Record<string, unknown>;
  /** Server-derived standing height in mm, socket and floor included. */
  riseMm: number;
}

/**
 * Project a VALIDATED assembly onto its known shape, dropping every unknown
 * key, restricting part ids to a machine-safe charset, and deriving the
 * standing height from the part tree — so nothing the validators did not
 * range-check can reach a public record, and no client-supplied height can
 * game bed-fit or SEO facts. Call only after `validateAssemblyEnvelope` and
 * `validateAssemblyStructure` have both passed.
 */
export function sanitizeAssemblyContent(
  envelopeRaw: unknown,
  structureRaw: unknown
): SanitizedAssembly {
  const envelopeIn = envelopeRaw as Record<string, unknown>;
  const attachmentIn = envelopeIn.attachment as Record<string, unknown>;
  const envelope: Record<string, unknown> = {
    width: envelopeIn.width,
    depth: envelopeIn.depth,
    gridUnitMm: envelopeIn.gridUnitMm,
    heightUnitMm: envelopeIn.heightUnitMm,
    attachment: {
      magnetHoles: attachmentIn.magnetHoles,
      magnetDiameter: attachmentIn.magnetDiameter,
      magnetDepth: attachmentIn.magnetDepth,
      screwHoles: attachmentIn.screwHoles,
      screwDiameter: attachmentIn.screwDiameter,
    },
    // Strictly validated by validateFeatureColors (unknown keys rejected).
    featureColors: envelopeIn.featureColors,
  };

  const structureIn = structureRaw as Record<string, unknown>;
  const baseIn = structureIn.base as Record<string, unknown>;
  const wedgeIn = baseIn.wedge as Record<string, unknown> | undefined;
  let maxTop = 0;

  const sanitizeNode = (
    nodeRaw: Record<string, unknown>,
    parentTop: number
  ): Record<string, unknown> => {
    const type = nodeRaw.type as string;
    const transformIn = nodeRaw.transform as Record<string, unknown>;
    const params = nodeRaw.params as Record<string, unknown>;
    const top = parentTop + (transformIn.seatZ as number) + seatHeightMm(type, params);
    if (type !== 'cutter' && top > maxTop) maxTop = top;
    const arrayIn = nodeRaw.array as Record<string, unknown> | undefined;
    return {
      id: (nodeRaw.id as string).replace(/[^A-Za-z0-9_-]/g, '_'),
      type,
      params: sanitizePartParams(type, params),
      transform: {
        x: transformIn.x,
        y: transformIn.y,
        seatZ: transformIn.seatZ,
        rotZDeg: transformIn.rotZDeg,
      },
      ...(arrayIn !== undefined
        ? { array: { count: arrayIn.count, dx: arrayIn.dx, dy: arrayIn.dy } }
        : {}),
      ...(nodeRaw.mirror !== undefined ? { mirror: nodeRaw.mirror } : {}),
      ...(isObject(nodeRaw.label)
        ? {
            label: {
              text: nodeRaw.label.text,
              sizeMm: nodeRaw.label.sizeMm,
              depthMm: nodeRaw.label.depthMm,
              style: nodeRaw.label.style,
              face: nodeRaw.label.face,
            },
          }
        : {}),
      children: (nodeRaw.children as Record<string, unknown>[]).map((child) =>
        sanitizeNode(child, top)
      ),
    };
  };

  const structure: Record<string, unknown> = {
    kind: 'assembly',
    schemaVersion: 1,
    base: {
      floorThickness: baseIn.floorThickness,
      ...(baseIn.cornerRadius !== undefined ? { cornerRadius: baseIn.cornerRadius } : {}),
      ...(wedgeIn !== undefined && (wedgeIn.angleDeg as number) > 0
        ? { wedge: { angleDeg: wedgeIn.angleDeg, lowEdge: wedgeIn.lowEdge } }
        : {}),
    },
    mirrorAxis: structureIn.mirrorAxis,
    parts: (structureIn.parts as Record<string, unknown>[]).map((node) => sanitizeNode(node, 0)),
  };

  const flatRise = maxTop + SOCKET_HEIGHT_MM + (baseIn.floorThickness as number);
  let riseMm = flatRise;
  if (wedgeIn !== undefined && (wedgeIn.angleDeg as number) > 0) {
    // The wedge hinges at the low bottom edge: the high edge lifts by the
    // tilted extent while the tallest part leans with the surface.
    const rad = ((wedgeIn.angleDeg as number) * Math.PI) / 180;
    const along =
      wedgeIn.lowEdge === 'front' || wedgeIn.lowEdge === 'back'
        ? (envelopeIn.depth as number) * (envelopeIn.gridUnitMm as number)
        : (envelopeIn.width as number) * (envelopeIn.gridUnitMm as number);
    riseMm =
      SOCKET_HEIGHT_MM + (flatRise - SOCKET_HEIGHT_MM) * Math.cos(rad) + along * Math.sin(rad);
  }
  return { envelope, structure, riseMm };
}
