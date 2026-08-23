/**
 * Constants-derived bounds: every numeric limit and enum in the shipped
 * schemas that claims to mirror a source constant must still equal it.
 *
 * Schema authors record provenance with an `x-constant` annotation next to the
 * bound, e.g. `{"maximum": 50, "x-constant": {"maximum": "CONSTRAINTS.GRID_MAX"}}`.
 * ajv treats the keyword as an inert annotation; this test is what gives it
 * meaning. Without it a constant could be retuned and leave a stale number in
 * both the schema and the constraints appendix generated from it.
 */

import { describe, expect, it } from 'vitest';
import {
  CONSTRAINTS,
  SCREWS_PER_PIECE_MAX,
  SCREWS_PER_PIECE_MIN,
  SCREW_COUNTERBORE_MAX_DEPTH_MM,
  SCREW_HEAD_MAX_DIAMETER_MM,
  SCREW_HEAD_MIN_DIAMETER_MM,
  SCREW_HOLE_MAX_DIAMETER_MM,
  SCREW_HOLE_MIN_DIAMETER_MM,
  SOLID_FLOOR_MAX_MM,
  SOLID_FLOOR_MIN_MM,
} from '@/core/constants';
import {
  STACK_PRINT_DEFAULT_COPIES,
  STACK_PRINT_DEFAULT_GAP_MM,
  STACK_PRINT_MAX_COPIES,
  STACK_PRINT_MAX_GAP_MM,
  STACK_PRINT_MIN_COPIES,
  STACK_PRINT_MIN_GAP_MM,
} from '@/core/types';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import {
  DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
  DETACHABLE_PIN_DIAMETERS_MM,
} from '@/features/bin-designer/types/base';
import {
  DEFAULT_CUTOUT_CLEARANCE,
  DEFAULT_POLYGON_SIDES,
  MAX_ARRAY_COUNT,
  MAX_CUTOUT_CHAMFER,
  MAX_CUTOUT_CLEARANCE,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
} from '@/features/bin-designer/types/cutout';
import {
  ACCENT_BAND_DEFAULT_MM,
  ACCENT_BAND_MIN_MM,
} from '@/features/bin-designer/types/featureColors';
import {
  LID_CLICK_RAIL_COVERAGE_MAX,
  LID_CLICK_RAIL_COVERAGE_MIN,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
  LID_TOP_THICKNESS_MIN_MM,
  MAX_LID_CUTOUTS,
} from '@/features/bin-designer/types/lid';
import {
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_MAX_DEPTH_U,
  KNIFE_REST_MAX_GAP_MM,
  KNIFE_REST_MAX_GROOVE_DEPTH_MM,
  KNIFE_REST_MIN_DEPTH_U,
  KNIFE_REST_MIN_GROOVE_DEPTH_MM,
} from '@/features/bin-designer/types/knifeBlock';
import { MIN_TEXT_DRAFT_DEG } from '@/features/bin-designer/types/text';
import { DEFAULT_PATTERN_SCALE } from '@/features/bin-designer/types/walls';
import { isRecord, loadSchemas, walkSubschemas } from './loadSchemas';

/**
 * Namespaces an `x-constant` path may name. A dotted path resolves into the
 * object; a bare name resolves to a top-level entry here.
 */
const SOURCES: Record<string, unknown> = {
  CONSTRAINTS,
  DESIGNER_CONSTRAINTS,
  ACCENT_BAND_DEFAULT_MM,
  ACCENT_BAND_MIN_MM,
  DEFAULT_CUTOUT_CLEARANCE,
  DEFAULT_DETACHABLE_PIN_DIAMETER_MM,
  DEFAULT_PATTERN_SCALE,
  DEFAULT_POLYGON_SIDES,
  DETACHABLE_PIN_DIAMETERS_MM,
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_MAX_DEPTH_U,
  KNIFE_REST_MAX_GAP_MM,
  KNIFE_REST_MAX_GROOVE_DEPTH_MM,
  KNIFE_REST_MIN_DEPTH_U,
  KNIFE_REST_MIN_GROOVE_DEPTH_MM,
  LID_CLICK_RAIL_COVERAGE_MAX,
  LID_CLICK_RAIL_COVERAGE_MIN,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
  LID_TOP_THICKNESS_MIN_MM,
  MAX_ARRAY_COUNT,
  MAX_CUTOUT_CHAMFER,
  MAX_CUTOUT_CLEARANCE,
  MAX_LID_CUTOUTS,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
  MIN_TEXT_DRAFT_DEG,
  SCREWS_PER_PIECE_MAX,
  SCREWS_PER_PIECE_MIN,
  SCREW_COUNTERBORE_MAX_DEPTH_MM,
  SCREW_HEAD_MAX_DIAMETER_MM,
  SCREW_HEAD_MIN_DIAMETER_MM,
  SCREW_HOLE_MAX_DIAMETER_MM,
  SCREW_HOLE_MIN_DIAMETER_MM,
  SOLID_FLOOR_MAX_MM,
  SOLID_FLOOR_MIN_MM,
  STACK_PRINT_DEFAULT_COPIES,
  STACK_PRINT_DEFAULT_GAP_MM,
  STACK_PRINT_MAX_COPIES,
  STACK_PRINT_MAX_GAP_MM,
  STACK_PRINT_MIN_COPIES,
  STACK_PRINT_MIN_GAP_MM,
};

const NOT_FOUND = Symbol('not-found');

function resolve(path: string): unknown {
  const [head, ...rest] = path.split('.');
  let current: unknown = SOURCES[head];
  if (current === undefined) return NOT_FOUND;
  for (const segment of rest) {
    if (!isRecord(current) || !(segment in current)) return NOT_FOUND;
    current = current[segment];
  }
  return current;
}

interface Annotation {
  readonly file: string;
  readonly pointer: string;
  readonly keyword: string;
  readonly path: string;
  readonly actual: unknown;
}

function collectAnnotations(): Annotation[] {
  const out: Annotation[] = [];
  for (const [file, doc] of Object.entries(loadSchemas())) {
    for (const { pointer, schema } of walkSubschemas(doc)) {
      const annotation = schema['x-constant'];
      if (!isRecord(annotation)) continue;
      for (const [keyword, path] of Object.entries(annotation)) {
        out.push({ file, pointer, keyword, path: String(path), actual: schema[keyword] });
      }
    }
  }
  return out;
}

const annotations = collectAnnotations();

/**
 * Ratchet floor on annotation coverage. Raise it when annotations are added;
 * a drop means someone deleted provenance rather than a bound legitimately
 * becoming hand-picked, which is the erosion this guards against.
 */
const MIN_ANNOTATED_BOUNDS = 184;

describe('x-constant annotations', () => {
  it('finds annotations to check', () => {
    expect(annotations.length).toBeGreaterThanOrEqual(MIN_ANNOTATED_BOUNDS);
  });

  it.each(annotations.map((a) => [`${a.file}${a.pointer}/${a.keyword} -> ${a.path}`, a] as const))(
    '%s',
    (_label, annotation) => {
      const expected = resolve(annotation.path);
      expect(
        expected,
        `x-constant names "${annotation.path}", which does not resolve. Add it to SOURCES in this test, or fix the path.`
      ).not.toBe(NOT_FOUND);
      expect(
        annotation.actual,
        `${annotation.file}${annotation.pointer} declares ${annotation.keyword} = ${JSON.stringify(annotation.actual)} but ${annotation.path} is ${JSON.stringify(expected)}`
      ).toEqual(expected);
    }
  );

  it('annotates only keywords the subschema actually sets', () => {
    const dangling = annotations.filter((a) => a.actual === undefined);
    expect(
      dangling.map((a) => `${a.file}${a.pointer}/${a.keyword}`),
      'x-constant names a keyword the subschema does not set'
    ).toEqual([]);
  });
});
