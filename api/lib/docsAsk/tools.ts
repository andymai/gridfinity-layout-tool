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
  proposeChangesInput,
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
/** Which panel asks: the docs site, or the app, where Ask AI can also change a layout. */
export type Door = 'docs' | 'app';

/**
 * yours: a read of the reader's own data, in their browser.
 * change: changes to the reader's layout, which they apply in the app.
 */
export type StepKind = 'read' | 'search' | 'check' | 'plan' | 'yours' | 'change';

/** A step label as a key and its values, for a panel that shows it in the reader's language. */
export interface StepText {
  readonly key: string;
  readonly vars?: Readonly<Record<string, string>>;
}

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
  change: 'Preparing changes to your layout',
};

export const placeholderText = (kind: StepKind): StepText => ({ key: `placeholder.${kind}` });

export interface ToolRun {
  readonly content: string;
  readonly isError: boolean;
  /** What the panel's step timeline shows for the call. */
  readonly label: string;
  /** The label as a key, for a panel that translates it. */
  readonly step?: StepText;
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
const PROPOSE_CHANGES_SCHEMA = inputSchema(proposeChangesInput);

const ASKS_FIRST =
  "It runs in the reader's browser and asks them first, so they may decline. What it returns is their own data.";

// Per-call guidance lives in the tool result, not SYSTEM_PROMPT, whose bytes
// head every cached request. The `?drawer=` link stays out of it: the plan map
// is the one way into the app that an answer shows.
export const OPEN_DRAWER_HINT =
  'So the reader can open this drawer in the app: pick the one grid that you recommend, whole or half units. Call plan_layout with this drawer as the reader measured it (width, depth, the height if they gave one, and their unit), bins: [] unless they named things to store, and halfGrid: true only for the half-unit grid. In the answer, say plainly which grid you recommend and name its size, then end with the [[plan:…]] line. Write no other link to the app.';

const readPageInput = z.object({ link: z.string().max(200) }).strict();
const searchInput = z.object({ query: z.string().min(1).max(200) }).strict();

// Listed last, so the tools before it keep the bytes that both doors share.
const PROPOSE_CHANGES_TOOL: Anthropic.Beta.BetaToolUnion = {
  name: 'propose_changes',
  description:
    "Change the layout that is open in the app: add, resize, relabel, move, stash or delete bins, and add categories or layers. The panel shows the changes on the reader's layout, and they apply them with one click. One Undo reverts all of them. Read the layout with read_my_layout first and name its bins, layers and categories by the ids that it returns, or by the ref of an earlier op in the same call. Positions and sizes are in grid units from the front-left corner, as read_my_layout gives them, and heights in height units. The app checks each op as a real edit and refuses one that cannot apply, such as a bin over another bin or off the grid: fix the ops and call it again. Use it only when the reader asks you to change their layout.",
  input_schema: PROPOSE_CHANGES_SCHEMA,
};

export function toolDefinitions(
  corpus: AskCorpus,
  door: Door = 'docs'
): Anthropic.Beta.BetaToolUnion[] {
  const tools = docsTools(corpus);
  return door === 'app' ? [...tools, PROPOSE_CHANGES_TOOL] : tools;
}

function docsTools(corpus: AskCorpus): Anthropic.Beta.BetaToolUnion[] {
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
        "Run the Layout Tool's own drawer calculator. Give the inside width and depth of a drawer, and its height when known. Returns the whole-unit grid, a tighter half-unit grid when one fits, the spare room, and the tallest bins for stacks of 1, 2 and 3 with the default baseplate.",
      input_schema: inputSchema(drawerFitInput),
      eager_input_streaming: true,
    },
    {
      name: 'plan_layout',
      description:
        "Plan a whole drawer with the Layout Tool's own placement code. Give the measured drawer (or a grid size when there is no measurement) and a bin for each kind of thing to store, or no bins for the drawer alone. The app fits the grid, places the bins largest first, puts a bin on layer 2 only where bins below carry it, and sends bins that do not fit to the stash. Returns what it placed and stashed. The panel draws the plan with a button that opens it in the app, so never write a link to it.",
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
          step: placeholderText('read'),
          content: 'Unknown page. Pass a link from the page map.',
        };
      }
      return {
        isError: false,
        label: `Reading ${page.group} › ${page.title}`,
        step: { key: 'readPage', vars: { group: page.group, title: page.title } },
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
          step: placeholderText('search'),
          content: 'Give a query of 1 to 200 characters.',
        };
      const hits = search(parsed.data.query, SEARCH_LIMIT);
      const label = `Searching for “${parsed.data.query}”`;
      const step = { key: 'searchDocs', vars: { query: parsed.data.query } };
      if (hits.length === 0) return { isError: false, label, step, content: 'No section matches.' };
      return {
        isError: false,
        label,
        step,
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
          step: placeholderText('check'),
          content: 'Give widthMm and depthMm as numbers.',
        };
      const d = parsed.data;
      const unit = d.unit === 'in' ? ' in' : ' mm';
      const size = [d.widthMm, d.depthMm, d.heightMm].filter((v) => v !== undefined).join(' × ');
      const fit = runDrawerFit(d, { origin });
      return {
        isError: fit.isError,
        label: `Checking a ${size}${unit} drawer`,
        step: { key: 'checkDrawer', vars: { size: `${size}${unit}` } },
        content: fit.drawerLink === null ? fit.content : `${fit.content}\n${OPEN_DRAWER_HINT}`,
      };
    }
    if (name === 'plan_layout') {
      const parsed = planLayoutInput.safeParse(input);
      if (!parsed.success) {
        return {
          isError: true,
          label: PLACEHOLDER_LABELS.plan,
          step: placeholderText('plan'),
          content: parsed.error.issues
            .map((issue) => `${issue.path.join('.') || 'plan'}: ${issue.message}`)
            .join('\n'),
        };
      }
      const run = runPlanLayout(parsed.data, { origin });
      const label = parsed.data.title ? `Planning “${parsed.data.title}”` : PLACEHOLDER_LABELS.plan;
      const step = parsed.data.title
        ? { key: 'planNamed', vars: { title: parsed.data.title } }
        : placeholderText('plan');
      if (run.isError || run.plan === null)
        return { isError: true, label, step, content: run.content };
      return {
        isError: false,
        label,
        step,
        content: `${run.content}\nPlan handle: ${run.plan.handle}.`,
        plan: run.plan,
      };
    }
    if (name === 'split_plan' || name === 'bin_size_for' || name === 'print_estimate') {
      return runCalculator(name, input);
    }
    return {
      isError: true,
      label: 'Using a tool',
      step: { key: 'useTool' },
      content: `There is no tool named ${name}.`,
    };
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
        step: { key: 'splitPlate' },
        content: fieldErrors(parsed.error.issues),
      };
    }
    const { grid } = parsed.data;
    return {
      ...runSplitPlan(parsed.data),
      label: `Splitting a ${grid.width} × ${grid.depth} baseplate`,
      step: { key: 'splitGrid', vars: { width: String(grid.width), depth: String(grid.depth) } },
    };
  }
  if (name === 'bin_size_for') {
    const parsed = binSizeForInput.safeParse(input);
    if (!parsed.success) {
      return {
        isError: true,
        label: 'Looking up bin sizes',
        step: { key: 'binSizes' },
        content: fieldErrors(parsed.error.issues),
      };
    }
    return {
      ...runBinSizeFor(parsed.data),
      label: 'Looking up bin sizes',
      step: { key: 'binSizes' },
    };
  }
  const parsed = printEstimateInput.safeParse(input);
  if (!parsed.success) {
    return {
      isError: true,
      label: 'Estimating a print',
      step: { key: 'printEstimate' },
      content: fieldErrors(parsed.error.issues),
    };
  }
  return {
    ...runPrintEstimate(parsed.data),
    label: 'Estimating a print',
    step: { key: 'printEstimate' },
  };
}
