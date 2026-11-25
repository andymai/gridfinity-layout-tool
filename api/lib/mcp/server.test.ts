import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createMcpServer, MCP_TOOL_NAMES } from './server.js';

async function listTools() {
  const server = createMcpServer('https://example.test', 'test');
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  const { tools } = await client.listTools();
  await client.close();
  return tools;
}

interface SchemaNode {
  readonly type?: string;
  readonly description?: string;
  readonly properties?: Record<string, SchemaNode>;
  readonly items?: SchemaNode;
}

/** Number fields that neither they nor their parent property describe. */
function bareNumbers(node: SchemaNode, path: string, parentDescribed: boolean): string[] {
  const fields = Object.entries(node.properties ?? {}).flatMap(([key, child]) => {
    const described = Boolean(child.description);
    const bare =
      (child.type === 'number' || child.type === 'integer') && !described && !parentDescribed;
    return [
      ...(bare ? [`${path}.${key}`] : []),
      ...bareNumbers(child, `${path}.${key}`, described),
    ];
  });
  const items = node.items ? bareNumbers(node.items, `${path}[]`, parentDescribed) : [];
  return [...fields, ...items];
}

describe('createMcpServer', () => {
  it('lists exactly the named tools, each with a title', async () => {
    const tools = await listTools();
    expect(new Set(tools.map((tool) => tool.name))).toEqual(MCP_TOOL_NAMES);
    for (const tool of tools) expect(tool.title, tool.name).toBeTruthy();
  });

  // An MCP client sees only the schema: a bare number invites millimetres
  // where the tool wants grid units.
  it('gives every number field its unit, on itself or its parent', async () => {
    const bare = (await listTools()).flatMap((tool) =>
      bareNumbers(tool.inputSchema as SchemaNode, tool.name, false)
    );
    expect(bare).toEqual([]);
  });

  it('never tells an outside agent about the docs panel', async () => {
    for (const tool of await listTools()) expect(tool.description).not.toMatch(/panel/i);
  });
});
