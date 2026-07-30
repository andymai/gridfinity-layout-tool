/* eslint-disable no-console -- CLI script that outputs to console */
/**
 * Type-check the test suite and gate against a per-file baseline.
 *
 * `tsconfig.test.json` is deliberately absent from the root `tsconfig.json`
 * references, so `pnpm run typecheck` (`tsgo -b`) never walks it. Wiring it in
 * directly would fail on a large pre-existing backlog, so this ratchet gates on
 * a checked-in baseline instead: the count per file may not move in either
 * direction without updating `test-type-baseline.json`.
 *
 * Retire this script once the baseline is empty: add
 * `{ "path": "./tsconfig.test.json" }` to the root references and delete both
 * this file and the baseline.
 *
 * Usage:
 *   pnpm run check:test-types
 *   pnpm run check:test-types -- --update           # lock in fixes
 *   pnpm run check:test-types -- --update --allow-increase
 *
 * `--update` refuses to raise any file's count, so the baseline cannot be used
 * to paper over a regression. `--allow-increase` overrides that deliberately.
 *
 * Exit code 0 = baseline matches, 1 = drift (or the compiler failed to run).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(import.meta.dirname, 'test-type-baseline.json');
const PROJECT = 'tsconfig.test.json';
const GENERATED_EN_LOCALE = join(ROOT, 'src', 'i18n', 'locales', 'en.json');

export interface Baseline {
  /** Decorative header for whoever opens the file; never read back. */
  readonly note?: string;
  /** Human-readable summary only. `sumCounts(files)` is the authority — see readBaseline. */
  readonly total: number;
  readonly files: Record<string, number>;
}

export function sumCounts(files: Record<string, number>): number {
  return Object.values(files).reduce((sum, n) => sum + n, 0);
}

const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error TS\d+:/;

/**
 * Count diagnostics per file. Multi-line errors indent their continuation
 * lines, so only lines matching the `path(line,col): error TSxxxx:` shape are
 * counted — an elaboration is part of the error above it, not a new one.
 */
export function parseDiagnostics(output: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const line of output.split('\n')) {
    const match = ERROR_LINE.exec(line);
    if (!match) continue;
    const file = match[1].replaceAll('\\', '/');
    counts[file] = (counts[file] ?? 0) + 1;
  }
  return counts;
}

function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Returns null for malformed JSON or a shape the ratchet can't compare against. */
export function readBaseline(raw: string): Baseline | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const { total, files } = parsed as Partial<Baseline>;
  if (!isCount(total)) return null;
  if (typeof files !== 'object' || files === null || Array.isArray(files)) return null;
  // NaN would be the worst outcome to admit: every comparison against it is
  // false, so a file with a NaN count reads as matching and its ratchet
  // silently switches off.
  if (!Object.values(files).every(isCount)) return null;
  // A hand-edit or merge conflict can leave `total` disagreeing with `files`.
  // Rather than reject an otherwise usable baseline, normalize it: `files` is
  // what the ratchet compares, so a stale `total` may only mislead the report.
  return { ...(parsed as Baseline), total: sumCounts(files) };
}

export interface Drift {
  readonly regressed: { file: string; from: number; to: number }[];
  readonly improved: { file: string; from: number; to: number }[];
  readonly appeared: { file: string; to: number }[];
  readonly cleared: { file: string; from: number }[];
}

export function diffAgainstBaseline(
  baseline: Record<string, number>,
  current: Record<string, number>
): Drift {
  const regressed: Drift['regressed'][number][] = [];
  const improved: Drift['improved'][number][] = [];
  const appeared: Drift['appeared'][number][] = [];
  const cleared: Drift['cleared'][number][] = [];

  for (const [file, to] of Object.entries(current)) {
    const from = baseline[file];
    if (from === undefined) appeared.push({ file, to });
    else if (to > from) regressed.push({ file, from, to });
    else if (to < from) improved.push({ file, from, to });
  }
  for (const [file, from] of Object.entries(baseline)) {
    if (current[file] === undefined) cleared.push({ file, from });
  }

  return { regressed, improved, appeared, cleared };
}

export function hasDrift(drift: Drift): boolean {
  return (
    drift.regressed.length > 0 ||
    drift.improved.length > 0 ||
    drift.appeared.length > 0 ||
    drift.cleared.length > 0
  );
}

export interface CompilerRun {
  readonly output: string;
  /** The compiler's exit status. 0 means it ran and found nothing. */
  readonly exitCode: number;
  /** Non-null when the compiler never ran, as opposed to running and reporting errors. */
  readonly spawnFailure: string | null;
}

/**
 * A compiler that runs to completion and finds errors exits non-zero with
 * `status` set — the normal path here. Anything that stops it reaching an exit
 * code leaves `status` null: it never started (ENOENT, EACCES), or it was
 * killed by a signal or by exceeding maxBuffer. All of those make the captured
 * output untrustworthy, so only a numeric `status` counts as a real run;
 * conflating the two would let a missing `tsgo` read as a clean compile.
 */
export function classifyRun(error: unknown): CompilerRun {
  const result = error as {
    stdout?: string;
    stderr?: string;
    status?: number | null;
    message?: string;
  };
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const status = result.status;
  if (typeof status !== 'number') {
    return { output, exitCode: -1, spawnFailure: result.message ?? 'tsgo could not be started' };
  }
  return { output, exitCode: status, spawnFailure: null };
}

/**
 * `src/i18n/locales/en.json` is generated from `en.ts` and gitignored, and
 * `src/i18n/context.tsx` imports it. Absent, the whole run reports a TS2307
 * that has nothing to do with the caller's changes.
 *
 * The check generates it rather than relying on the caller having run
 * `pnpm dev`/`build` first: `pnpm install` skips `prepare` when it has nothing
 * to do (verified — CI installs without ever running it), so no install-time
 * hook can be trusted to have produced it.
 */
function ensureGeneratedSources(): void {
  if (existsSync(GENERATED_EN_LOCALE)) return;
  console.log('· Generating src/i18n/locales/en.json (missing)');
  execFileSync('pnpm', ['run', 'build:en-locale'], { cwd: ROOT, stdio: 'inherit' });
}

function runCompiler(): CompilerRun {
  try {
    execFileSync('pnpm', ['exec', 'tsgo', '-p', PROJECT, '--noEmit'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { output: '', exitCode: 0, spawnFailure: null };
  } catch (error) {
    return classifyRun(error);
  }
}

function sortByPath(files: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

function main(): void {
  const update = process.argv.includes('--update');
  const allowIncrease = process.argv.includes('--allow-increase');

  ensureGeneratedSources();
  const { output, exitCode, spawnFailure } = runCompiler();

  if (spawnFailure !== null) {
    console.error(`✗ Could not run the type-checker: ${spawnFailure}`);
    process.exit(1);
  }

  const current = parseDiagnostics(output);
  const total = sumCounts(current);

  // Only exit 0 proves "ran and found nothing". A non-zero exit we could not
  // parse — a crash, an unrecognized flag, a changed diagnostic format — must
  // never read as zero errors: in --update that would write an empty baseline
  // and switch the ratchet off entirely.
  if (exitCode !== 0 && total === 0) {
    console.error(`✗ tsgo exited ${exitCode} with no parseable diagnostics:\n${output}`);
    process.exit(1);
  }

  if (update) {
    // Without this, a regression could be "fixed" by rerunning --update and
    // checking in a higher baseline — the ratchet would be a suggestion.
    const previous = existsSync(BASELINE_PATH)
      ? readBaseline(readFileSync(BASELINE_PATH, 'utf8'))
      : null;
    if (previous !== null && !allowIncrease) {
      const drift = diffAgainstBaseline(previous.files, current);
      const worse = [...drift.regressed, ...drift.appeared.map((a) => ({ ...a, from: 0 }))];
      if (worse.length > 0) {
        console.error('\n✗ Refusing to raise the baseline. These files got worse:');
        for (const { file, from, to } of worse) console.error(`    ${file} (${from} → ${to})`);
        console.error('\n  Fix them, or pass --allow-increase if the increase is intended.\n');
        process.exit(1);
      }
    }

    const baseline: Baseline = {
      note: 'Per-file type errors under tsconfig.test.json. Generated by scripts/check-test-types.ts --update. This number must only go down.',
      total,
      files: sortByPath(current),
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`✓ Baseline updated: ${total} errors across ${Object.keys(current).length} files`);
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(
      `✗ Missing baseline at ${BASELINE_PATH}. Run: pnpm run check:test-types -- --update`
    );
    process.exit(1);
  }

  const baseline = readBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  if (baseline === null) {
    console.error(
      `✗ Baseline at ${BASELINE_PATH} is unreadable — expected { total: number, files: Record<string, number> }.\n` +
        '  Restore it from git, or regenerate with: pnpm run check:test-types -- --update'
    );
    process.exit(1);
  }

  const drift = diffAgainstBaseline(baseline.files, current);

  if (!hasDrift(drift)) {
    console.log(
      `✓ Test types match baseline (${total} known errors, ${Object.keys(current).length} files)`
    );
    return;
  }

  if (drift.appeared.length > 0) {
    console.error('\n✗ Test files that newly fail to type-check:');
    for (const { file, to } of drift.appeared) console.error(`    ${file} (${to})`);
  }
  if (drift.regressed.length > 0) {
    console.error('\n✗ Test files with more type errors than the baseline:');
    for (const { file, from, to } of drift.regressed)
      console.error(`    ${file} (${from} → ${to})`);
  }
  if (drift.improved.length > 0 || drift.cleared.length > 0) {
    console.error('\n→ Progress! Lock it in with: pnpm run check:test-types -- --update');
    for (const { file, from, to } of drift.improved) console.error(`    ${file} (${from} → ${to})`);
    for (const { file, from } of drift.cleared) console.error(`    ${file} (${from} → 0)`);
  }

  console.error(`\nBaseline total ${baseline.total} → current ${total}`);
  console.error('Run `pnpm exec tsgo -p tsconfig.test.json --noEmit` to see the errors.\n');
  process.exit(1);
}

const isDirectExecution = process.argv[1]?.endsWith('check-test-types.ts');
if (isDirectExecution) main();
