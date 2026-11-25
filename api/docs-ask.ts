import { createHmac, randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgent } from './lib/docsAsk/agent.js';
import type { AgentEvent, AgentProgress, AgentResult, RoundBudget } from './lib/docsAsk/agent.js';
import { CLIENT_TOOLS } from './lib/docsAsk/clientTools.js';
import type { ClientResult } from './lib/docsAsk/clientTools.js';
import {
  askRequestSchema,
  awaitedCalls,
  feedbackRequestSchema,
  pendingMessages,
  rebuildMessages,
  resumeRequestSchema,
  turnSignature,
  turnSigned,
  userTurn,
} from './lib/docsAsk/history.js';
import type { StoredTurn } from './lib/docsAsk/history.js';
import { claimNonce, pendingCheck, pendingSignature } from './lib/docsAsk/pending.js';
import { DISCUSSIONS_URL } from './lib/docsAsk/prompt.js';
import { docsSource } from './lib/docsAsk/source.js';
import type { DocsSource } from './lib/docsAsk/source.js';
import {
  ROUND_RESERVE_USD,
  addSpend,
  dailyCapUsd,
  readSpend,
  releaseSpend,
  reserveSpend,
  spendDay,
} from './lib/docsAsk/spend.js';
import { createToolRunner, toolDefinitions } from './lib/docsAsk/tools.js';
import type { ToolRunner } from './lib/docsAsk/tools.js';
import { appOrigin } from './lib/docsAsk/origin.js';
import { sendAskFeedback, sendAskTrace } from './lib/docsAsk/traces.js';
import { logger } from './lib/logger.js';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import {
  ErrorCode,
  methodNotAllowed,
  rateLimited,
  sendError,
  serviceUnavailable,
} from './lib/shared.js';

const MAX_BODY_BYTES = 512 * 1024;

function enabled(): boolean {
  return process.env.DOCS_ASSISTANT_ENABLED === 'true' && Boolean(process.env.ANTHROPIC_API_KEY);
}

// The browser panel is same-origin, so a request from another site is a
// script spending this site's budget. Comparing with Host and not with a
// fixed list lets every domain of one deployment in, branch aliases too.
function originAllowed(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  if (process.env.VERCEL_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin))
    return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

async function resting(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return process.env.VERCEL_ENV === 'production';
  return (await readSpend(redis)) >= dailyCapUsd();
}

function logSpendError(caught: unknown): void {
  logger.error('Docs ask spend write failed', { error: String(caught) });
}

// Once a round has run, a failed spend write must not fail it, or a retry would
// ask the model again. A failed reserve fails the question before any call.
function roundBudget(): RoundBudget {
  const redis = getRedis();
  let held: string | null = null;
  return {
    async reserve() {
      if (!redis) return process.env.VERCEL_ENV !== 'production';
      const day = spendDay();
      const ok = await reserveSpend(redis, ROUND_RESERVE_USD, dailyCapUsd(), day);
      if (ok) held = day;
      return ok;
    },
    async charge(usd) {
      if (redis) await addSpend(redis, usd).catch(logSpendError);
    },
    async release() {
      if (!redis || held === null) return;
      const day = held;
      held = null;
      await releaseSpend(redis, ROUND_RESERVE_USD, day).catch(logSpendError);
    },
  };
}

function derivedKey(purpose: string): string | null {
  const salt = process.env.TOKEN_SALT;
  return salt ? createHmac('sha256', salt).update(purpose).digest('hex') : null;
}

const turnKey = (): string | null => derivedKey('docs-ask turn signature');
const pendingKey = (): string | null => derivedKey('docs-ask pending signature');

function bodyBytes(req: VercelRequest): number {
  const declared = Number(req.headers['content-length'] ?? 0);
  return Math.max(declared, Buffer.byteLength(JSON.stringify(req.body ?? null)));
}

function writeEvent(res: VercelResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handleStatus(res: VercelResponse): Promise<VercelResponse> {
  res.setHeader('Cache-Control', 'no-store');
  if (!enabled()) return res.status(200).json({ enabled: false, resting: false });
  return res.status(200).json({ enabled: true, resting: await resting() });
}

async function handleFeedback(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
  const limit = await checkRateLimit(getClientIP(req), 'docs.feedback');
  if (!limit.allowed) return rateLimited(res, limit.retryAfterSeconds);
  const body = feedbackRequestSchema.safeParse(req.body);
  if (!body.success) return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid feedback');
  if (body.data.analytics) sendAskFeedback(body.data.sessionId, body.data.traceId, body.data.value);
  return res.status(204).end();
}

interface TurnRequest {
  readonly sessionId: string;
  readonly analytics: boolean;
  readonly question: string;
  readonly page: string;
  /** The locale the docs answer in, already resolved. */
  readonly locale: string;
  readonly source: DocsSource;
  readonly run: ToolRunner;
  readonly messages: Parameters<typeof runAgent>[0]['messages'];
  /** What the turn holds from before a resume. */
  readonly earlier: {
    readonly messages: readonly unknown[];
    readonly results: readonly ClientResult[];
    readonly rounds: number;
  };
}

async function prepare(
  turns: readonly StoredTurn[],
  locale: string
): Promise<{ source: DocsSource; run: ToolRunner; history: TurnRequest['messages'] }> {
  const source = await docsSource();
  const locales = new Set([
    source.locale(locale),
    ...turns.map((turn) => source.locale(turn.locale)),
  ]);
  const tables = new Map(
    await Promise.all([...locales].map(async (code) => [code, await source.labels(code)] as const))
  );
  const run = createToolRunner(
    source.corpus,
    (code) => tables.get(code) ?? source.english,
    source.english,
    appOrigin()
  );
  const key = turnKey();
  const history = rebuildMessages(source.corpus, turns, run, source.locale, (turn) =>
    key === null ? false : turnSigned(key, turn)
  );
  return { source, run, history };
}

/**
 * Streams one request of a turn. It ends with done and the signed turn, or,
 * when the model calls a browser tool, with pending: the signed envelope that
 * the panel sends back with the reader's results.
 */
async function streamTurn(res: VercelResponse, turn: TurnRequest): Promise<undefined> {
  const { source } = turn;
  const sent: unknown[] = [...turn.earlier.messages];
  const traceId = randomUUID();
  const started = performance.now();
  const abort = new AbortController();
  // The request ended when its body was read; only the response closes when the reader leaves.
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  writeEvent(res, 'start', { traceId, corpus: source.corpus.version });

  const progress: AgentProgress = { generations: [], steps: [], links: [] };
  let error: string | null = null;
  let result: AgentResult | null = null;
  try {
    result = await runAgent({
      client: new Anthropic(),
      corpus: source.corpus,
      tools: toolDefinitions(source.corpus),
      messages: turn.messages,
      locale: turn.locale,
      run: turn.run,
      send: (event: AgentEvent) => {
        if (event.type === 'message') sent.push(event.content);
        writeEvent(res, event.type, event);
      },
      budget: roundBudget(),
      progress,
      signal: abort.signal,
      clientTools: CLIENT_TOOLS,
      firstRound: turn.earlier.rounds,
      clientResults: turn.earlier.results.length,
    });
    const fields = { question: turn.question, page: turn.page, locale: turn.locale };
    const results = turn.earlier.results;
    const key = turnKey();
    const envelopeKey = pendingKey();
    if (result.pending !== null) {
      if (envelopeKey === null) throw new Error('No key to sign a pending turn');
      const pending = {
        ...fields,
        messages: sent,
        results: [...results],
        rounds: result.pending.rounds,
        issuedAt: Date.now(),
        nonce: randomUUID(),
      };
      writeEvent(res, 'pending', {
        traceId,
        calls: result.pending.calls,
        pending: { ...pending, signature: pendingSignature(envelopeKey, pending) },
      });
    } else {
      // An empty answer, from a refusal or the cap, must not become history.
      const answered = result.answer.trim() !== '';
      const stored = { ...fields, messages: sent, ...(results.length > 0 ? { results } : {}) };
      writeEvent(res, 'done', {
        traceId,
        stopReason: result.stopReason,
        turn: {
          ...fields,
          ...(results.length > 0 ? { results } : {}),
          signature: key === null || !answered ? null : turnSignature(key, stored),
        },
      });
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    if (!abort.signal.aborted) {
      logger.error('Docs ask failed', {
        error,
        status: caught instanceof Anthropic.APIError ? caught.status : undefined,
      });
      writeEvent(res, 'error', {
        code: caught instanceof Anthropic.RateLimitError ? 'busy' : 'failed',
      });
    }
  } finally {
    res.end();
  }
  if (!turn.analytics) return undefined;
  const answer = result?.answer ?? '';
  sendAskTrace({
    traceId,
    sessionId: turn.sessionId,
    question: turn.question,
    page: turn.page,
    locale: turn.locale,
    corpusVersion: source.corpus.version,
    answer,
    steps: progress.steps,
    links: progress.links,
    docGap: answer.includes(DISCUSSIONS_URL),
    latencySeconds: (performance.now() - started) / 1000,
    error: abort.signal.aborted ? 'aborted by the reader' : error,
    generations: progress.generations,
  });
  return undefined;
}

async function handleAsk(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | undefined> {
  const limit = await checkRateLimit(getClientIP(req), 'docs.ask');
  if (!limit.allowed)
    return rateLimited(res, limit.retryAfterSeconds, 'Too many questions. Try again later.');
  const body = askRequestSchema.safeParse(req.body);
  if (!body.success) return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid question');
  if (await resting()) {
    return res.status(429).json({ error: 'Ask AI is off until tomorrow', code: 'RESTING' });
  }
  const { sessionId, question, page, turns, analytics } = body.data;
  const { source, run, history } = await prepare(turns, body.data.locale);
  const locale = source.locale(body.data.locale);
  return streamTurn(res, {
    sessionId,
    analytics,
    question,
    page,
    locale,
    source,
    run,
    messages: [...history, ...userTurn(source.corpus, question, page, locale)],
    earlier: { messages: [], results: [], rounds: 0 },
  });
}

/**
 * Goes on with a turn that waited for the reader's browser. Not counted
 * against the question limit: it continues a question that was counted, and
 * the turn's rounds and the daily spend still cap it.
 */
async function handleResume(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | undefined> {
  const body = resumeRequestSchema.safeParse(req.body);
  if (!body.success) return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid resume');
  const key = pendingKey();
  if (key === null) return serviceUnavailable(res, 'Ask AI is not available.');
  const { sessionId, pending, results, turns, analytics } = body.data;
  const check = pendingCheck(key, pending, Date.now());
  if (check === 'forged')
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid pending turn');
  if (check === 'expired')
    return res.status(410).json({ error: 'This request expired. Ask again.', code: 'EXPIRED' });
  const awaited = awaitedCalls(pending, CLIENT_TOOLS);
  const answered = new Set(results.map((result) => result.callId));
  if (
    awaited === null ||
    awaited.length === 0 ||
    answered.size !== results.length ||
    awaited.length !== results.length ||
    awaited.some((call) => !answered.has(call.id))
  ) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Give one result for each request');
  }
  if (await resting()) {
    return res.status(429).json({ error: 'Ask AI is off until tomorrow', code: 'RESTING' });
  }
  const { source, run, history } = await prepare(turns, pending.locale);
  const current = pendingMessages(source.corpus, pending, results, run, CLIENT_TOOLS);
  if (current === null) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'A result does not fit its request');
  }
  const claim = await claimNonce(
    getRedis(),
    pending.nonce,
    process.env.VERCEL_ENV === 'production',
    Date.now()
  );
  if (claim === 'unavailable') return serviceUnavailable(res, 'Ask AI cannot go on right now.');
  if (claim === 'used')
    return res.status(409).json({ error: 'This request already ran.', code: 'USED' });
  return streamTurn(res, {
    sessionId,
    analytics,
    question: pending.question,
    page: pending.page,
    locale: pending.locale,
    source,
    run,
    messages: [...history, ...current],
    earlier: {
      messages: pending.messages,
      results: [...pending.results, ...results],
      rounds: pending.rounds,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, 'GET, POST');
  try {
    if (req.method === 'GET') return await handleStatus(res);
    if (!enabled()) return serviceUnavailable(res, 'Ask AI is not available.');
    if (!originAllowed(req)) return sendError(res, 403, ErrorCode.UNAUTHORIZED, 'Wrong origin');
    if (bodyBytes(req) > MAX_BODY_BYTES) {
      return sendError(
        res,
        413,
        ErrorCode.SIZE_LIMIT,
        'The conversation is too long. Start a new chat.'
      );
    }
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
      return sendError(res, 415, ErrorCode.VALIDATION_ERROR, 'Send JSON');
    }
    const op = (req.body as { op?: unknown } | undefined)?.op;
    if (op === 'feedback') return await handleFeedback(req, res);
    if (op === 'resume') return await handleResume(req, res);
    return await handleAsk(req, res);
  } catch (error) {
    logger.error('Docs ask handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Ask AI failed');
    res.end();
  }
}
