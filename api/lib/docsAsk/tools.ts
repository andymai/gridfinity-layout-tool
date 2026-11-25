import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { pageAt } from './corpus.js';
import type { AskCorpus, AskLabels, AskPage } from './corpus.js';
import {
  binSizeForInput,
  drawerFitInput,
  listMyLayoutsInput,
  planLayoutInput,
  printEstimateInput,
  readMyLayoutInput,
  readMySettingsInput,
  runBinSizeFor,
  runDrawerFit,
  runPlanLayout,
  runPrintEstimate,
  runSplitPlan,
  splitPlanInput,
} from '../agent/index.js';
import type { PlanView } from '../agent/index.js';
import { localeName } from './prompt.js';
import { createSearch, pageSections } from './search.js';

export type ToolName =
  | 'read_page'
  | 'search_docs'
  | 'drawer_fit'
  | 'plan_layout'
  | 'split_plan'
  | 'bin_size_for'
  | 'print_estimate';
export const TOOL_NAMES: readonly ToolName[] = [
  'read_page',
  'search_docs',
  'drawer_fit',
  'plan_layout',
  'split_plan',
  'bin_size_for',
  'print_estimate',
];
/** yours: a read of the reader's own data, in their browser. */
export type StepKind = 'read' | 'search' | 'check' | 'plan' | 'yours';

export const STEP_KINDS: Readonly<Record<ToolName, StepKind>> = {
  read_page: 'read',
  search_docs: 'search',
  drawer_fit: 'check',
  plan_layout: 'plan',
  split_plan: 'check',
  bin_size_for: 'check',
  print_estimate: 'check',
};

export const PLACEHOLDER_LABELS: Readonly<Record<StepKind, string>> = {
  read: 'Opening a page',
  search: 'Searching the docs',
  check: 'Checking a drawer',
  plan: 'Planning a drawer',
  yours: 'Asking to read your data',
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

function inputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { io: 'input' });
  return rest as Anthropic.Beta.BetaTool.InputSchema;
}
const PLAN_LAYOUT_SCHEMA = inputSchema(planLayoutInput);

const ASKS_FIRST =
  "It runs in the reader's browser and asks them first, so they may decline. What it returns is their own data.";

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
      input_schema: inputSchema(drawerFitInput),
      eager_input_streaming: true,
    },
    {
      name: 'plan_layout',
      description:
        "Plan a whole drawer with the Layout Tool's own placement code. Give the measured drawer (or a grid size when there is no measurement) and a bin for each kind of thing to store. The app fits the grid, places the bins largest first, puts a bin on layer 2 only where bins below carry it, and sends bins that do not fit to the stash. Returns what it placed and stashed. The panel draws the plan with a button that opens it in the app, so never write a link to it.",
      input_schema: PLAN_LAYOUT_SCHEMA,
      eager_input_streaming: true,
    },
    {
      name: 'split_plan',
      description:
        "Split a baseplate for a print bed with the baseplate generator's own planner. Give the grid in units and the bed size. Returns whether the default plate prints in one piece, or its pieces, columns, rows and bed loads. Use it for every question about a baseplate on a printer.",
      input_schema: inputSchema(splitPlanInput),
    },
    {
      name: 'bin_size_for',
      description:
        'Look up the bin size that makers most often gave bins with each label in the app, such as "M3 screws". It is a habit, not a fact about the item: use it as a starting point when you size bins for plan_layout, and size from the item when a label has no common size.',
      input_schema: inputSchema(binSizeForInput),
    },
    {
      name: 'print_estimate',
      description:
        "Estimate filament, print time and filament cost for standard bins with the bin designer's own estimate. Give each bin's size in grid units and height units, and a count. Pass the reader's printer settings when read_my_settings returned them. The baseplate is not included.",
      input_schema: inputSchema(printEstimateInput),
    },
    {
      name: 'list_my_layouts',
      description: `List the reader's own saved layouts, most recent first: the name, the id, the grid size, and the bin and layer counts, with the one open in the app marked. Use it to find which layout the reader means. ${ASKS_FIRST}`,
      input_schema: inputSchema(listMyLayoutsInput),
    },
    {
      name: 'read_my_layout',
      description: `Read one of the reader's own layouts: its grid, measured drawer, print bed, magnets, layers, free cells on layer 1, each bin with its place, size, height, category and items, and the bins in the stash. Without layoutId it reads the layout open in the app. ${ASKS_FIRST}`,
      input_schema: inputSchema(readMyLayoutInput),
    },
    {
      name: 'read_my_settings',
      description: `Read the reader's own unit and printer settings: the unit they measure in, their default print bed, the grid and height units, the nozzle, the layer height and the tallest print. ${ASKS_FIRST}`,
      input_schema: inputSchema(readMySettingsInput),
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
    if (name === 'split_plan' || name === 'bin_size_for' || name === 'print_estimate') {
      return runCalculator(name, input);
    }
    return { isError: true, label: 'Using a tool', content: `There is no tool named ${name}.` };
  };
}

function fieldErrors(issues: readonly z.core.$ZodIssue[]): string {
  return issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('\n');
}

function runCalculator(
  name: 'split_plan' | 'bin_size_for' | 'print_estimate',
  input: unknown
): ToolRun {
  if (name === 'split_plan') {
    const parsed = splitPlanInput.safeParse(input);
    if (!parsed.success) {
      return {
        isError: true,
        label: 'Splitting a baseplate',
        content: fieldErrors(parsed.error.issues),
      };
    }
    const { grid } = parsed.data;
    return {
      ...runSplitPlan(parsed.data),
      label: `Splitting a ${grid.width} × ${grid.depth} baseplate`,
    };
  }
  if (name === 'bin_size_for') {
    const parsed = binSizeForInput.safeParse(input);
    if (!parsed.success) {
      return {
        isError: true,
        label: 'Looking up bin sizes',
        content: fieldErrors(parsed.error.issues),
      };
    }
    return { ...runBinSizeFor(parsed.data), label: 'Looking up bin sizes' };
  }
  const parsed = printEstimateInput.safeParse(input);
  if (!parsed.success) {
    return {
      isError: true,
      label: 'Estimating a print',
      content: fieldErrors(parsed.error.issues),
    };
  }
  return { ...runPrintEstimate(parsed.data), label: 'Estimating a print' };
}
