/**
 * Runs the Ask AI golden set against the real model, through the same agent
 * loop, tools and message building as /api/docs-ask. It spends API credits:
 * --max-usd stops the run at a cap, answers and judge together.
 *
 *   pnpm run build:agent-server && pnpm run docs:build && pnpm run docs:llms
 *   vercel env run -e development -- pnpm run docs:ask-eval -- --model claude-opus-5-5 --effort medium
 *
 * --suggestions runs every docs page's starter questions instead of the golden set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { EFFORT, MODEL, runAgent } from '../../api/lib/docsAsk/agent.js';
import type {
  AgentProgress,
  AgentResult,
  BrowserCall,
  Effort,
  RoundBudget,
} from '../../api/lib/docsAsk/agent.js';
import {
  listMyLayoutsInput,
  readMyLayoutInput,
  readMySettingsInput,
} from '../../api/lib/agent/index.js';
import type { PlanView } from '../../api/lib/agent/index.js';
import { CLIENT_TOOLS, clientRun } from '../../api/lib/docsAsk/clientTools.js';
import type { ClientResult } from '../../api/lib/docsAsk/clientTools.js';
import { pendingMessages, rebuildMessages, userTurn } from '../../api/lib/docsAsk/history.js';
import type { PendingTurn, StoredTurn } from '../../api/lib/docsAsk/history.js';
import { docsSource } from '../../api/lib/docsAsk/source.js';
import { ROUND_RESERVE_USD } from '../../api/lib/docsAsk/spend.js';
import { createToolRunner, toolDefinitions } from '../../api/lib/docsAsk/tools.js';
import type { ToolRunner } from '../../api/lib/docsAsk/tools.js';
import { checkAnswer, checkPlans, chipLabels } from './checks';
import type { AnswerChecks } from './checks';
import { GOLDEN } from './golden';
import type { GoldenCase, ReaderFixture } from './golden';
import { JUDGE_MODEL, judge } from './judge';
import { suggestionCases } from './suggestions';
import type { JudgedTurn, Verdict } from './judge';

// Answers link to production, as the live endpoint's do.
const PRODUCTION_ORIGIN = 'https://gridfinitylayouttool.com';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: MODEL },
    effort: { type: 'string', default: EFFORT },
    only: { type: 'string' },
    group: { type: 'string' },
    suggestions: { type: 'boolean', default: false },
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
  /** What checkPlans found wrong with the plans that the answers show. */
  readonly planProblems: readonly string[];
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

const cases = (args.suggestions ? suggestionCases() : GOLDEN).filter(
  (c) =>
    (!args.only || args.only.split(',').includes(c.id)) && (!args.group || c.group === args.group)
);
const missing = cases.flatMap((c) => [c.page, ...c.sources]).filter((link) => !corpus.pages[link]);
if (missing.length > 0)
  throw new Error(`Golden set names pages the corpus lacks: ${missing.join(', ')}`);

/**
 * What the reader's browser sends for one read: the case's fixture when the
 * reader allows it, or a decline. A case without a fixture declines every
 * read, since its question does not ask about the reader's data.
 */
function readerResult(fixture: ReaderFixture | undefined, call: BrowserCall): ClientResult {
  const id = call.id;
  // The panel runs a read only when its input fits the tool, as the browser does.
  const schema = {
    list_my_layouts: listMyLayoutsInput,
    read_my_layout: readMyLayoutInput,
    read_my_settings: readMySettingsInput,
  }[call.name];
  if (schema === undefined || !schema.safeParse(call.input).success) {
    return { callId: id, status: 'unavailable' };
  }
  if (fixture === undefined || fixture.answer === 'decline')
    return { callId: id, status: 'declined' };
  if (call.name === 'list_my_layouts' && fixture.layouts) {
    return { callId: id, status: 'shared', data: fixture.layouts };
  }
  if (call.name === 'read_my_settings' && fixture.settings) {
    return { callId: id, status: 'shared', data: fixture.settings };
  }
  if (call.name === 'read_my_layout') {
    // The fixture layout is the one open in the app; an explicit id must name it.
    const asked = (call.input as { layoutId?: unknown } | null)?.layoutId;
    const open = fixture.layouts?.layouts.find((layout) => layout.active)?.id ?? 'desk';
    const match = asked === undefined || asked === open;
    return {
      callId: id,
      status: 'shared',
      data: { layout: match ? (fixture.layout ?? null) : null },
    };
  }
  return { callId: id, status: 'unavailable' };
}

// Tools whose results the judge gets, since their numbers are not in the docs.
const CHECKED_TOOLS = new Set([
  'drawer_fit',
  'plan_layout',
  'split_plan',
  'bin_size_for',
  'print_estimate',
]);

async function runCase(golden: GoldenCase): Promise<CaseResult> {
  const locale = source.locale(golden.locale ?? 'en');
  const tables = new Map([
    ['en', source.english],
    [locale, await source.labels(locale)],
  ]);
  const labelsFor = (code: string) => tables.get(code) ?? source.english;
  const runner = createToolRunner(corpus, labelsFor, source.english, PRODUCTION_ORIGIN);
  const stored: StoredTurn[] = [];
  const results: TurnResult[] = [];
  const plans: PlanView[] = [];
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
        if (CHECKED_TOOLS.has(name)) checks.push(result.content);
        if (result.link) reads.push(result.link);
        if (result.plan) plans.push(result.plan);
        return result;
      };
      const prior = rebuildMessages(
        corpus,
        stored,
        runner,
        source.locale,
        () => true,
        CLIENT_TOOLS
      );
      let messages = [...prior, ...userTurn(corpus, question, golden.page, locale)];
      let shared: ClientResult[] = [];
      let firstRound = 0;
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
      let result: AgentResult;
      // A read ends the request; the reader's answer goes back as the panel's
      // resume does, through the server's own rebuild of the pending turn.
      for (;;) {
        result = await runAgent({
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
          clientTools: CLIENT_TOOLS,
          firstRound,
          clientResults: shared.length,
        });
        if (result.pending === null) break;
        const fresh = result.pending.calls.map((call) => readerResult(golden.reader, call));
        for (const call of result.pending.calls) {
          tools.push(`${call.name} ${JSON.stringify(call.input)}`);
          const tool = CLIENT_TOOLS.get(call.name);
          const answer = fresh.find((r) => r.callId === call.id);
          const ran = tool && answer ? clientRun(tool, call.input, answer) : null;
          if (ran) checks.push(ran.content);
        }
        const waiting: PendingTurn = {
          question,
          page: golden.page,
          locale,
          messages: sent.map((content) => content as unknown[]),
          results: shared,
          rounds: result.pending.rounds,
          issuedAt: 0,
          nonce: '00000000-0000-4000-8000-000000000000',
          signature: '0'.repeat(64),
        };
        const current = pendingMessages(corpus, waiting, fresh, runner, CLIENT_TOOLS);
        if (current === null)
          throw new Error(`A reader fixture does not fit its tool in ${golden.id}`);
        shared = [...shared, ...fresh];
        messages = [...prior, ...current];
        firstRound = result.pending.rounds;
      }
      stored.push({
        question,
        page: golden.page,
        locale,
        signature: '',
        messages: sent,
        ...(shared.length > 0 ? { results: shared } : {}),
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
    const planProblems = results.flatMap((turn, i) =>
      checkPlans(turn.answer, plans, i === results.length - 1 ? golden.openDrawer : undefined)
    );
    const citesSource =
      golden.sources.length === 0
        ? null
        : checks.citedPages.some((p) => golden.sources.includes(p));
    if (!hold(JUDGE_RESERVE_USD)) {
      return caseResult({
        checks: allChecks,
        planProblems,
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
      planProblems,
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
      planProblems: [],
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
const planProblems = results.flatMap((r) => r.planProblems.map((p) => `${r.id} ${p}`));
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
  // Reads that a question outside the yours group did not ask for.
  unaskedReads: results
    .filter(
      (r) =>
        r.group !== 'yours' &&
        r.turns.some((t) => t.tools.some((call) => CLIENT_TOOLS.has(call.split(' ')[0] ?? '')))
    )
    .map((r) => r.id),
  inventedLabels: invented,
  planProblems,
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
    planProblems.length === 0 &&
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
