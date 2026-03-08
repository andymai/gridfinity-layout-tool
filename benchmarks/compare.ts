/**
 * Compare two Vitest benchmark JSON outputs side-by-side.
 *
 * Usage:
 *   npx tsx benchmarks/compare.ts benchmarks/baseline-opencascade.json benchmarks/baseline-brepjs-wasm.json
 *
 * Reads Vitest bench JSON reporter output and prints a table showing
 * median time and relative change per benchmark.
 */
import { readFileSync } from 'fs';

interface VitestBenchResult {
  name: string;
  mean: number;
  median: number;
  [key: string]: unknown;
}

interface VitestBenchGroup {
  fullName: string;
  benchmarks: VitestBenchResult[];
}

interface VitestBenchSuite {
  files: Array<{
    filepath: string;
    groups: VitestBenchGroup[];
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readBaseline(filePath: string): Map<string, { median: number; mean: number }> {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as VitestBenchSuite;
  const map = new Map<string, { median: number; mean: number }>();

  for (const file of raw.files) {
    for (const group of file.groups) {
      for (const bench of group.benchmarks) {
        const key = group.fullName ? `${group.fullName} > ${bench.name}` : bench.name;
        map.set(key, { median: bench.median, mean: bench.mean });
      }
    }
  }

  return map;
}

function formatMs(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(1)}ms`;
}

function formatChange(baseMs: number, newMs: number): string {
  const pct = ((newMs - baseMs) / baseMs) * 100;
  const sign = pct >= 0 ? '+' : '';
  const label = pct < -5 ? ' FASTER' : pct > 5 ? ' SLOWER' : '';
  return `${sign}${pct.toFixed(1)}%${label}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [, , baseFile, newFile] = process.argv;

if (!baseFile || !newFile) {
  process.stderr.write('Usage: npx tsx benchmarks/compare.ts <baseline.json> <new.json>\n');
  process.exit(1);
}

const base = readBaseline(baseFile);
const next = readBaseline(newFile);

const allKeys = new Set([...base.keys(), ...next.keys()]);
const maxKey = Math.max(40, ...[...allKeys].map((k) => k.length));

const header = [
  'Benchmark'.padEnd(maxKey),
  'Base'.padStart(10),
  'New'.padStart(10),
  'Change'.padStart(14),
].join(' │ ');

const sep = header.replace(/[^│]/g, '─').replace(/│/g, '┼');

const rows: string[] = [];
let totalBase = 0;
let totalNew = 0;

for (const key of [...allKeys].sort()) {
  const b = base.get(key);
  const n = next.get(key);

  const baseStr = b ? formatMs(b.median) : '—';
  const newStr = n ? formatMs(n.median) : '—';
  const changeStr = b && n ? formatChange(b.median, n.median) : 'N/A';

  // Only accumulate matched pairs for an apples-to-apples total
  if (b && n) {
    totalBase += b.median;
    totalNew += n.median;
  }

  rows.push(
    [key.padEnd(maxKey), baseStr.padStart(10), newStr.padStart(10), changeStr.padStart(14)].join(
      ' │ '
    )
  );
}

const totalChange = totalBase > 0 && totalNew > 0 ? formatChange(totalBase, totalNew) : 'N/A';

// eslint-disable-next-line no-console
console.log(
  [
    '',
    `Benchmark Comparison: ${baseFile} vs ${newFile}`,
    sep,
    header,
    sep,
    ...rows,
    sep,
    `Total: ${formatMs(totalBase)} → ${formatMs(totalNew)} (${totalChange})`,
    '',
  ].join('\n')
);
