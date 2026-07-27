import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logEvent, logError } from '../lib/logger.js';
import type { AuthAdapter, McpTool } from './types.js';

/**
 * Downstream tool handlers signal domain errors by throwing a bare `Error`
 * whose message is an UPPER_SNAKE_CASE code (e.g. `throw new Error('NOT_FOUND')`,
 * `throw new Error('CONFLICT')`). Only messages matching this shape are safe to
 * surface to MCP clients; anything else (raw DB errors, Zod internals, stack
 * traces) stays generic.
 */
const DOMAIN_ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

function toolErrorText(error: unknown): string {
  if (error instanceof Error && DOMAIN_ERROR_CODE.test(error.message)) {
    return error.message;
  }
  return 'tool error';
}

/**
 * Assemble an MCP server from a tool registry. Every tool call runs through the
 * same auth (`authAdapter.resolve`) and the same audit logger as REST, then
 * delegates to the tool's handler with a typed context.
 */
export function createMcpServer(
  registry: McpTool[],
  authAdapter: AuthAdapter,
  info: { name: string; version: string } = { name: '@wyrhta/core', version: '0.1.3' }
): McpServer {
  const server = new McpServer(info);

  for (const tool of registry) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (input: Record<string, unknown>) => {
        const requestId = randomUUID();

        // Auth failures must stay generic — never leak why resolution failed.
        let principal;
        try {
          principal = await authAdapter.resolve();
        } catch (error) {
          logError(`mcp tool ${tool.name} failed`, error);
          return {
            content: [{ type: 'text' as const, text: 'Unauthorized or tool error' }],
            isError: true,
          };
        }

        logEvent({
          event: 'mcp.tool.call',
          request_id: requestId,
          tool: tool.name,
          user_id: principal.userId,
        });

        try {
          return await tool.handler({ principal, requestId }, input);
        } catch (error) {
          logError(`mcp tool ${tool.name} failed`, error);
          return {
            content: [{ type: 'text' as const, text: toolErrorText(error) }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
