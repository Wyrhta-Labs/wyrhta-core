import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../src/mcp/scaffold.js';
import type { McpTool, AuthAdapter, McpPrincipal } from '../../src/mcp/types.js';

const principal: McpPrincipal = { userId: 'u1', role: 'admin' };

function echoTool(spy?: (ctx: unknown) => void): McpTool {
  return {
    name: 'echo',
    description: 'Echo a message back',
    inputSchema: { message: z.string() },
    handler: async (ctx, input) => {
      spy?.(ctx);
      return { content: [{ type: 'text', text: String(input['message']) }] };
    },
  };
}

async function connect(server: ReturnType<typeof createMcpServer>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('createMcpServer', () => {
  it('registers tools that can be listed', async () => {
    const adapter: AuthAdapter = { resolve: async () => principal };
    const client = await connect(createMcpServer([echoTool()], adapter));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('echo');
  });

  it('runs a tool through the auth adapter and returns its content', async () => {
    const resolve = vi.fn(async () => principal);
    const ctxSpy = vi.fn();
    const client = await connect(createMcpServer([echoTool(ctxSpy)], { resolve }));
    const result = await client.callTool({ name: 'echo', arguments: { message: 'hi' } });
    expect(resolve).toHaveBeenCalledOnce();
    expect((result.content as Array<{ text: string }>)[0]!.text).toBe('hi');
    expect(ctxSpy).toHaveBeenCalledWith(expect.objectContaining({ principal }));
  });

  it('returns an error result when the auth adapter rejects', async () => {
    const adapter: AuthAdapter = {
      resolve: async () => {
        throw new Error('unauthorized');
      },
    };
    const client = await connect(createMcpServer([echoTool()], adapter));
    const result = await client.callTool({ name: 'echo', arguments: { message: 'hi' } });
    expect(result.isError).toBe(true);
  });
});
