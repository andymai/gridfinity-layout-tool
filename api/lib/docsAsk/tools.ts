import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { pageAt } from './corpus.js';
import type { AskCorpus, AskLabels, AskPage } from './corpus.js';
import { drawerFitInput, planLayoutInput, runDrawerFit, runPlanLayout } from '../agent/index.js';
import type { PlanView } from '../agent/index.js';
import { localeName } from './prompt.js';
import { createSearch, pageSections } from './search.js';

export type ToolName = 'read_page' | 'search_docs' | 'drawer_fit' | 'plan_layout';
export const TOOL_NAMES: readonly ToolName[] = [
  'read_page',
  'search_docs',
  'drawer_fit',
  'plan_layout',
];
export type StepKind = 'read' | 'search' | 'check' | 'plan';

export const STEP_KINDS: Readonly<Record<ToolName, StepKind>> = {
  read_page: 'read',
  search_docs: 'search',
  drawer_fit: 'check',
  plan_layout: 'plan',
};

export const PLACEHOLDER_LABELS: Readonly<Record<StepKind, string>> = {
  read: 'Opening a page',
  search: 'Searching the docs',
  check: 'Checking a drawer',
  plan: 'Planning a drawer',
};

export interface ToolRun {
  readonly content: string;
  readonly isError: boolean;
  /** What the panel's step timeline shows for the call. */
  readonly label: string;
  /** The page that a read opened. */
  readonly link?: string;
  /** What the panel draws for a plan_layout call. */
  readonly plan?: PlanView;
}

export type ToolRunner = (name: string, input: unknown, locale: string) => ToolRun;

export function toolResult(id: string, run: ToolRun): Anthropic.Beta.BetaToolResultBlockParam {
  return {
    type: 'tool_result',
    tool_use_id: id,
    content: run.content,
    ...(run.isError ? { is_error: true } : {}),
  };
}

const SEARCH_LIMIT = 6;

const { $schema: _dialect, ...planLayoutSchema } = z.toJSONSchema(planLayoutInput, { io: 'input' });
const PLAN_LAYOUT_SCHEMA = planLayoutSchema as Anthropic.Beta.BetaTool.InputSchema;

const readPageInput = z.object({ link: z.string().max(200) }).strict();
const searchInput = z.object({ query: z.string().min(1).max(200) }).strict();

export function toolDefinitions(corpus: AskCorpus): Anthropic.Beta.BetaToolUnion[] {
  return [
    {
      name: 'read_page',
      description:
        'Open one docs page in full: its text with the anchor on each heading, its captures as [[capture:id]], and its control labels as [[ui:Label]]. For a reader who is not reading English, it also lists each label in their language. Pass the link from the page map, such as /baseplates/splitting.',
      input_schema: {
        type: 'object',
        properties: { link: { type: 'string', enum: Object.keys(corpus.pages) } },
        required: ['link'],
        additionalProperties: false,
      },
      eager_input_streaming: true,
    },
    {
      name: 'search_docs',
      description:
        'Search the text of every docs section. Returns the best sections, each with its page link, URL with anchor, and a snippet. Use it to find a detail that the page map does not place.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'A few English keywords: the docs are in English.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      eager_input_streaming: true,
    },
    {
      name: 'drawer_fit',
      description:
        "Run the Layout Tool's own drawer calculator. Give the inside width and depth of a drawer, and its height when known. Returns the whole-unit grid, a tighter half-unit grid when one fits, the spare room, the tallest bins for stacks of 1, 2 and 3 with the default baseplate, and a link that opens the layout editor at that size.",
      input_schema: {
        type: 'object',
        properties: {
          widthMm: { type: 'number', description: 'Inside width, in the unit below.' },
          depthMm: { type: 'number', description: 'Inside depth, in the unit below.' },
          heightMm: { type: 'number', description: 'Inside height, if known.' },
          unit: { type: 'string', enum: ['mm', 'in'], description: 'Default mm.' },
        },
        required: ['widthMm', 'depthMm'],
        additionalProperties: false,
      },
      eager_input_streaming: true,
    },
    {
      name: 'plan_layout',
      description:
        "Plan a whole drawer with the Layout Tool's own placement code. Give the measured drawer (or a grid size when there is no measurement) and a bin for each kind of thing to store. The app fits the grid, places the bins largest first, puts a bin on layer 2 only where bins below carry it, and sends bins that do not fit to the stash. Returns what it placed and stashed. The panel draws the plan with a button that opens it in the app, so never write a link to it.",
      input_schema: PLAN_LAYOUT_SCHEMA,
      eager_input_streaming: true,
    },
  ];
}

function labelTable(page: AskPage, locale: string, labels: AskLabels, english: AskLabels): string {
  if (locale === 'en') return '';
  const rows = page.labels
    .map((key) => [labels[key], english[key]] as const)
    .filter((row): row is readonly [string, string] => Boolean(row[0] && row[1]));
  if (rows.length === 0) return '';
  const language = localeName(locale);
  return `\n\n---\nLabels on this page, ${language} | English:\n${rows.map(([own, en]) => `- ${own} | ${en}`).join('\n')}`;
}

const searches = new WeakMap<AskCorpus, ReturnType<typeof createSearch>>();

function searchFor(corpus: AskCorpus): ReturnType<typeof createSearch> {
  let search = searches.get(corpus);
  if (!search) {
    search = createSearch(
      Object.entries(corpus.pages).flatMap(([link, page]) =>
        pageSections(link, page.title, page.markdown)
      )
    );
    searches.set(corpus, search);
  }
  return search;
}

export function createToolRunner(
  corpus: AskCorpus,
  labelsFor: (locale: string) => AskLabels,
  english: AskLabels,
  origin: string
): ToolRunner {
  const search = searchFor(corpus);
  return (name, input, locale) => {
    if (name === 'read_page') {
      const parsed = readPageInput.safeParse(input);
      const page = parsed.success ? pageAt(corpus, parsed.data.link) : undefined;
      if (!parsed.success || !page) {
        return {
          isError: true,
          label: PLACEHOLDER_LABELS.read,
          content: 'Unknown page. Pass a link from the page map.',
        };
      }
      return {
        isError: false,
        label: `Reading ${page.group} › ${page.title}`,
        link: parsed.data.link,
        content: `${page.markdown}${labelTable(page, locale, labelsFor(locale), english)}`,
      };
    }
    if (name === 'search_docs') {
      const parsed = searchInput.safeParse(input);
      if (!parsed.success)
        return {
          isError: true,
          label: PLACEHOLDER_LABELS.search,
          content: 'Give a query of 1 to 200 characters.',
        };
      const hits = search(parsed.data.query, SEARCH_LIMIT);
      const label = `Searching for “${parsed.data.query}”`;
      if (hits.length === 0) return { isError: false, label, content: 'No section matches.' };
      return {
        isError: false,
        label,
        content: hits
          .map((hit, i) => {
            const url = `${pageAt(corpus, hit.link)?.url ?? ''}${hit.anchor ? `#${hit.anchor}` : ''}`;
            return `${i + 1}. ${hit.page}${hit.heading ? ` › ${hit.heading}` : ''} (${hit.link}, ${url})\n   ${hit.snippet}`;
          })
          .join('\n'),
      };
    }
    if (name === 'drawer_fit') {
      const parsed = drawerFitInput.safeParse(input);
      if (!parsed.success)
        return {
          isError: true,
          label: PLACEHOLDER_LABELS.check,
          content: 'Give widthMm and depthMm as numbers.',
        };
      const d = parsed.data;
      const unit = d.unit === 'in' ? ' in' : ' mm';
      const size = [d.widthMm, d.depthMm, d.heightMm].filter((v) => v !== undefined).join(' × ');
      return { ...runDrawerFit(d, { origin }), label: `Checking a ${size}${unit} drawer` };
    }
    if (name === 'plan_layout') {
      const parsed = planLayoutInput.safeParse(input);
      if (!parsed.success) {
        return {
          isError: true,
          label: PLACEHOLDER_LABELS.plan,
          content: parsed.error.issues
            .map((issue) => `${issue.path.join('.') || 'plan'}: ${issue.message}`)
            .join('\n'),
        };
      }
      const run = runPlanLayout(parsed.data, { origin });
      const label = parsed.data.title ? `Planning “${parsed.data.title}”` : PLACEHOLDER_LABELS.plan;
      if (run.isError || run.plan === null) return { isError: true, label, content: run.content };
      return {
        isError: false,
        label,
        content: `${run.content}\nPlan handle: ${run.plan.handle}.`,
        plan: run.plan,
      };
    }
    return { isError: true, label: 'Using a tool', content: `There is no tool named ${name}.` };
  };
}
