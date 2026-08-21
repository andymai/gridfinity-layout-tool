import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DividerMiniDiagram,
  DividerPlanDiagram,
  LeanSpecimen,
  TeaserDiagram,
} from './DividerDiagrams';
import type { TiltRow } from './useDividerTiltSubsection';
import type { CompartmentConfig } from '@/features/bin-designer/types';

const twoAcross: CompartmentConfig = { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] };
const threeAcross: CompartmentConfig = { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] };

const makeRow = (overrides: Partial<TiltRow> = {}): TiltRow => ({
  compartmentA: 0,
  compartmentB: 1,
  axis: 'vertical',
  offsetStart: 0,
  offsetEnd: 0,
  rakeDeg: 0,
  key: '0-1',
  numberA: 1,
  numberB: 2,
  hasTilt: false,
  geometry: null,
  angleDeg: 0,
  shiftMm: 0,
  leanDeg: 0,
  ...overrides,
});

const shadedRects = (container: HTMLElement): SVGRectElement[] =>
  [...container.querySelectorAll('rect')].filter((r) =>
    (r.getAttribute('class') ?? '').includes('fill-accent/15')
  );

describe('TeaserDiagram', () => {
  it('shows a straight ghost wall and a tilted accent wall', () => {
    const { container } = render(<TeaserDiagram />);
    const lines = [...container.querySelectorAll('line')];
    expect(lines).toHaveLength(2);
    const [ghost, tilted] = lines;
    expect(ghost.getAttribute('stroke-dasharray')).not.toBeNull();
    expect(ghost.getAttribute('x1')).toBe(ghost.getAttribute('x2'));
    expect(tilted.getAttribute('x1')).not.toBe(tilted.getAttribute('x2'));
  });
});

describe('DividerMiniDiagram', () => {
  it('shades the two compartments the divider separates', () => {
    const { container } = render(<DividerMiniDiagram compartments={twoAcross} row={makeRow()} />);
    expect(shadedRects(container)).toHaveLength(2);
  });

  it('draws the boundary straight at rest and skewed when tilted', () => {
    const straight = render(<DividerMiniDiagram compartments={twoAcross} row={makeRow()} />);
    const straightLine = straight.container.querySelector('line');
    expect(straightLine?.getAttribute('x1')).toBe(straightLine?.getAttribute('x2'));

    const tilted = render(
      <DividerMiniDiagram
        compartments={twoAcross}
        row={makeRow({ hasTilt: true, angleDeg: 30, offsetStart: -5, offsetEnd: 5 })}
      />
    );
    const tiltedLine = tilted.container.querySelector('line');
    expect(tiltedLine?.getAttribute('x1')).not.toBe(tiltedLine?.getAttribute('x2'));
  });
});

describe('DividerPlanDiagram', () => {
  it('outlines every compartment and shades only the affected pair', () => {
    const { container } = render(
      <DividerPlanDiagram
        compartments={threeAcross}
        row={makeRow()}
        offsets={{ offsetStart: 0, offsetEnd: 0, rakeDeg: 0 }}
        interiorW={80}
        interiorD={40}
        dividerHeightMm={20}
      />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(3);
    expect(shadedRects(container)).toHaveLength(2);
  });

  it('displaces the wall by the endpoint offsets as a fraction of the interior', () => {
    const { container } = render(
      <DividerPlanDiagram
        compartments={twoAcross}
        row={makeRow()}
        offsets={{ offsetStart: -8, offsetEnd: 8, rakeDeg: 0 }}
        interiorW={80}
        interiorD={40}
        dividerHeightMm={20}
      />
    );
    const line = container.querySelector('line');
    // Wall sits at x=50; ±8mm of an 80mm interior is ±10 viewBox units.
    expect(Number(line?.getAttribute('x1'))).toBeCloseTo(40);
    expect(Number(line?.getAttribute('x2'))).toBeCloseTo(60);
  });

  it('adds the dashed foot line and swept band only when leaning', () => {
    const upright = render(
      <DividerPlanDiagram
        compartments={twoAcross}
        row={makeRow()}
        offsets={{ offsetStart: 0, offsetEnd: 0, rakeDeg: 0 }}
        interiorW={80}
        interiorD={40}
        dividerHeightMm={20}
      />
    );
    expect(upright.container.querySelectorAll('line')).toHaveLength(1);
    expect(upright.container.querySelector('polygon')).toBeNull();

    const leaning = render(
      <DividerPlanDiagram
        compartments={twoAcross}
        row={makeRow({ rakeDeg: 45 })}
        offsets={{ offsetStart: 0, offsetEnd: 0, rakeDeg: 45 }}
        interiorW={80}
        interiorD={40}
        dividerHeightMm={10}
      />
    );
    expect(leaning.container.querySelectorAll('line')).toHaveLength(2);
    expect(leaning.container.querySelector('polygon')).not.toBeNull();
  });
});

describe('LeanSpecimen', () => {
  it('stands the wall upright at zero and walks the foot out with the lean', () => {
    const upright = render(<LeanSpecimen leanDeg={0} />);
    const uprightLine = upright.container.querySelector('line');
    expect(uprightLine?.getAttribute('x1')).toBe(uprightLine?.getAttribute('x2'));

    const leaning = render(<LeanSpecimen leanDeg={30} />);
    const leaningLine = leaning.container.querySelector('line');
    expect(Number(leaningLine?.getAttribute('x2'))).toBeGreaterThan(
      Number(leaningLine?.getAttribute('x1'))
    );
  });
});
