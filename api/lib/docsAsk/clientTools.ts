import { z } from 'zod';
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

export const CLIENT_TOOLS: ClientTools = new Map();

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
]);
export type ClientResult = z.infer<typeof clientResultSchema>;

export const DECLINED_CONTENT = 'The reader chose not to share this. Answer without it.';

export function clientRun(tool: ClientTool, input: unknown, result: ClientResult): ToolRun | null {
  const label = tool.label(input);
  if (result.status === 'declined') return { isError: false, label, content: DECLINED_CONTENT };
  if (Buffer.byteLength(JSON.stringify(result.data ?? null)) > MAX_RESULT_BYTES) return null;
  const parsed = tool.output.safeParse(result.data);
  if (!parsed.success) return null;
  return { isError: false, label, content: tool.format(parsed.data, input) };
}
