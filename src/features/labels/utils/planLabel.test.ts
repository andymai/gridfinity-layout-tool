import { beforeAll, describe, expect, it } from 'vitest';
import { loadTestTypeMeasurer } from '@/test/testTypeMeasurer';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import {
  FIT_MAX_LENGTH_MM,
  LABEL_DETAIL_FONT,
  LABEL_NAME_FONT,
  labelPaths,
  planLabel,
} from './planLabel';
import type { LabelPlan } from './planLabel';

let measurer: TypeMeasurer;

beforeAll(async () => {
  measurer = await loadTestTypeMeasurer([LABEL_NAME_FONT, LABEL_DETAIL_FONT]);
});

const DESCRIPTION = 'Black-Oxide Alloy Steel Socket Head Screw, M3 x 0.5 mm Thread, 8 mm Long';

function expectInkInside(plan: LabelPlan): void {
  for (const block of plan.blocks) {
    expect(block.plan.minX).toBeGreaterThanOrEqual(-plan.widthMm / 2);
    expect(block.plan.maxX).toBeLessThanOrEqual(plan.widthMm / 2);
    expect(block.y + block.plan.minY).toBeGreaterThanOrEqual(-plan.heightMm / 2);
    expect(block.y + block.plan.maxY).toBeLessThanOrEqual(plan.heightMm / 2);
  }
}

describe('planLabel', () => {
  it('grows a fit-to-text tape label with its text', () => {
    const box = { heightMm: 9, lengthMm: null };
    const short = planLabel({ name: 'M3', detail: '' }, box, measurer);
    const long = planLabel({ name: 'M3 socket head screws', detail: '' }, box, measurer);

    expect([short.problem, long.problem]).toEqual([null, null]);
    expect(long.widthMm).toBeGreaterThan(short.widthMm * 3);
    expect(long.widthMm).toBeLessThan(FIT_MAX_LENGTH_MM);
    expect(short.widthMm).toBeGreaterThanOrEqual(9);
    expectInkInside(short);
    expectInkInside(long);
  });

  it('puts the detail under the name in the monospaced face', () => {
    const plan = planLabel(
      { name: 'Socket head screw', detail: '91290A113' },
      { heightMm: 12, lengthMm: 40 },
      measurer
    );

    expect(plan.problem).toBeNull();
    expect(plan.widthMm).toBe(40);
    const [name, detail] = plan.blocks;
    expect(name.plan.font).toBe(LABEL_NAME_FONT);
    expect(detail.plan.font).toBe(LABEL_DETAIL_FONT);
    expect(name.y + name.plan.minY).toBeGreaterThan(detail.y + detail.plan.maxY);
    expect(detail.plan.fontSize).toBeLessThan(name.plan.fontSize);
    expectInkInside(plan);
  });

  it('wraps a long description onto more lines on a fixed length', () => {
    const plan = planLabel(
      { name: DESCRIPTION, detail: '91290A113' },
      { heightMm: 12, lengthMm: 78 },
      measurer
    );

    expect(plan.problem).toBeNull();
    expect(plan.blocks[0].plan.lines.length).toBeGreaterThan(1);
    expectInkInside(plan);
  });

  it('reports a label whose text cannot be set legibly', () => {
    const plan = planLabel(
      { name: DESCRIPTION, detail: '' },
      { heightMm: 6, lengthMm: 20 },
      measurer
    );

    expect(plan.problem).toBe('tooLong');
    expect(plan.blocks).toHaveLength(0);
  });

  it('reports a label with no name as empty', () => {
    const plan = planLabel(
      { name: '  ', detail: '91290A113' },
      { heightMm: 12, lengthMm: 40 },
      measurer
    );

    expect(plan.problem).toBe('empty');
    expect(plan.blocks).toHaveLength(0);
  });

  it('flags text the label faces have no glyphs for, and still previews it', () => {
    const plan = planLabel(
      { name: 'Гвинти M3', detail: '' },
      { heightMm: 9, lengthMm: null },
      measurer
    );

    expect(plan.problem).toBe('unsupportedText');
    expect(plan.blocks).toHaveLength(1);
  });

  it('puts the part number after the name on tape too narrow for two lines', () => {
    const plan = planLabel(
      { name: 'Socket head screw', detail: '91290A113' },
      { heightMm: (32 / 180) * 25.4, lengthMm: null },
      measurer
    );

    expect(plan.problem).toBeNull();
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].plan.lines.map((line) => line.text).join(' ')).toContain('91290A113');
    expectInkInside(plan);
  });

  it('gives glyph outlines for each block', () => {
    const plan = planLabel(
      { name: 'Nuts', detail: 'M3' },
      { heightMm: 9, lengthMm: null },
      measurer
    );
    const paths = labelPaths(plan, measurer);

    expect(paths).toHaveLength(2);
    for (const path of paths) expect(path.d).toMatch(/^M-?\d/);
  });
});
