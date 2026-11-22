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
import { checkAnswer } from './checks';
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

let spent = 0;
const budget: RoundBudget = {
  reserve: () => Promise.resolve(spent + ROUND_RESERVE_USD <= maxUsd),
  charge: (usd) => {
    spent += usd;
    return Promise.resolve();
  },
  release: () => Promise.resolve(),
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
  try {
    for (const question of golden.turns) {
      const tools: string[] = [];
      const checks: string[] = [];
      const reads: string[] = [];
      const run = (name: string, input: unknown, code: string) => {
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
        budget,
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
        costUsd: progress.generations.reduce((sum, g) => sum + g.costUsd, 0),
        seconds: (performance.now() - started) / 1000,
        tools,
        notices,
        stopReason: result.stopReason,
      });
    }
    const last = results.at(-1) as TurnResult;
    const checks = checkAnswer(last.answer, corpus, labelsFor(locale), source.english);
    const citesSource =
      golden.sources.length === 0
        ? null
        : checks.citedPages.some((p) => golden.sources.includes(p));
    if (spent >= maxUsd) {
      return {
        id: golden.id,
        group: golden.group,
        turns: results,
        checks,
        citesSource,
        verdict: null,
        judgeUsd: 0,
        error: 'cap reached before the judge',
      };
    }
    // The judge grades against the pages the answer used too, not only the
    // ones the case was written against. Six pages keep its prompt bounded.
    const pages = [
      ...new Set([...golden.sources, ...results.flatMap((t) => t.reads), ...checks.citedPages]),
    ].slice(0, 6);
    const local = labelsFor(locale);
    const keptEnglish = [...last.answer.matchAll(/\[\[ui:([^\]]+)\]\]/g)]
      .map((m) => (m[1] as string).trim())
      .filter((label) =>
        Object.entries(source.english).some(
          ([key, value]) => value === label && local[key] === label
        )
      );
    const graded = await judge(
      client,
      corpus,
      golden,
      results,
      pages,
      locale === 'en' ? [] : [...new Set(keptEnglish)],
      args['judge-model']
    );
    spent += graded.costUsd;
    return {
      id: golden.id,
      group: golden.group,
      turns: results,
      checks,
      citesSource,
      verdict: graded.verdict,
      judgeUsd: graded.costUsd,
      error: null,
    };
  } catch (caught) {
    return {
      id: golden.id,
      group: golden.group,
      turns: results,
      checks: null,
      citesSource: null,
      verdict: null,
      judgeUsd: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    };
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
