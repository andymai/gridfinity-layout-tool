import { createHmac, randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAgent } from './lib/docsAsk/agent.js';
import type { AgentEvent, AgentProgress, RoundBudget } from './lib/docsAsk/agent.js';
import {
  askRequestSchema,
  feedbackRequestSchema,
  rebuildMessages,
  turnSignature,
  turnSigned,
  userTurn,
} from './lib/docsAsk/history.js';
import { DISCUSSIONS_URL } from './lib/docsAsk/prompt.js';
import { docsSource } from './lib/docsAsk/source.js';
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

// A failed spend write must not fail the round: the retry would ask the model again.
function roundBudget(): RoundBudget {
  const redis = getRedis();
  let held: string | null = null;
  return {
    async reserve() {
      if (!redis) return process.env.VERCEL_ENV !== 'production';
      const day = spendDay();
      const ok = await reserveSpend(redis, ROUND_RESERVE_USD, dailyCapUsd(), day).catch(
        (caught: unknown) => {
          logSpendError(caught);
          return false;
        }
      );
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

/** Null without TOKEN_SALT: then no turn is signed, and each question stands alone. */
function turnKey(): string | null {
  const salt = process.env.TOKEN_SALT;
  return salt ? createHmac('sha256', salt).update('docs-ask turn signature').digest('hex') : null;
}

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

  const source = await docsSource();
  const { sessionId, question, page, turns } = body.data;
  const locale = source.locale(body.data.locale);
  const locales = new Set([locale, ...turns.map((turn) => source.locale(turn.locale))]);
  const tables = new Map(
    await Promise.all([...locales].map(async (code) => [code, await source.labels(code)] as const))
  );
  const run = createToolRunner(
    source.corpus,
    (code) => tables.get(code) ?? source.english,
    source.english
  );
  const key = turnKey();
  const messages = [
    ...rebuildMessages(source.corpus, turns, run, source.locale, (turn) =>
      key === null ? false : turnSigned(key, turn)
    ),
    ...userTurn(source.corpus, question, page, locale),
  ];
  const sent: unknown[] = [];

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
  let result: Awaited<ReturnType<typeof runAgent>> | null = null;
  try {
    result = await runAgent({
      client: new Anthropic(),
      corpus: source.corpus,
      tools: toolDefinitions(source.corpus),
      messages,
      locale,
      run,
      send: (event: AgentEvent) => {
        if (event.type === 'message') sent.push(event.content);
        writeEvent(res, event.type, event);
      },
      budget: roundBudget(),
      progress,
      signal: abort.signal,
    });
    const turn = { question, page, locale };
    writeEvent(res, 'done', {
      traceId,
      stopReason: result.stopReason,
      turn: {
        ...turn,
        signature: key === null ? null : turnSignature(key, { ...turn, messages: sent }),
      },
    });
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
  if (!body.data.analytics) return undefined;
  sendAskTrace({
    traceId,
    sessionId,
    question,
    page,
    locale,
    corpusVersion: source.corpus.version,
    answer: result?.answer ?? '',
    steps: progress.steps,
    docGap: (result?.answer ?? '').includes(DISCUSSIONS_URL),
    latencySeconds: (performance.now() - started) / 1000,
    error: abort.signal.aborted ? 'aborted by the reader' : error,
    generations: progress.generations,
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
    return await handleAsk(req, res);
  } catch (error) {
    logger.error('Docs ask handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Ask AI failed');
    res.end();
  }
}
