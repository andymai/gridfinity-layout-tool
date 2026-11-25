import { z } from 'zod';
import {
  formatMyLayouts,
  formatMySettings,
  formatReadMyLayout,
  myLayoutsData,
  mySettingsData,
  readMyLayoutData,
} from '../agent/index.js';
import type { MyLayoutsData, MySettingsData, ReadMyLayoutData } from '../agent/index.js';
import type { StepKind, ToolRun } from './tools.js';

/**
 * A tool that the reader's browser runs on their own data once they allow it.
 * The browser sends structured data. This side checks it against the tool's
 * schema and writes the text that the model reads, so no text from the
 * browser reaches the model outside a checked field.
 */
export interface ClientTool {
  readonly kind: StepKind;
  /** The step label, also while the panel waits for the reader. */
  label(input: unknown): string;
  readonly output: z.ZodType;
  format(data: unknown, input: unknown): string;
}

export type ClientTools = ReadonlyMap<string, ClientTool>;

export const CLIENT_TOOLS: ClientTools = new Map<string, ClientTool>([
  [
    'list_my_layouts',
    {
      kind: 'yours',
      label: () => 'Listing your layouts',
      output: myLayoutsData,
      format: (data) => formatMyLayouts(data as MyLayoutsData),
    },
  ],
  [
    'read_my_layout',
    {
      kind: 'yours',
      label: () => 'Reading your layout',
      output: readMyLayoutData,
      format: (data) => formatReadMyLayout(data as ReadMyLayoutData),
    },
  ],
  [
    'read_my_settings',
    {
      kind: 'yours',
      label: () => 'Reading your printer settings',
      output: mySettingsData,
      format: (data) => formatMySettings(data as MySettingsData),
    },
  ],
]);

export const MAX_CLIENT_RESULTS = 16;

export const OVER_LIMIT_CONTENT =
  "This turn reached its limit of reads of the reader's data. Answer with what you have.";

/**
 * A round whose browser calls would take the turn past MAX_CLIENT_RESULTS
 * asks the reader nothing: the server answers each call with the over-limit
 * error. The live loop and a rebuild apply this rule at the same places, so
 * a stored turn never holds more results than a request may carry.
 */
export function overClientLimit(answered: number, calls: number): boolean {
  return answered + calls > MAX_CLIENT_RESULTS;
}
const MAX_RESULT_BYTES = 32 * 1024;

export const clientResultSchema = z.discriminatedUnion('status', [
  z
    .object({ callId: z.string().max(200), status: z.literal('shared'), data: z.unknown() })
    .strict(),
  z.object({ callId: z.string().max(200), status: z.literal('declined') }).strict(),
  z.object({ callId: z.string().max(200), status: z.literal('unavailable') }).strict(),
]);
export type ClientResult = z.infer<typeof clientResultSchema>;

export const DECLINED_CONTENT = 'The reader chose not to share this. Answer without it.';
export const UNAVAILABLE_CONTENT =
  "The reader's browser could not read this data, for example in a private window. Answer without it.";

export function clientRun(tool: ClientTool, input: unknown, result: ClientResult): ToolRun | null {
  const label = tool.label(input);
  if (result.status === 'declined') return { isError: false, label, content: DECLINED_CONTENT };
  if (result.status === 'unavailable')
    return { isError: true, label, content: UNAVAILABLE_CONTENT };
  if (Buffer.byteLength(JSON.stringify(result.data ?? null)) > MAX_RESULT_BYTES) return null;
  const parsed = tool.output.safeParse(result.data);
  if (!parsed.success) return null;
  return { isError: false, label, content: tool.format(parsed.data, input) };
}
