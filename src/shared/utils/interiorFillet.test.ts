import { describe, it, expect } from 'vitest';
import {
  defaultInteriorFilletMm,
  interiorFilletCornerMm,
  interiorFilletRadiusMm,
  interiorFilletRiseMm,
  narrowestCavitySpansMm,
} from './interiorFillet';

describe('interior fillet reach', () => {
  it('defaults to the shell corner, stepped down to the control step', () => {
    expect(defaultInteriorFilletMm(1.2)).toBe(2.5);
    expect(defaultInteriorFilletMm(0.8)).toBe(2.9);
    expect(defaultInteriorFilletMm(3.6)).toBe(0.5);
  });

  it('reads an absent or unusable radius as off', () => {
    expect(interiorFilletRadiusMm({})).toBe(0);
    expect(interiorFilletRadiusMm({ interiorFilletMm: Number.NaN })).toBe(0);
    expect(interiorFilletRiseMm({ interiorFilletMm: 4, compartments: {} })).toBe(4);
  });

  it('rises from the highest raised compartment floor', () => {
    const compartments = { floorRaises: [null, 6, 2] };
    expect(interiorFilletRiseMm({ interiorFilletMm: 3, compartments })).toBe(9);
    expect(interiorFilletRiseMm({ compartments })).toBe(0);
  });

  it('never reports a corner narrower than the shell already rounds', () => {
    expect(interiorFilletCornerMm({ interiorFilletMm: 1, wallThickness: 1.2 })).toBeCloseTo(
      2.55,
      6
    );
    expect(interiorFilletCornerMm({ interiorFilletMm: 6, wallThickness: 1.2 })).toBe(6);
    expect(interiorFilletCornerMm({ wallThickness: 1.2 })).toBe(0);
  });
});

describe('narrowestCavitySpansMm', () => {
  const base = {
    width: 2,
    depth: 2,
    height: 4,
    heightUnitMm: 7,
    gridUnitMm: 42,
    wallThickness: 1.2,
  };

  it('measures a merged L by its thinner arm, not its bounding box', () => {
    const spans = narrowestCavitySpansMm({
      ...base,
      compartments: { cols: 2, rows: 2, cells: [0, 0, 0, 1], thickness: 1.2 },
    });
    const cell = (84 - 0.5 - 2.4) / 2;
    expect(spans.get(0)).toBeCloseTo(cell - 0.6, 6);
  });

  it('narrows a compartment beside a shifted or leaning divider', () => {
    const cell = (84 - 0.5 - 2.4) / 2;
    const spans = narrowestCavitySpansMm({
      ...base,
      compartments: {
        cols: 2,
        rows: 1,
        cells: [0, 1],
        thickness: 1.2,
        dividerOverrides: [
          { compartmentA: 0, compartmentB: 1, offsetStart: -3, offsetEnd: 1, rakeDeg: 5 },
        ],
      },
    });
    const lean = Math.tan((5 * Math.PI) / 180) * 28;
    expect(spans.get(0)).toBeCloseTo(cell - 0.6 - 3 - lean, 6);
    expect(spans.get(1)).toBeCloseTo(cell - 0.6 - 3 - lean, 6);
  });

  it('measures a custom shape across its own mask cells', () => {
    const spans = narrowestCavitySpansMm({
      ...base,
      compartments: { cols: 1, rows: 1, cells: [0], thickness: 1.2 },
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
    });
    expect(spans.get(0)).toBeCloseTo(42 - 2.4 - 0.5, 6);
  });
});
