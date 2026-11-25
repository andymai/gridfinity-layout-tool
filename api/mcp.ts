import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appOrigin } from './lib/docsAsk/origin.js';
import { logger } from './lib/logger.js';
import { createMcpServer, MCP_TOOL_NAMES } from './lib/mcp/server.js';
import { clientToken, observeToolCalls, protocolVersion } from './lib/mcp/telemetry.js';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { mcpCallsKey } from './lib/redisKeys.js';
import { captureServerEvent } from './lib/serverEvents.js';

const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_DAILY_CAP = 20_000;
const DAY_SECONDS = 24 * 60 * 60;
// Events stop after this many requests in a day, so abuse cannot spend the
// PostHog event budget.
const EVENT_CEILING = 2_000;

function enabled(): boolean {
  return process.env.MCP_SERVER_ENABLED === 'true';
}

function dailyCap(): number {
  const cap = Number(process.env.MCP_DAILY_CALL_CAP);
  return Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_DAILY_CAP;
}

// MCP clients read errors as JSON-RPC, so even an HTTP refusal carries one.
function refuse(
  res: VercelResponse,
  status: number,
  message: string,
  headers: Record<string, string> = {}
): VercelResponse {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  return res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

/**
 * Counts this request against the day's cap and returns the day's count.
 * Without Redis, or when Redis fails, production counts as over the cap,
 * because the cap is what bounds the cost of a public endpoint.
 */
async function countToday(): Promise<number> {
  const closed = process.env.VERCEL_ENV === 'production' ? Number.POSITIVE_INFINITY : 1;
  const redis = getRedis();
  if (!redis) return closed;
  const key = mcpCallsKey(new Date().toISOString().slice(0, 10));
  try {
    const results = await redis
      .multi()
      .incr(key)
      .expire(key, DAY_SECONDS * 2)
      .exec();
    const count = Number(results?.[0]?.[1]);
    return Number.isFinite(count) ? count : closed;
  } catch (error) {
    logger.error('MCP daily count failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return closed;
  }
}

function bodyBytes(req: VercelRequest): number {
  const declared = Number(req.headers['content-length'] ?? 0);
  return Math.max(declared, Buffer.byteLength(JSON.stringify(req.body ?? null)));
}

/**
 * The public MCP server: stateless Streamable HTTP, with compute tools that
 * run the app's own code and keep nothing. Each request gets its own server
 * and transport, so no state outlives it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!enabled()) return refuse(res, 503, 'The Gridfinity Layout Tool MCP server is off.');
  // Stateless: no server-sent stream to open and no session to end.
  if (req.method !== 'POST') return refuse(res, 405, 'Use POST.', { Allow: 'POST, OPTIONS' });
  if (bodyBytes(req) > MAX_BODY_BYTES) return refuse(res, 413, 'The request is too large.');
  try {
    const limit = await checkRateLimit(getClientIP(req), 'mcp.call');
    if (!limit.allowed) {
      return refuse(res, 429, 'Too many calls. Try again later.', {
        'Retry-After': String(limit.retryAfterSeconds ?? 60),
      });
    }
    const count = await countToday();
    if (count > dailyCap()) {
      return refuse(res, 429, 'The server reached its calls for today. Try again tomorrow.');
    }
    const server = createMcpServer(
      appOrigin(),
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    if (count <= EVENT_CEILING) {
      const client = clientToken(req.headers['user-agent']);
      const protocol = protocolVersion(req.headers['mcp-protocol-version']);
      const requestId = crypto.randomUUID();
      observeToolCalls(transport, req.body, MCP_TOOL_NAMES, (call) =>
        captureServerEvent('mcp_tool_called', requestId, {
          tool: call.tool,
          outcome: call.outcome,
          latency_ms: call.latencyMs,
          client,
          protocol,
        })
      );
    }
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return undefined;
  } catch (error) {
    logger.error('MCP request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) return refuse(res, 500, 'The request failed.');
    res.end();
    return undefined;
  }
}
