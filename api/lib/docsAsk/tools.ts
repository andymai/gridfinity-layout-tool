import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { pageAt } from './corpus.js';
import type { AskCorpus, AskLabels } from './corpus.js';
import {
  MAX_DRAWER_MM,
  MEASURED_MM_MAX,
  MEASURED_MM_MIN,
  MIN_DRAWER_MM,
  drawerLink,
  formatMm,
  planDrawer,
} from './drawerPlan.js';
import type { GridFit } from './drawerPlan.js';
import { localeName } from './prompt.js';
import { createSearch, pageSections } from './search.js';

export type ToolName = 'read_page' | 'search_docs' | 'drawer_fit';
export const TOOL_NAMES: readonly ToolName[] = ['read_page', 'search_docs', 'drawer_fit'];
export type StepKind = 'read' | 'search' | 'check';

export const STEP_KINDS: Readonly<Record<ToolName, StepKind>> = {
  read_page: 'read',
  search_docs: 'search',
  drawer_fit: 'check',
};

export interface ToolRun {
  readonly content: string;
  readonly isError: boolean;
  /** What the panel's step timeline shows for the call. */
  readonly label: string;
  /** The page that a read opened, for the trace. */
  readonly link?: string;
}

const MM_PER_INCH = 25.4;
const SEARCH_LIMIT = 6;

const readPageInput = z.object({ link: z.string().max(200) }).strict();
const searchInput = z.object({ query: z.string().min(1).max(200) }).strict();
const drawerInput = z
  .object({
    widthMm: z.number(),
    depthMm: z.number(),
    heightMm: z.number().optional(),
    unit: z.enum(['mm', 'in']).optional(),
  })
  .strict();

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
        properties: { query: { type: 'string', description: 'A few keywords.' } },
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
  ];
}

function labelTable(
  corpus: AskCorpus,
  link: string,
  locale: string,
  labels: AskLabels,
  english: AskLabels
): string {
  if (locale === 'en') return '';
  const rows = (pageAt(corpus, link)?.labels ?? [])
    .map((key) => [labels[key], english[key]] as const)
    .filter((row): row is readonly [string, string] => Boolean(row[0] && row[1]));
  if (rows.length === 0) return '';
  const language = localeName(locale);
  return `\n\n---\nLabels on this page, ${language} | English:\n${rows.map(([own, en]) => `- ${own} | ${en}`).join('\n')}`;
}

function describeFit(name: string, fit: GridFit): string {
  return (
    `${name}: ${fit.width} x ${fit.depth} units (${formatMm(fit.gridWidthMm)} x ${formatMm(fit.gridDepthMm)} mm), ` +
    `spare room ${formatMm(fit.freeWidthMm)} mm in width and ${formatMm(fit.freeDepthMm)} mm in depth.`
  );
}

function drawerFit(input: z.infer<typeof drawerInput>): Omit<ToolRun, 'label'> {
  const scale = input.unit === 'in' ? MM_PER_INCH : 1;
  const toMm = (value: number): number => Math.round(value * scale * 10) / 10;
  const size = {
    widthMm: toMm(input.widthMm),
    depthMm: toMm(input.depthMm),
    ...(input.heightMm === undefined ? {} : { heightMm: toMm(input.heightMm) }),
  };
  if (
    size.heightMm !== undefined &&
    !(size.heightMm >= MEASURED_MM_MIN && size.heightMm <= MEASURED_MM_MAX)
  ) {
    return {
      isError: true,
      content: `The app takes a drawer height from ${MEASURED_MM_MIN} mm to ${MEASURED_MM_MAX} mm. Leave the height out, or give one in that range.`,
    };
  }
  const plan = planDrawer(size);
  if (!plan) {
    return {
      isError: true,
      content: `The app plans drawers from ${MIN_DRAWER_MM} mm to ${MAX_DRAWER_MM} mm on each side. ${formatMm(size.widthMm)} x ${formatMm(size.depthMm)} mm is outside that range.`,
    };
  }
  const lines = [
    `Drawer: ${[size.widthMm, size.depthMm, size.heightMm]
      .filter((v) => v !== undefined)
      .map(formatMm)
      .join(' x ')} mm.`,
    describeFit('Whole-unit grid', plan.grid),
    plan.half
      ? `${describeFit('Half-unit grid', plan.half)} It needs Half-grid mode.`
      : 'A half-unit grid fits no tighter.',
  ];
  if (size.heightMm !== undefined) {
    lines.push(
      plan.stacks.length > 0
        ? `Tallest bins under ${formatMm(size.heightMm)} mm with the default baseplate: ${plan.stacks
            .map((s) =>
              s.count === 1
                ? `one bin: ${s.units} units (${formatMm(s.totalMm)} mm)`
                : `stacks of ${s.count}: ${s.units} units each (${formatMm(s.totalMm)} mm in all)`
            )
            .join('; ')}.`
        : `No bin of 2 units or more fits under ${formatMm(size.heightMm)} mm.`
    );
  }
  lines.push(`Plan this drawer in the app: ${drawerLink(size)}`);
  return { isError: false, content: lines.join('\n') };
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
  english: AskLabels
): (name: string, input: unknown, locale: string) => ToolRun {
  const search = searchFor(corpus);
  return (name, input, locale) => {
    if (name === 'read_page') {
      const parsed = readPageInput.safeParse(input);
      const page = parsed.success ? pageAt(corpus, parsed.data.link) : undefined;
      if (!parsed.success || !page) {
        return {
          isError: true,
          label: 'Opening a page',
          content: 'Unknown page. Pass a link from the page map.',
        };
      }
      return {
        isError: false,
        label: `Reading ${page.group} › ${page.title}`,
        link: parsed.data.link,
        content: `${page.markdown}${labelTable(corpus, parsed.data.link, locale, labelsFor(locale), english)}`,
      };
    }
    if (name === 'search_docs') {
      const parsed = searchInput.safeParse(input);
      if (!parsed.success)
        return {
          isError: true,
          label: 'Searching the docs',
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
      const parsed = drawerInput.safeParse(input);
      if (!parsed.success)
        return {
          isError: true,
          label: 'Checking a drawer',
          content: 'Give widthMm and depthMm as numbers.',
        };
      const d = parsed.data;
      const unit = d.unit === 'in' ? ' in' : ' mm';
      const size = [d.widthMm, d.depthMm, d.heightMm].filter((v) => v !== undefined).join(' × ');
      return { ...drawerFit(d), label: `Checking a ${size}${unit} drawer` };
    }
    return { isError: true, label: 'Using a tool', content: `There is no tool named ${name}.` };
  };
}
