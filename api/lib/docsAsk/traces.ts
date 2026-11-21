import { waitUntil } from '@vercel/functions';

const CAPTURE_URL = 'https://us.i.posthog.com/i/v0/e/';
const SEND_TIMEOUT_MS = 5_000;

export interface Generation {
  readonly spanId: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly costUsd: number;
  readonly latencySeconds: number;
  readonly firstTokenSeconds: number | null;
  readonly stopReason: string | null;
  readonly text: string;
  readonly toolCalls: readonly string[];
}

export interface AskTrace {
  readonly traceId: string;
  readonly sessionId: string;
  readonly question: string;
  readonly page: string;
  readonly locale: string;
  readonly corpusVersion: string;
  readonly answer: string;
  readonly steps: readonly string[];
  readonly docGap: boolean;
  readonly latencySeconds: number;
  readonly error: string | null;
  readonly generations: readonly Generation[];
}

type Properties = Record<string, unknown>;

function send(event: string, distinctId: string, properties: Properties): void {
  const token = process.env.VITE_PUBLIC_POSTHOG_KEY;
  if (process.env.VERCEL_ENV !== 'production' || !token) return;
  waitUntil(
    fetch(CAPTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        event,
        properties: { distinct_id: distinctId, ...properties },
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    }).then(
      () => undefined,
      () => undefined
    )
  );
}

export function sendAskTrace(trace: AskTrace): void {
  const shared = { $ai_trace_id: trace.traceId, $ai_session_id: trace.sessionId };
  for (const g of trace.generations) {
    send('$ai_generation', trace.sessionId, {
      ...shared,
      $ai_span_id: g.spanId,
      $ai_parent_id: trace.traceId,
      $ai_provider: 'anthropic',
      $ai_model: g.model,
      $ai_stream: true,
      $ai_input: [{ role: 'user', content: trace.question }],
      $ai_output_choices: [{ role: 'assistant', content: g.text }],
      $ai_input_tokens: g.inputTokens,
      $ai_output_tokens: g.outputTokens,
      $ai_cache_read_input_tokens: g.cacheReadTokens,
      $ai_cache_creation_input_tokens: g.cacheWriteTokens,
      $ai_total_cost_usd: g.costUsd,
      $ai_cost_passthrough: true,
      $ai_latency: g.latencySeconds,
      ...(g.firstTokenSeconds === null ? {} : { $ai_time_to_first_token: g.firstTokenSeconds }),
      docs_ask_stop_reason: g.stopReason,
      docs_ask_tool_calls: g.toolCalls,
    });
  }
  send('$ai_trace', trace.sessionId, {
    ...shared,
    $ai_span_name: 'docs-ask',
    $ai_input_state: { question: trace.question, page: trace.page, locale: trace.locale },
    $ai_output_state: { answer: trace.answer },
    $ai_latency: trace.latencySeconds,
    $ai_is_error: trace.error !== null,
    ...(trace.error === null ? {} : { $ai_error: trace.error }),
    docs_ask_corpus_version: trace.corpusVersion,
    docs_ask_steps: trace.steps,
    docs_ask_doc_gap: trace.docGap,
    docs_ask_cost_usd: trace.generations.reduce((sum, g) => sum + g.costUsd, 0),
  });
}

export function sendAskFeedback(sessionId: string, traceId: string, value: 1 | -1): void {
  send('$ai_metric', sessionId, {
    $ai_trace_id: traceId,
    $ai_session_id: sessionId,
    $ai_metric_name: 'thumbs',
    $ai_metric_value: value,
  });
}
