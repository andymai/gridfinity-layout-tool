/**
 * The MCP server through the official SDK client over HTTP, so the protocol
 * path is the one a hosted client takes. Rate limits and Redis are stand-ins.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  allowed: true,
  count: 0,
  redisFails: false,
  events: [] as { event: string; properties: Record<string, unknown> }[],
}));

vi.mock('./lib/serverEvents.js', () => ({
  captureServerEvent: (event: string, _id: string, properties: Record<string, unknown>) =>
    mocks.events.push({ event, properties }),
}));

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: () => Promise.resolve({ allowed: mocks.allowed, retryAfterSeconds: 30 }),
  getClientIP: () => '203.0.113.9',
  getRedis: () => ({
    multi: () => {
      const chain = {
        incr: () => chain,
        expire: () => chain,
        exec: () =>
          mocks.redisFails
            ? Promise.reject(new Error('redis down'))
            : Promise.resolve([
                [null, ++mocks.count],
                [null, 1],
              ]),
      };
      return chain;
    },
  }),
}));

let url: URL;
let server: http.Server;

beforeAll(async () => {
  const { default: handler } = await import('./mcp.js');
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      const vreq = Object.assign(req, { body: raw ? (JSON.parse(raw) as unknown) : undefined });
      const vres = Object.assign(res, {
        status(code: number) {
          res.statusCode = code;
          return vres;
        },
        json(body: unknown) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
          return vres;
        },
      });
      void handler(vreq as unknown as VercelRequest, vres as unknown as VercelResponse);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mcp`);
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  mocks.allowed = true;
  mocks.count = 0;
  mocks.redisFails = false;
  mocks.events = [];
  vi.stubEnv('MCP_SERVER_ENABLED', 'true');
  vi.stubEnv('VERCEL_ENV', '');
});
afterEach(() => vi.unstubAllEnvs());

async function connect(): Promise<Client> {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

describe('the MCP server', () => {
  it('lists the five compute tools, each read-only, with instructions', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'bin_size_for',
      'drawer_fit',
      'plan_layout',
      'print_estimate',
      'split_plan',
    ]);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(tool.inputSchema.type).toBe('object');
    }
    expect(client.getInstructions()).toContain('plan_layout');
    await client.close();
  });

  it('runs a calculator and returns a plan with a link to open it', async () => {
    const client = await connect();
    const split = await client.callTool({
      name: 'split_plan',
      arguments: { grid: { width: 6, depth: 5 }, bed: { width: 18, unit: 'cm' } },
    });
    expect(JSON.stringify(split.content)).toContain('It splits into 4 pieces');
    const plan = await client.callTool({
      name: 'plan_layout',
      arguments: {
        grid: { width: 3, depth: 2 },
        bins: [{ label: 'M3', width: 1, depth: 1, height: 3 }],
      },
    });
    const link = (plan.content as { type: string; uri?: string }[]).find(
      (part) => part.type === 'resource_link'
    );
    expect(link?.uri).toMatch(/^https:\/\/gridfinitylayouttool\.com\/#plan=v1\./);
    await client.close();
  });

  it('answers bad input with an error that names the field', async () => {
    const client = await connect();
    const result = await client
      .callTool({
        name: 'print_estimate',
        arguments: { bins: [{ width: 1, depth: 1, height: 1 }] },
      })
      .catch((error: unknown) => ({
        isError: true,
        content: [{ type: 'text', text: String(error) }],
      }));
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/height/);
    await client.close();
  });

  it('records one event per tool call, with its outcome and no caller text', async () => {
    const client = await connect();
    await client.callTool({
      name: 'drawer_fit',
      arguments: { widthMm: 300, depthMm: 200 },
    });
    await client.callTool({ name: 'split_plan', arguments: { grid: { width: 'x' } } });
    await client.callTool({ name: 'make "me" a sandwich', arguments: {} }).catch(() => undefined);
    await client.close();
    expect(mocks.events.map((e) => [e.event, e.properties.tool, e.properties.outcome])).toEqual([
      ['mcp_tool_called', 'drawer_fit', 'ok'],
      ['mcp_tool_called', 'split_plan', 'input_error'],
      ['mcp_tool_called', 'unknown', 'tool_error'],
    ]);
    expect(mocks.events[0].properties).toMatchObject({ client: 'node', protocol: '2025-11-25' });
  });

  it('sends no events past the daily event ceiling', async () => {
    mocks.count = 2_000;
    const client = await connect();
    await client.callTool({
      name: 'drawer_fit',
      arguments: { widthMm: 300, depthMm: 200 },
    });
    await client.close();
    expect(mocks.events).toEqual([]);
  });

  it('refuses in production when the daily count fails', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    mocks.redisFails = true;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    expect(response.status).toBe(429);
  });

  it('refuses when off, on GET, over the rate limit and over the daily cap', async () => {
    const post = (): Promise<Response> =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      });
    vi.stubEnv('MCP_SERVER_ENABLED', '');
    expect((await post()).status).toBe(503);
    vi.stubEnv('MCP_SERVER_ENABLED', 'true');
    expect((await fetch(url)).status).toBe(405);
    mocks.allowed = false;
    expect((await post()).status).toBe(429);
    mocks.allowed = true;
    mocks.count = 1_000_000;
    const capped = await post();
    expect(capped.status).toBe(429);
    expect(await capped.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32000 } });
  });
});
