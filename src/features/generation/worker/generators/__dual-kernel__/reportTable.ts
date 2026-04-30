/**
 * Console timing table for scenario test performance reporting.
 * Called from afterAll — output is suppressed in --reporter=json mode.
 */

export interface TimingEntry {
  name: string;
  category: string;
  triangleCount: number;
  timeMs: number;
  passed: boolean;
}

/** Print an ASCII summary table of scenario timings. */
export function printTimingTable(timings: TimingEntry[]): void {
  if (timings.length === 0) return;

  const maxName = Math.max(40, ...timings.map((t) => t.name.length));
  const maxCat = Math.max(16, ...timings.map((t) => t.category.length));

  const header = [
    'Category'.padEnd(maxCat),
    'Scenario'.padEnd(maxName),
    'Tris'.padStart(8),
    'Time(ms)'.padStart(10),
    'Status'.padStart(6),
  ].join(' │ ');

  const separator = header.replace(/[^│]/g, '─').replace(/│/g, '┼');

  const rows = timings.map((t) =>
    [
      t.category.padEnd(maxCat),
      t.name.padEnd(maxName),
      String(t.triangleCount).padStart(8),
      t.timeMs.toFixed(0).padStart(10),
      (t.passed ? 'PASS' : 'FAIL').padStart(6),
    ].join(' │ ')
  );

  const totalTime = timings.reduce((sum, t) => sum + t.timeMs, 0);
  const totalTris = timings.reduce((sum, t) => sum + t.triangleCount, 0);
  const passCount = timings.filter((t) => t.passed).length;

  // eslint-disable-next-line no-console -- dual-kernel parity report is intentionally printed to console for scenario diagnostics
  console.log(
    [
      '',
      `Bin Generation Scenario Report (${timings.length} scenarios)`,
      separator,
      header,
      separator,
      ...rows,
      separator,
      `Total: ${totalTris} triangles, ${totalTime.toFixed(0)}ms, ${passCount}/${timings.length} passed`,
      '',
    ].join('\n')
  );
}
