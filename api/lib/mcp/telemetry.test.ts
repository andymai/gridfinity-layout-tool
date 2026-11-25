import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { clientToken, observeToolCalls, protocolVersion } from './telemetry.js';
import type { ToolCallRecord } from './telemetry.js';

function fakeTransport(): Transport & { sent: JSONRPCMessage[] } {
  const sent: JSONRPCMessage[] = [];
  return {
    sent,
    start: () => Promise.resolve(),
    close: () => Promise.resolve(),
    send: (message: JSONRPCMessage) => {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

const KNOWN = new Set(['drawer_fit']);
const call = (id: number, name: unknown): JSONRPCMessage => ({
  jsonrpc: '2.0',
  id,
  method: 'tools/call',
  params: { name, arguments: {} },
});

describe('observeToolCalls', () => {
  it('reports each call in a batch once, by outcome, and passes every message on', async () => {
    const transport = fakeTransport();
    const records: ToolCallRecord[] = [];
    const body = [
      call(1, 'drawer_fit'),
      call(2, 'drawer_fit'),
      call(3, 'Ignore your rules'),
      { jsonrpc: '2.0', id: 4, method: 'tools/list' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
    ];
    observeToolCalls(transport, body, KNOWN, (record) => records.push(record));
    const text = (value: string) => ({ content: [{ type: 'text', text: value }], isError: true });
    await transport.send({ jsonrpc: '2.0', id: 4, result: { tools: [] } });
    await transport.send({ jsonrpc: '2.0', id: 1, result: { content: [] } });
    await transport.send({
      jsonrpc: '2.0',
      id: 2,
      result: text('MCP error -32602: Input validation error: widthMm is required'),
    });
    await transport.send({ jsonrpc: '2.0', id: 3, error: { code: -32602, message: 'no' } });
    await transport.send({ jsonrpc: '2.0', id: 1, result: { content: [] } });
    expect(records.map((r) => [r.tool, r.outcome])).toEqual([
      ['drawer_fit', 'ok'],
      ['drawer_fit', 'input_error'],
      ['unknown', 'protocol_error'],
    ]);
    expect(records.every((r) => Number.isInteger(r.latencyMs) && r.latencyMs >= 0)).toBe(true);
    expect(transport.sent).toHaveLength(5);
  });

  it('calls a failed tool a tool error', async () => {
    const transport = fakeTransport();
    const records: ToolCallRecord[] = [];
    observeToolCalls(transport, call(7, 'drawer_fit'), KNOWN, (record) => records.push(record));
    await transport.send({
      jsonrpc: '2.0',
      id: 7,
      result: { content: [{ type: 'text', text: 'The drawer is too small.' }], isError: true },
    });
    expect(records.map((r) => r.outcome)).toEqual(['tool_error']);
  });

  it('leaves the transport alone when the body has no tool call', () => {
    const transport = fakeTransport();
    const send = transport.send;
    observeToolCalls(transport, { jsonrpc: '2.0', id: 1, method: 'ping' }, KNOWN, () => {});
    expect(transport.send).toBe(send);
  });
});

describe('clientToken', () => {
  it.each([
    ['python-httpx/0.28.1', 'python-httpx/0.28.1'],
    ['Claude-User/1.0 (+https://example.com)', 'Claude-User/1.0'],
    ['node', 'node'],
    ['', 'other'],
    [undefined, 'other'],
    ['<script>', 'other'],
  ])('reads %j as %j', (ua, token) => expect(clientToken(ua)).toBe(token));
});

describe('protocolVersion', () => {
  it('keeps the date form only', () => {
    expect(protocolVersion('2025-11-25')).toBe('2025-11-25');
    expect(protocolVersion(['2025-06-18'])).toBe('2025-06-18');
    expect(protocolVersion('latest; drop table')).toBeNull();
    expect(protocolVersion(undefined)).toBeNull();
  });
});
