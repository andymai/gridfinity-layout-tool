import { describe, expect, it } from 'vitest';
import { binSizeForInput, printEstimateInput, splitPlanInput } from '@/agent/contract';
import { estimateStandardBin } from '@/features/bin-designer/domain';
import { runBinSizeFor, runPrintEstimate, runSplitPlan } from './calculators';

describe('split_plan', () => {
  it('prints a plate that fits in one piece, and splits one that does not', () => {
    const fits = runSplitPlan(
      splitPlanInput.parse({ grid: { width: 5, depth: 5 }, bed: { width: 25.6, unit: 'cm' } })
    );
    expect(fits.content).toContain('on a 256 x 256 mm bed');
    expect(fits.content).toContain('It prints in one piece.');
    const split = runSplitPlan(
      splitPlanInput.parse({
        grid: { width: 10, depth: 8 },
        bed: { width: 256, depth: 256, unit: 'mm' },
      })
    );
    expect(split.content).toContain(
      'It splits into 4 pieces, 2 across and 2 deep: 4 of 5 x 4 units.'
    );
  });

  it('says when the planner finds no split that fits the bed', () => {
    const run = runSplitPlan(
      splitPlanInput.parse({ grid: { width: 1.5, depth: 1 }, bed: { width: 42, unit: 'mm' } })
    );
    expect(run.content).toContain(
      'The baseplate generator found no split that fits this bed: piece'
    );
    expect(run.content).not.toContain('It prints in one piece.');
  });

  it('refuses a bed smaller than one grid unit', () => {
    const run = runSplitPlan(
      splitPlanInput.parse({ grid: { width: 2, depth: 2 }, bed: { width: 1, unit: 'in' } })
    );
    expect(run.isError).toBe(true);
  });

  it('takes whole or half grid units only', () => {
    expect(
      splitPlanInput.safeParse({ grid: { width: 2.3, depth: 2 }, bed: { width: 200, unit: 'mm' } })
        .success
    ).toBe(false);
  });
});

describe('bin_size_for', () => {
  it('gives the learned size of a common label, and says so when a label has none', () => {
    const run = runBinSizeFor(binSizeForInput.parse({ labels: ['Screwdrivers', 'zzqx blorp'] }));
    expect(run.content).toMatch(
      /- "Screwdrivers": \d+(\.5)? x \d+(\.5)? units, \d+u, [\d.]+ mm tall with the stacking lip \(about \d+% of bins with (this|similar) labels?\)\./
    );
    // The printed height counts the 4.4 mm stacking lip on top of the body.
    const height = Number(/units, (\d+)u,/.exec(run.content)?.[1]);
    expect(run.content).toContain(
      `${height}u, ${Math.round((height * 7 + 4.4) * 10) / 10} mm tall`
    );
    expect(run.content).toContain('- "zzqx blorp": no common size.');
    // Similar labels give "Hex keys" a top size that only a few bins share.
    expect(runBinSizeFor(binSizeForInput.parse({ labels: ['Hex keys'] })).content).toContain(
      '- "Hex keys": no common size.'
    );
    expect(run.content).not.toMatch(/\d{3,} bins/);
  });
});

describe('print_estimate', () => {
  it('adds up the bins as the bin designer estimates each one', () => {
    const each = estimateStandardBin({ width: 1, depth: 1, height: 3 });
    const run = runPrintEstimate(
      printEstimateInput.parse({ bins: [{ label: 'M3', width: 1, depth: 1, height: 3, count: 4 }] })
    );
    expect(run.content).toContain(
      `- 4 x "M3" (1 x 1 units, 3u): ${Math.round(each.gramsFilament * 10) / 10} g`
    );
    expect(run.content).toContain(`each; ${Math.round(each.gramsFilament * 4)} g and`);
    expect(run.content).toContain(`Total for 4 bins: ${Math.round(each.gramsFilament * 4)} g`);
    expect(run.content).toContain('The baseplate is not included.');
  });

  it('prices the batch from its total mass, so cheap filament is not free', () => {
    const bins = [{ width: 1, depth: 1, height: 2, count: 60 }];
    const run = runPrintEstimate(
      printEstimateInput.parse({ bins, printer: { filamentCostPerKg: 0.2 } })
    );
    const grams = Number(/Total for 60 bins: (\d+) g/.exec(run.content)?.[1]);
    expect(run.content).toContain(`about $${((grams / 1000) * 0.2).toFixed(2)} of filament`);
    expect(run.content).not.toContain('about $0.00');
  });

  it("uses the reader's filament cost", () => {
    const bins = [{ width: 2, depth: 2, height: 3 }];
    const cheap = runPrintEstimate(
      printEstimateInput.parse({ bins, printer: { filamentCostPerKg: 10 } })
    );
    const dear = runPrintEstimate(
      printEstimateInput.parse({ bins, printer: { filamentCostPerKg: 40 } })
    );
    const cost = (text: string): number => Number(/about \$([\d.]+)/.exec(text)?.[1]);
    expect(cost(dear.content)).toBeCloseTo(cost(cheap.content) * 4, 1);
  });
});
