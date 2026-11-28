import { inflateRawSync } from 'node:zlib';
import { planLayoutInput, runPlanLayout } from '../../api/lib/agent/index.js';
import type { PlanLayoutInput, PlanView } from '../../api/lib/agent/index.js';
import type { AskCorpus, AskLabels } from '../../api/lib/docsAsk/corpus.js';
import { DISCUSSIONS_URL } from '../../api/lib/docsAsk/prompt.js';

const DOCS_ORIGIN = 'https://gridfinitylayouttool.com';
const LINK = /\]\(([^)\s]+)\)/g;
// The panel's Markdown turns a bare URL into a link too.
const BARE_DOCS_URL = /https:\/\/gridfinitylayouttool\.com\/docs[^\s)\]>"'`]*/g;
const CHIP = /\[\[ui:([^\]]+)\]\]/g;
const CAPTURE = /\[\[capture:([A-Za-z0-9._-]+)\]\]/g;
const ANCHOR = /\{#([^}]+)\}/g;

export interface AnswerChecks {
  readonly brokenLinks: readonly string[];
  readonly citedPages: readonly string[];
  /** Chip labels found in neither the reader's label table nor the English one. */
  readonly unknownLabels: readonly string[];
  readonly unknownCaptures: readonly string[];
  readonly linksForum: boolean;
}

export function docsPage(href: string): { page: string; anchor: string | null } | null {
  let url: URL;
  try {
    url = new URL(href, DOCS_ORIGIN);
  } catch {
    return null;
  }
  const match = /^\/docs(\/.*)?$/.exec(url.pathname);
  if (url.origin !== DOCS_ORIGIN || !match) return null;
  const path = (match[1] ?? '').replace(/\.(md|html)$/, '').replace(/\/$/, '');
  return { page: path === '' ? '/index' : path, anchor: url.hash.slice(1) || null };
}

export function anchorsOf(markdown: string): Set<string> {
  return new Set([...markdown.matchAll(ANCHOR)].map((m) => m[1] as string));
}

export function chipLabels(answer: string): string[] {
  return [...answer.matchAll(CHIP)].map((m) => (m[1] as string).trim());
}

export function checkAnswer(
  answer: string,
  corpus: AskCorpus,
  labels: AskLabels,
  english: AskLabels
): AnswerChecks {
  const brokenLinks: string[] = [];
  const citedPages = new Set<string>();
  const hrefs = new Set([
    ...[...answer.matchAll(LINK)].map((m) => m[1] as string),
    ...[...answer.matchAll(BARE_DOCS_URL)].map((m) => m[0].replace(/[.,;:!?]+$/, '')),
  ]);
  for (const href of hrefs) {
    const target = docsPage(href);
    if (!target) continue;
    const page = corpus.pages[target.page];
    if (!page || (target.anchor !== null && !anchorsOf(page.markdown).has(target.anchor))) {
      brokenLinks.push(href);
      continue;
    }
    citedPages.add(target.page);
  }
  const known = new Set([...Object.values(labels), ...Object.values(english)]);
  const unknownLabels = chipLabels(answer).filter((label) => !known.has(label));
  const captures = new Set(
    Object.values(corpus.pages).flatMap((page) =>
      [...page.markdown.matchAll(CAPTURE)].map((m) => m[1] as string)
    )
  );
  const unknownCaptures = [...answer.matchAll(CAPTURE)]
    .map((m) => m[1] as string)
    .filter((id) => !captures.has(id));
  return {
    brokenLinks,
    citedPages: [...citedPages],
    unknownLabels: [...new Set(unknownLabels)],
    unknownCaptures,
    linksForum: answer.includes(DISCUSSIONS_URL),
  };
}

/** The drawer that a drawer-size answer ends with: the measured mm, and each grid it may open at. */
export interface OpenDrawer {
  readonly mm: readonly [number, number] | readonly [number, number, number];
  readonly grids: readonly (readonly [number, number])[];
}

const PLAN = /\[\[plan:([^\]]+)\]\]/g;
const APP_LINK = /https:\/\/gridfinitylayouttool\.com(?!\/docs\b)[^\s)\]>"'`]*/g;
const MM_PER = { mm: 1, cm: 10, in: 25.4 } as const;

const mmOf = (value: number, unit: keyof typeof MM_PER): number =>
  Math.round(value * MM_PER[unit] * 10) / 10;

// The eval runs without the `@/` alias, so it cannot import the app's decoder;
// zlib reads the same raw deflate.
export function decodePlanUrl(url: string): PlanLayoutInput | string {
  const match = /#plan=v(\d+)\.([A-Za-z0-9_-]+)$/.exec(url);
  if (match === null) return `not a plan link: ${url}`;
  let json: unknown;
  try {
    json = JSON.parse(inflateRawSync(Buffer.from(match[2] as string, 'base64url')).toString());
  } catch {
    return 'the plan link does not inflate to JSON';
  }
  const parsed = planLayoutInput.safeParse(json);
  return parsed.success
    ? parsed.data
    : `the plan link holds an invalid plan: ${parsed.error.message}`;
}

// A decimal comma counts, for answers in languages that write 8,5.
const literal = (value: number): string => String(value).replace('.', '[.,]');
const namesGrid = (answer: string, [width, depth]: readonly [number, number]): boolean =>
  new RegExp(
    `(?<!\\d|\\d[.,])${literal(width)}\\s*(?:x|×|by)\\s*${literal(depth)}(?!\\d|[.,]\\d)`,
    'i'
  ).test(answer);

/**
 * Problems with the plans an answer shows: each [[plan:…]] must be a plan that
 * plan_layout made in this chat, its link must rebuild the same grid and bins
 * that the map draws, and the answer must name that grid. With `expected`, the
 * answer must end with one plan of that drawer, without bins, or show no plan
 * when `expected` is null.
 */
export function checkPlans(
  answer: string,
  plans: readonly PlanView[],
  expected?: OpenDrawer | null
): string[] {
  const problems: string[] = [];
  const handles = [...answer.matchAll(PLAN)].map((m) => m[1] as string);
  for (const handle of handles) {
    const plan = plans.find((p) => p.handle === handle);
    if (plan === undefined) {
      problems.push(`[[plan:${handle}]] is not a plan from plan_layout`);
      continue;
    }
    const input = decodePlanUrl(plan.link);
    if (typeof input === 'string') {
      problems.push(input);
      continue;
    }
    const rebuilt = runPlanLayout(input, { origin: 'https://gridfinitylayouttool.com' }).plan;
    const grid = [plan.grid.width, plan.grid.depth] as const;
    if (
      rebuilt === null ||
      rebuilt.grid.width !== grid[0] ||
      rebuilt.grid.depth !== grid[1] ||
      rebuilt.bins.length !== plan.bins.length ||
      rebuilt.stashed.length !== plan.stashed.length
    ) {
      problems.push(`the link of [[plan:${handle}]] opens another layout than its map shows`);
    }
    if (!namesGrid(answer, grid)) {
      problems.push(`the answer does not name the ${grid[0]} x ${grid[1]} grid of its plan`);
    }
    if (expected) problems.push(...drawerProblems(input, grid, expected));
  }
  if (expected === null && handles.length > 0)
    problems.push('shows a plan for a drawer with no fit');
  if (expected) {
    if (handles.length !== 1) problems.push(`shows ${handles.length} plans, not 1`);
    const last = answer.trim().split('\n').at(-1)?.trim() ?? '';
    if (!/^\[\[plan:[^\]]+\]\]$/.test(last)) problems.push('does not end with the plan');
    const appLinks = answer.match(APP_LINK) ?? [];
    if (appLinks.length > 0) problems.push(`writes a link to the app: ${appLinks.join(', ')}`);
  }
  return problems;
}

function drawerProblems(
  input: PlanLayoutInput,
  grid: readonly [number, number],
  expected: OpenDrawer
): string[] {
  const problems: string[] = [];
  const { drawer } = input;
  if (drawer === undefined) return ['the plan has no measured drawer'];
  const measured = [drawer.width, drawer.depth, drawer.height]
    .filter((value) => value !== undefined)
    .map((value) => mmOf(value, drawer.unit));
  if (measured.join(' x ') !== expected.mm.join(' x ')) {
    problems.push(
      `the plan's drawer is ${measured.join(' x ')} mm, not ${expected.mm.join(' x ')}`
    );
  }
  if (input.bins.length > 0) problems.push(`the plan has ${input.bins.length} bins, not none`);
  if (!expected.grids.some(([w, d]) => w === grid[0] && d === grid[1])) {
    problems.push(
      `the plan opens ${grid[0]} x ${grid[1]}, not ${expected.grids.map((g) => g.join(' x ')).join(' or ')}`
    );
  }
  return problems;
}
