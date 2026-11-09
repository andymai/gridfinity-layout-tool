import { describe, it, expect } from 'vitest';
import {
  DIVIDER_SEAM_SHIFT_ALLOWANCE_MM,
  dividerJointClearance,
  dividerJointReach,
  dividerJointSpan,
  partLengthBudget,
  planDividerSeams,
  seamKeepOut,
} from './dividerSeamPlan';
import type { PieceObstruction } from './dividerPiecePatterns';

const CL = dividerJointClearance();

function jointClears(seam: number, obstructions: readonly PieceObstruction[], cl = CL): boolean {
  const { behind, ahead } = dividerJointSpan(cl);
  return obstructions.every(
    (o) => seam + ahead <= o.offset - o.width / 2 || seam - behind >= o.offset + o.width / 2
  );
}

function columns(pitch: number, width: number, length: number): PieceObstruction[] {
  const out: PieceObstruction[] = [];
  for (let u = -length / 2 + pitch; u < length / 2; u += pitch) out.push({ offset: u, width });
  return out;
}

describe('partLengthBudget', () => {
  const bed = { widthMm: 200, depthMm: 100 };

  it('lays a short divider along the long side', () => {
    expect(partLengthBudget(30, bed)).toBe(200);
  });

  it('turns a divider taller than the short side along it', () => {
    expect(partLengthBudget(150, bed)).toBe(100);
  });

  it('gives no budget when the divider is taller than both sides', () => {
    expect(partLengthBudget(250, bed)).toBeNull();
  });
});

describe('planDividerSeams', () => {
  it('leaves a piece that fits alone', () => {
    expect(planDividerSeams(160, 200, [], CL)).toEqual([]);
  });

  it('gives up when the bed is shorter than one jointed part', () => {
    expect(planDividerSeams(100, 5, [], CL)).toEqual([]);
  });

  it('cuts into equal parts that fit even after the largest allowed shift', () => {
    const seams = planDividerSeams(400, 220, [], CL);
    const edges = [-200, ...seams, 200];
    const shift = DIVIDER_SEAM_SHIFT_ALLOWANCE_MM / 2;
    const spans = edges.slice(1).map((e, i) => e - edges[i]);
    for (const s of spans) {
      expect(s + 2 * shift + dividerJointReach(CL)).toBeLessThanOrEqual(220);
    }
    expect(new Set(spans.map((s) => s.toFixed(6))).size).toBe(1);
  });

  it('moves a seam off a notch to where the whole joint clears it', () => {
    const notch = [{ offset: 0, width: 2 }];
    const [seam] = planDividerSeams(300, 200, notch, CL);
    expect(seam).not.toBe(0);
    expect(jointClears(seam, notch)).toBe(true);
    expect(Math.abs(seam)).toBeLessThanOrEqual(DIVIDER_SEAM_SHIFT_ALLOWANCE_MM / 2);
  });

  it('fits the joint between notches at the minimum 10mm slot pitch', () => {
    for (const nozzle of [0.4, 0.6, 0.8]) {
      const cl = dividerJointClearance(nozzle);
      const notches = columns(10, 2, 290);
      const seams = planDividerSeams(290, 200, notches, cl);
      expect(seams).toHaveLength(1);
      expect(jointClears(seams[0], notches, cl)).toBe(true);
    }
  });

  it('takes the most open spot when no spot clears every obstruction', () => {
    const dense = columns(4, 2, 300);
    const [seam] = planDividerSeams(300, 200, dense, CL);
    expect(jointClears(seam, dense)).toBe(false);
    expect(Math.abs(seam)).toBeLessThanOrEqual(DIVIDER_SEAM_SHIFT_ALLOWANCE_MM / 2);
  });
});

describe('seamKeepOut', () => {
  it('covers the whole joint around the seam', () => {
    const { behind, ahead } = dividerJointSpan(CL);
    const k = seamKeepOut(12, CL);
    expect(k.offset - k.width / 2).toBeCloseTo(12 - behind, 9);
    expect(k.offset + k.width / 2).toBeCloseTo(12 + ahead, 9);
  });
});
