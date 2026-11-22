/**
 * Runs the Ask AI golden set against the real model, through the same agent
 * loop, tools and message building as /api/docs-ask. It spends API credits:
 * --max-usd stops the run at a cap, answers and judge together.
 *
 *   pnpm run docs:build && pnpm run docs:llms
 *   vercel env run -e development -- pnpm run docs:ask-eval -- --model claude-opus-5-5 --effort medium
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { EFFORT, MODEL, runAgent } from '../../api/lib/docsAsk/agent.js';
import type { AgentProgress, Effort, RoundBudget } from '../../api/lib/docsAsk/agent.js';
import { rebuildMessages, userTurn } from '../../api/lib/docsAsk/history.js';
import type { StoredTurn } from '../../api/lib/docsAsk/history.js';
import { docsSource } from '../../api/lib/docsAsk/source.js';
import { ROUND_RESERVE_USD } from '../../api/lib/docsAsk/spend.js';
import { createToolRunner, toolDefinitions } from '../../api/lib/docsAsk/tools.js';
import type { ToolRunner } from '../../api/lib/docsAsk/tools.js';
import { checkAnswer, chipLabels } from './checks';
import type { AnswerChecks } from './checks';
import { GOLDEN } from './golden';
import type { GoldenCase } from './golden';
import { JUDGE_MODEL, judge } from './judge';
import type { JudgedTurn, Verdict } from './judge';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: MODEL },
    effort: { type: 'string', default: EFFORT },
    only: { type: 'string' },
    group: { type: 'string' },
    'max-usd': { type: 'string', default: '15' },
    concurrency: { type: 'string', default: '4' },
    'judge-model': { type: 'string', default: JUDGE_MODEL },
    out: { type: 'string', default: path.join('node_modules', '.cache', 'docs-ask-eval') },
  },
});

process.env.DOCS_ASK_CORPUS_DIR ??= path.join('apps', 'docs', '.vitepress', 'dist');
const maxUsd = Number(args['max-usd']);
if (!Number.isFinite(maxUsd) || maxUsd < 0) {
  throw new Error(`--max-usd must be a number of dollars, such as 15, not ${args['max-usd']}`);
}
const model = args.model;
const effort = args.effort as Effort;

interface TurnResult extends JudgedTurn {
  readonly reads: readonly string[];
  readonly costUsd: number;
  readonly seconds: number;
  readonly tools: readonly string[];
  readonly notices: readonly string[];
  readonly stopReason: string | null;
}

interface CaseResult {
  readonly id: string;
  readonly group: GoldenCase['group'];
  readonly turns: readonly TurnResult[];
  readonly checks: AnswerChecks | null;
  readonly citesSource: boolean | null;
  readonly verdict: Verdict | null;
  readonly judgeUsd: number;
  readonly error: string | null;
}

const JUDGE_RESERVE_USD = 0.1;
// Workers run at once, so a call must hold its share before it starts, or
// several calls could start on the same remaining money.
let spent = 0;
let held = 0;
function hold(usd: number): boolean {
  if (spent + held + usd > maxUsd) return false;
  held += usd;
  return true;
}
const budget: RoundBudget = {
  reserve: () => Promise.resolve(hold(ROUND_RESERVE_USD)),
  charge: (usd) => {
    spent += usd;
    return Promise.resolve();
  },
  release: () => {
    held -= ROUND_RESERVE_USD;
    return Promise.resolve();
  },
};

const client = new Anthropic();
const source = await docsSource();
const { corpus } = source;

const cases = GOLDEN.filter(
  (c) =>
    (!args.only || args.only.split(',').includes(c.id)) && (!args.group || c.group === args.group)
);
const missing = cases.flatMap((c) => [c.page, ...c.sources]).filter((link) => !corpus.pages[link]);
if (missing.length > 0)
  throw new Error(`Golden set names pages the corpus lacks: ${missing.join(', ')}`);

async function runCase(golden: GoldenCase): Promise<CaseResult> {
  const locale = source.locale(golden.locale ?? 'en');
  const tables = new Map([
    ['en', source.english],
    [locale, await source.labels(locale)],
  ]);
  const labelsFor = (code: string) => tables.get(code) ?? source.english;
  const runner = createToolRunner(corpus, labelsFor, source.english);
  const stored: StoredTurn[] = [];
  const results: TurnResult[] = [];
  const caseResult = (outcome: Omit<CaseResult, 'id' | 'group' | 'turns'>): CaseResult => ({
    id: golden.id,
    group: golden.group,
    turns: results,
    ...outcome,
  });
  // A failed answer can still have paid for rounds; its cost belongs in the totals.
  let pending: { question: string; started: number; usd: () => number } | null = null;
  try {
    for (const question of golden.turns) {
      const tools: string[] = [];
      const checks: string[] = [];
      const reads: string[] = [];
      const run: ToolRunner = (name, input, code) => {
        const result = runner(name, input, code);
        tools.push(`${name} ${JSON.stringify(input)}`);
        if (name === 'drawer_fit') checks.push(result.content);
        if (result.link) reads.push(result.link);
        return result;
      };
      const messages = [
        ...rebuildMessages(corpus, stored, runner, source.locale, () => true),
        ...userTurn(corpus, question, golden.page, locale),
      ];
      const sent: unknown[] = [];
      const notices: string[] = [];
      const progress: AgentProgress = { generations: [], steps: [], links: [] };
      const started = performance.now();
      // Every charge counts, a failed attempt's partial usage too, which
      // never reaches progress.generations.
      let turnUsd = 0;
      const turnBudget: RoundBudget = {
        reserve: () => budget.reserve(),
        charge: (usd) => {
          turnUsd += usd;
          return budget.charge(usd);
        },
        release: () => budget.release(),
      };
      pending = { question, started, usd: () => turnUsd };
      const result = await runAgent({
        client,
        corpus,
        tools: toolDefinitions(corpus),
        messages,
        locale,
        run,
        send: (event) => {
          if (event.type === 'message') sent.push(event.content);
          if (event.type === 'notice') notices.push(event.code);
        },
        budget: turnBudget,
        progress,
        signal: new AbortController().signal,
        model,
        effort,
      });
      stored.push({
        question,
        page: golden.page,
        locale,
        signature: '',
        messages: sent,
      } as StoredTurn);
      results.push({
        question,
        answer: result.answer,
        checks,
        reads,
        costUsd: turnUsd,
        seconds: (performance.now() - started) / 1000,
        tools,
        notices,
        stopReason: result.stopReason,
      });
      pending = null;
    }
    const last = results.at(-1) as TurnResult;
    const local = labelsFor(locale);
    const checks = checkAnswer(last.answer, corpus, local, source.english);
    // Citations count on the last answer, but every turn must link and label correctly.
    const earlier = results
      .slice(0, -1)
      .map((t) => checkAnswer(t.answer, corpus, local, source.english));
    const allChecks: AnswerChecks = {
      ...checks,
      brokenLinks: [...earlier.flatMap((c) => c.brokenLinks), ...checks.brokenLinks],
      unknownLabels: [
        ...new Set([...earlier.flatMap((c) => c.unknownLabels), ...checks.unknownLabels]),
      ],
      unknownCaptures: [...earlier.flatMap((c) => c.unknownCaptures), ...checks.unknownCaptures],
    };
    const citesSource =
      golden.sources.length === 0
        ? null
        : checks.citedPages.some((p) => golden.sources.includes(p));
    if (!hold(JUDGE_RESERVE_USD)) {
      return caseResult({
        checks: allChecks,
        citesSource,
        verdict: null,
        judgeUsd: 0,
        error: 'cap reached before the judge',
      });
    }
    // The judge grades against the pages the answer used too, not only the
    // ones the case was written against. The cut keeps its prompt bounded, so
    // the graded answer's own citations come first and are never cut.
    const pages = [
      ...new Set([
        ...checks.citedPages,
        ...golden.sources,
        ...last.reads,
        ...results.flatMap((t) => t.reads),
      ]),
    ].slice(0, Math.max(8, checks.citedPages.length));
    const keptEnglish = chipLabels(last.answer).filter((label) =>
      Object.entries(source.english).some(([key, value]) => value === label && local[key] === label)
    );
    let graded: Awaited<ReturnType<typeof judge>>;
    try {
      graded = await judge(
        client,
        corpus,
        golden,
        results,
        pages,
        locale === 'en' ? [] : [...new Set(keptEnglish)],
        args['judge-model']
      );
    } finally {
      held -= JUDGE_RESERVE_USD;
    }
    spent += graded.costUsd;
    return caseResult({
      checks: allChecks,
      citesSource,
      verdict: graded.verdict,
      judgeUsd: graded.costUsd,
      error: null,
    });
  } catch (caught) {
    if (pending) {
      results.push({
        question: pending.question,
        answer: '',
        checks: [],
        reads: [],
        costUsd: pending.usd(),
        seconds: (performance.now() - pending.started) / 1000,
        tools: [],
        notices: [],
        stopReason: null,
      });
    }
    return caseResult({
      checks: null,
      citesSource: null,
      verdict: null,
      judgeUsd: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    });
  }
}

const results: CaseResult[] = [];
const queue = [...cases];
await Promise.all(
  Array.from({ length: Number(args.concurrency) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (spent >= maxUsd) break;
      const result = await runCase(next);
      results.push(result);
      const mark = result.verdict?.verdict ?? (result.error ? 'error' : '?');
      console.log(
        `${result.id.padEnd(4)} ${mark.padEnd(7)} $${spent.toFixed(2)}${result.error ? `  ${result.error}` : ''}`
      );
    }
  })
);
results.sort((a, b) => a.id.localeCompare(b.id));

const answerUsd = results.flatMap((r) => r.turns).reduce((sum, t) => sum + t.costUsd, 0);
const questions = results.reduce((n, r) => n + r.turns.length, 0);
const judged = results.filter((r) => r.verdict);
const passed = judged.filter((r) => r.verdict?.verdict === 'pass');
const broken = results.flatMap((r) => (r.checks?.brokenLinks ?? []).map((l) => `${r.id} ${l}`));
const invented = results.flatMap((r) => (r.checks?.unknownLabels ?? []).map((l) => `${r.id} ${l}`));
const missingCaptures = results.flatMap((r) =>
  (r.checks?.unknownCaptures ?? []).map((id) => `${r.id} ${id}`)
);
const invalidTraps = results
  .filter((r) => r.group === 'gap' && r.verdict?.sourcesAnswer)
  .map((r) => r.id);
const gaps = results.filter((r) => r.group === 'gap' && !invalidTraps.includes(r.id));
const gapsPassed = gaps.filter((r) => r.verdict?.verdict === 'pass' && r.checks?.linksForum);
const seconds = results.flatMap((r) => r.turns.map((t) => t.seconds)).sort((a, b) => a - b);

const summary = {
  model,
  effort,
  corpus: corpus.version,
  cases: results.length,
  judged: judged.length,
  passRate: judged.length ? passed.length / judged.length : 0,
  byGroup: Object.fromEntries(
    [...new Set(results.map((r) => r.group))].map((group) => {
      const inGroup = results.filter((r) => r.group === group);
      const count = (v: string) => inGroup.filter((r) => r.verdict?.verdict === v).length;
      return [
        group,
        { pass: count('pass'), partial: count('partial'), fail: count('fail'), of: inGroup.length },
      ];
    })
  ),
  brokenLinks: broken,
  inventedLabels: invented,
  unknownCaptures: missingCaptures,
  gapTrapsPassed: `${gapsPassed.length}/${gaps.length}`,
  invalidTraps,
  missedSourceCitations: results.filter((r) => r.citesSource === false).map((r) => r.id),
  errors: results.filter((r) => r.error).map((r) => `${r.id}: ${r.error}`),
  answerUsd: Number(answerUsd.toFixed(3)),
  usdPerQuestion: Number((answerUsd / Math.max(questions, 1)).toFixed(4)),
  judgeUsd: Number(results.reduce((s, r) => s + r.judgeUsd, 0).toFixed(3)),
  medianSeconds: Number((seconds[Math.floor(seconds.length / 2)] ?? 0).toFixed(1)),
  gate:
    judged.length === cases.length &&
    passed.length / judged.length >= 0.9 &&
    broken.length === 0 &&
    invented.length === 0 &&
    missingCaptures.length === 0 &&
    gapsPassed.length === gaps.length,
};

fs.mkdirSync(args.out, { recursive: true });
const file = path.join(
  args.out,
  `${new Date().toISOString().replace(/[:.]/g, '-')}-${model}-${effort}.json`
);
fs.writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Full results: ${file}`);
for (const r of results.filter((r) => r.verdict && r.verdict.verdict !== 'pass')) {
  console.log(`\n${r.id} ${r.verdict?.verdict}: ${r.verdict?.note}`);
  for (const m of r.verdict?.missing ?? []) console.log(`  missing: ${m}`);
  for (const w of r.verdict?.wrong ?? []) console.log(`  wrong: ${w}`);
}
