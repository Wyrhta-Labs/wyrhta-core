import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logEvent, logError } from '../lib/logger.js';
import type { AuthAdapter, McpTool } from './types.js';

/**
 * Assemble an MCP server from a tool registry. Every tool call runs through the
 * same auth (`authAdapter.resolve`) and the same audit logger as REST, then
 * delegates to the tool's handler with a typed context.
 */
export function createMcpServer(
  registry: McpTool[],
  authAdapter: AuthAdapter,
  info: { name: string; version: string } = { name: '@wyrhta/core', version: '0.1.0' }
): McpServer {
  const server = new McpServer(info);

  for (const tool of registry) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (input: Record<string, unknown>) => {
        const requestId = randomUUID();
        try {
          const principal = await authAdapter.resolve();
          logEvent({
            event: 'mcp.tool.call',
            request_id: requestId,
            tool: tool.name,
            user_id: principal.userId,
          });
          return await tool.handler({ principal, requestId }, input);
        } catch (error) {
          logError(`mcp tool ${tool.name} failed`, error);
          return {
            content: [{ type: 'text' as const, text: 'Unauthorized or tool error' }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
