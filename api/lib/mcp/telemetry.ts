import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
} from '@modelcontextprotocol/sdk/types.js';
import type { RequestId } from '@modelcontextprotocol/sdk/types.js';

export type ToolCallOutcome = 'ok' | 'input_error' | 'tool_error' | 'protocol_error';

export interface ToolCallRecord {
  readonly tool: string;
  readonly outcome: ToolCallOutcome;
  readonly latencyMs: number;
}

// The SDK's text for a schema failure, after its `MCP error -32602: ` prefix.
const INPUT_ERROR = /^(?:MCP error -?\d+: )?Input validation error/;

function outcomeOf(message: unknown): ToolCallOutcome {
  if (isJSONRPCErrorResponse(message)) return 'protocol_error';
  if (!isJSONRPCResultResponse(message) || message.result.isError !== true) return 'ok';
  const content = message.result.content;
  const first = Array.isArray(content) ? (content[0] as { text?: unknown } | undefined) : undefined;
  return typeof first?.text === 'string' && INPUT_ERROR.test(first.text)
    ? 'input_error'
    : 'tool_error';
}

/**
 * Reports each `tools/call` in a request body once its response goes out.
 * The SDK answers bad input and unknown tools inside its own handler, so the
 * transport's outgoing side is the one place that sees every outcome.
 * A tool name outside `knownTools` is reported as `unknown`, because the
 * name is caller input.
 */
export function observeToolCalls(
  transport: Transport,
  body: unknown,
  knownTools: ReadonlySet<string>,
  onCall: (record: ToolCallRecord) => void
): void {
  const pending = new Map<RequestId, { tool: string; start: number }>();
  for (const message of Array.isArray(body) ? body : [body]) {
    if (!isJSONRPCRequest(message) || message.method !== 'tools/call') continue;
    const name = message.params?.name;
    const tool = typeof name === 'string' && knownTools.has(name) ? name : 'unknown';
    pending.set(message.id, { tool, start: performance.now() });
  }
  if (pending.size === 0) return;

  const send = transport.send.bind(transport);
  transport.send = (message, options) => {
    const id = 'id' in message ? message.id : undefined;
    const call = id === undefined ? undefined : pending.get(id);
    if (id !== undefined && call) {
      pending.delete(id);
      onCall({
        tool: call.tool,
        outcome: outcomeOf(message),
        latencyMs: Math.round(performance.now() - call.start),
      });
    }
    return send(message, options);
  };
}

/** The product token of a User-Agent, such as `python-httpx/0.28.1`, or `other`. */
export function clientToken(userAgent: string | undefined): string {
  const match = /^[A-Za-z][\w.-]{0,39}(?:\/[\w.-]{1,20})?/.exec(userAgent ?? '');
  return match ? match[0] : 'other';
}

/** The negotiated protocol version header, when it has the date form. */
export function protocolVersion(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
