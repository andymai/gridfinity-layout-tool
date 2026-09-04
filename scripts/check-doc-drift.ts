#!/usr/bin/env tsx
/**
 * Guards internal docs against the two failure modes an audit keeps finding:
 * references to code that no longer exists, and unbounded growth.
 *
 * The size check is a RATCHET, not a fixed budget. Baselines shrink
 * automatically when a doc shrinks, so trimming never needs a config edit,
 * but growth past the tolerance has to be justified by raising the baseline
 * in the same commit. That is the property that stops slow regrowth: adding
 * a paragraph is easy, and adding a paragraph plus explaining the number is
 * the speed bump.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, 'scripts/doc-budget.json');
const GROWTH_TOLERANCE = 1.1;
const LONG_LINE_WORDS = 220;
/**
 * The allowlist file lists the very tokens it exempts, so leaving it in the
 * haystack makes every entry satisfy itself and the staleness test can never
 * fire. The script and its test stay IN: they legitimately define names the
 * docs cite (`allowedMissingRefs`, `docFiles`).
 */
const SELF = new Set(['scripts/doc-budget.json']);

export interface Baseline {
  readonly tolerance: string;
  readonly allowedMissingRefs: readonly string[];
  readonly words: Record<string, number>;
}

const args = new Set(process.argv.slice(2));
const UPDATE = args.has('--update');

let allTracked: string[] | null = null;
/** Every tracked path, listed once. Globbing per-pattern through git silently
 *  under-matched and made the reference check report false positives. */
function tracked(re: RegExp): string[] {
  if (allTracked === null) {
    allTracked = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .trim()
      .split('\n')
      .filter(Boolean);
  }
  return allTracked.filter((f) => re.test(f));
}

/** Docs an agent reads. Excludes generated, vendored and user-facing content. */
export function docFiles(): string[] {
  return [
    ...tracked(/^(src|api|scripts|docs)\/.*\.md$/),
    ...tracked(/^\.claude\/skills\/.*\.md$/),
    'CLAUDE.md',
  ].filter((f) => existsSync(join(ROOT, f)));
}

export const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length;

/** One haystack of every source file a doc could legitimately reference. */
let haystackCache: string | null = null;
export function haystack(): string {
  if (haystackCache !== null) return haystackCache;
  const files = tracked(
    /\.(ts|tsx|js|mjs|cjs|py|sh|json|yml|yaml|conf)$|^\.env\.example$|^Dockerfile$/
  ).filter(
    (f) =>
      !f.endsWith('.md') &&
      !f.startsWith('src/i18n/locales/') &&
      // This gate's own files name the very tokens it checks. Leaving them in
      // makes every allowlist entry satisfy itself, so the staleness test can
      // never fire, which is exactly what it exists to prevent.
      !SELF.has(f)
  );
  const parts: string[] = [];
  for (const f of files) {
    const p = join(ROOT, f);
    if (existsSync(p)) parts.push(p, readFileSync(p, 'utf8'));
  }
  haystackCache = parts.join('\n');
  return haystackCache;
}

/**
 * Tokens worth checking: a bare filename, or an identifier long enough that a
 * coincidental match is unlikely. Short names and prose fragments are skipped
 * rather than risk a noisy gate nobody trusts.
 */
const FILE_REF = /^[@\w./-]+\.(ts|tsx|sh|py)$/;
const SYMBOL_REF = /^[A-Za-z_][A-Za-z0-9_]{7,}$/;

export function referencesIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const raw = m[1].trim();
    if (FILE_REF.test(raw) || SYMBOL_REF.test(raw)) out.add(raw);
  }
  return [...out];
}

export function loadBaseline(): Baseline {
  return existsSync(BASELINE_PATH)
    ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline)
    : { tolerance: `${GROWTH_TOLERANCE}`, allowedMissingRefs: [], words: {} };
}

/** True when a backticked token names nothing in the repo. */
export function isDangling(ref: string): boolean {
  const bare = ref.replace(/^@\//, '').split('/').pop() ?? ref;
  return !haystack().includes(ref) && !haystack().includes(bare);
}

export { GROWTH_TOLERANCE, LONG_LINE_WORDS };

function main(): void {
  const baseline = loadBaseline();

  const allowed = new Set(baseline.allowedMissingRefs);
  const files = docFiles();
  const nextWords: Record<string, number> = {};
  const grew: string[] = [];
  const dangling: string[] = [];
  const longLines: string[] = [];

  for (const file of files) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    const words = wordCount(text);
    nextWords[file] = words;

    const budget = baseline.words[file];
    if (budget !== undefined && words > Math.ceil(budget * GROWTH_TOLERANCE)) {
      grew.push(
        `  ${file}: ${words} words, budget ${budget} (+${Math.round((words / budget - 1) * 100)}%)`
      );
    }

    for (const ref of referencesIn(text)) {
      if (allowed.has(ref)) continue;
      if (isDangling(ref)) dangling.push(`  ${file}: \`${ref}\``);
    }

    text.split('\n').forEach((line, i) => {
      if (line.startsWith('|') || line.startsWith('    ')) return;
      if (wordCount(line) > LONG_LINE_WORDS) {
        longLines.push(`  ${file}:${i + 1}: ${wordCount(line)} words in one line`);
      }
    });
  }

  if (UPDATE) {
    const merged = { ...baseline.words };
    for (const [f, w] of Object.entries(nextWords)) merged[f] = w;
    for (const f of Object.keys(merged)) if (!(f in nextWords)) delete merged[f];
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({ ...baseline, words: Object.fromEntries(Object.entries(merged).sort()) }, null, 2)}\n`
    );
    console.log(`✅ Baseline updated for ${Object.keys(merged).length} docs.`);
    return;
  }

  // A doc that shrank ratchets down silently: trimming must never need a config edit.
  const shrunk = Object.entries(nextWords).filter(([f, w]) => (baseline.words[f] ?? Infinity) > w);
  if (shrunk.length > 0 && !process.env.CI) {
    const merged = { ...baseline.words, ...Object.fromEntries(shrunk) };
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({ ...baseline, words: Object.fromEntries(Object.entries(merged).sort()) }, null, 2)}\n`
    );
  }

  let failed = false;

  if (dangling.length > 0) {
    console.error(`\n❌ Docs reference code that does not exist (${dangling.length}):\n`);
    console.error(dangling.join('\n'));
    console.error(
      '\n   Fix the reference, or add it to allowedMissingRefs in scripts/doc-budget.json\n' +
        '   if it names something outside this repo (a library internal, a placeholder).\n'
    );
    failed = true;
  }

  if (grew.length > 0) {
    console.error(`\n❌ Docs grew past their budget (${grew.length}):\n`);
    console.error(grew.join('\n'));
    console.error(
      '\n   Prose in these files is read on every relevant task, so growth is a real cost.\n' +
        '   Trim something, move the detail to a skill, or run:\n' +
        '     pnpm run check:doc-drift --update\n'
    );
    failed = true;
  }

  if (longLines.length > 0) {
    console.warn(
      `\n⚠  Very long single lines (${longLines.length}), usually narrative rather than reference:\n`
    );
    console.warn(longLines.join('\n'));
    console.warn('');
  }

  if (failed) process.exit(1);
  console.log(`✅ ${files.length} docs within budget, no dangling references.`);
}

// Only run as a CLI; the test suite imports the helpers above.
if (process.argv[1]?.endsWith('check-doc-drift.ts')) main();
