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

const MAX_ASSEMBLY_PARTS = 256;
const MAX_ASSEMBLY_DEPTH = 8;
const MAX_PATH_POINTS = 2000;
const MAX_OUTLINE_POINTS = 5000;

const PART_TYPES = new Set(['post', 'fin', 'block', 'tube', 'cradle', 'hook', 'arch', 'cutter']);

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
        num(params.leanDeg, 0, 45)
      );
    case 'block':
      return (
        num(params.width, 2, 400) &&
        num(params.depth, 2, 400) &&
        num(params.height, 1, 200) &&
        num(params.wedgeAngleDeg, 0, 60)
      );
    case 'tube':
      return (
        num(params.boreDiameter, 2, 80) &&
        num(params.wall, 0.8, 10) &&
        num(params.height, 4, 200) &&
        num(params.tiltDeg, 0, 30)
      );
    case 'cradle':
      return (
        num(params.length, 4, 400) &&
        num(params.width, 4, 100) &&
        num(params.height, 4, 100) &&
        (params.grooveStyle === 'round' || params.grooveStyle === 'vee') &&
        num(params.grooveWidth, 2, 80) &&
        num(params.grooveDepth, 1, 60)
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
    if (!validParams(node.type, node.params)) return fail(`invalid ${node.type} params`);
    if (!Array.isArray(node.children)) return fail('part children must be an array');
    for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
  }
  return { valid: true };
}
