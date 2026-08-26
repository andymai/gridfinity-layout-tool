/**
 * Diff two kernelParityMatrix runs into a geometry + performance verdict.
 *
 *   tsx scripts/compare-kernel-parity.ts /tmp/parity_occt.json /tmp/parity_brepkit.json
 *
 * Geometry parity is judged on invariants that must agree regardless of
 * tessellation: volume (0.5%, above faceting noise), bounding box (0.05mm),
 * and both meshes being closed. Manifoldness and triangle count are reported
 * per kernel rather than compared, since neither has to match to be correct.
 */
import { readFileSync } from 'node:fs';

interface Row {
  name: string;
  ok: boolean;
  error?: string;
  ms?: number;
  triangles?: number;
  volume?: number;
  boundaryEdges?: number;
  nonManifoldEdges?: number;
  euler?: number;
  bbox?: number[];
}
interface File {
  kernel: string;
  rows: Row[];
}

const [refPath, cmpPath] = process.argv.slice(2);
if (!refPath || !cmpPath) {
  console.error('usage: compare-kernel-parity.ts <reference.json> <candidate.json>');
  process.exit(2);
}
const ref: File = JSON.parse(readFileSync(refPath, 'utf8'));
const cmp: File = JSON.parse(readFileSync(cmpPath, 'utf8'));

const VOLUME_TOL = 0.005;
const BBOX_TOL = 0.05;

const byName = new Map(cmp.rows.map((r) => [r.name, r]));
const problems: string[] = [];
let refTotal = 0;
let cmpTotal = 0;

console.log(`\n${cmp.kernel} vs ${ref.kernel}\n`);
console.log(
  'scenario                  | ' +
    `${ref.kernel.padEnd(9)}| ${cmp.kernel.padEnd(9)}| ratio | volume Δ | closed | nm | verdict`
);
console.log('-'.repeat(104));

for (const r of ref.rows) {
  const c = byName.get(r.name);
  if (!c) {
    problems.push(`${r.name}: missing from ${cmp.kernel}`);
    continue;
  }
  if (!r.ok || !c.ok) {
    problems.push(
      `${r.name}: ${!c.ok ? `${cmp.kernel} FAILED: ${c.error}` : `${ref.kernel} failed`}`
    );
    console.log(
      `${r.name.padEnd(26)}| ${!c.ok ? 'ERROR: ' + (c.error ?? '').slice(0, 60) : 'ref failed'}`
    );
    continue;
  }
  refTotal += r.ms ?? 0;
  cmpTotal += c.ms ?? 0;

  const dv = Math.abs((c.volume ?? 0) - (r.volume ?? 0)) / Math.max(1, Math.abs(r.volume ?? 1));
  const dbb = Math.max(...(r.bbox ?? []).map((v, i) => Math.abs(v - (c.bbox ?? [])[i])));
  const closed = c.boundaryEdges === 0;
  const issues: string[] = [];
  if (dv > VOLUME_TOL) issues.push(`volume ${(dv * 100).toFixed(2)}%`);
  if (dbb > BBOX_TOL) issues.push(`bbox ${dbb.toFixed(3)}mm`);
  if (!closed) issues.push(`${c.boundaryEdges} boundary edges`);
  if (issues.length) problems.push(`${r.name}: ${issues.join(', ')}`);

  const ratio = (c.ms ?? 0) / Math.max(1, r.ms ?? 1);
  console.log(
    `${r.name.padEnd(26)}| ${String(r.ms).padEnd(9)}| ${String(c.ms).padEnd(9)}| ` +
      `${ratio.toFixed(2)}x | ${(dv * 100).toFixed(3)}%   | ${closed ? 'yes' : 'NO '}    | ` +
      `${String(c.nonManifoldEdges).padEnd(3)}| ${issues.length ? 'FAIL ' + issues.join('; ') : 'ok'}`
  );
}

console.log('-'.repeat(104));
console.log(
  `TOTAL                     | ${String(refTotal).padEnd(9)}| ${String(cmpTotal).padEnd(9)}| ` +
    `${(cmpTotal / Math.max(1, refTotal)).toFixed(2)}x`
);

const refNm = ref.rows.filter((r) => (r.nonManifoldEdges ?? 0) > 0).length;
const cmpNm = cmp.rows.filter((r) => (r.nonManifoldEdges ?? 0) > 0).length;
console.log(`\nnon-manifold scenarios: ${ref.kernel} ${refNm}, ${cmp.kernel} ${cmpNm}`);

if (problems.length) {
  console.log(`\n${problems.length} PARITY PROBLEM(S):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\nGeometric parity: OK on every scenario.');
