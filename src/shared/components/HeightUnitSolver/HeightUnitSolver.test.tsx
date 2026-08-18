import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeightUnitSolver } from './HeightUnitSolver';
import { stackedTotalMm } from '@/shared/utils/heightUnits';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string, vars?: Record<string, unknown>): string =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

describe('HeightUnitSolver', () => {
  it('prompts for a measurement rather than guessing a ceiling', () => {
    render(<HeightUnitSolver heightUnitMm={7} ceilingMm={undefined} />);
    expect(screen.getByText('stackSolver.unmeasured')).toBeInTheDocument();
  });

  it('reports the tallest bin that fits at each stack depth', () => {
    render(<HeightUnitSolver heightUnitMm={7} ceilingMm={55} />);

    // 55mm at 7mm/unit: one 7u bin (53.3mm), two 3u (46.55mm), three 2u (46.75mm).
    expect(screen.getByText(/stackSolver\.rowFit.*"units":7/)).toBeInTheDocument();
    expect(screen.getByText(/stackSolver\.rowFit.*"units":3/)).toBeInTheDocument();
    expect(screen.getByText(/stackSolver\.rowFit.*"units":2/)).toBeInTheDocument();
  });

  it('never proposes a stack that overflows the ceiling', () => {
    render(<HeightUnitSolver heightUnitMm={7} ceilingMm={55} />);
    for (const node of screen.getAllByText(/stackSolver\.rowFit/)) {
      const vars = JSON.parse(node.textContent?.split('stackSolver.rowFit:')[1] ?? '{}') as {
        total: number;
      };
      expect(vars.total).toBeLessThanOrEqual(55);
    }
  });

  // The unit is the layout's, not something this component solves for: a
  // custom unit must change the answer without being rewritten.
  it('holds the height unit fixed and answers in whole units of it', () => {
    render(<HeightUnitSolver heightUnitMm={4.37} ceilingMm={55} />);
    const first = screen.getAllByText(/stackSolver\.rowFit/)[0];
    const vars = JSON.parse(first?.textContent?.split('stackSolver.rowFit:')[1] ?? '{}') as {
      units: number;
      total: number;
    };
    expect(Number.isInteger(vars.units)).toBe(true);
    expect(vars.total).toBeCloseTo(stackedTotalMm(vars.units, 4.37, 1), 2);
  });

  it('says so when nothing fits', () => {
    render(<HeightUnitSolver heightUnitMm={7} ceilingMm={8} />);
    expect(screen.getAllByText('stackSolver.rowNoFit').length).toBeGreaterThan(0);
  });
});
