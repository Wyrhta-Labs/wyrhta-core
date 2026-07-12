import type { z } from 'zod';

export interface McpPrincipal {
  userId: string;
  role: 'admin' | 'adult' | 'child';
}

export interface McpToolContext {
  principal: McpPrincipal;
  requestId: string;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  // MCP SDK's CallToolResult carries an index signature; mirror it so tool
  // handler returns are structurally assignable to `registerTool`.
  [key: string]: unknown;
}

export interface McpTool {
  name: string;
  description: string;
  /** Zod raw shape (object of Zod types), as `registerTool` expects. */
  inputSchema: z.ZodRawShape;
  handler: (ctx: McpToolContext, input: Record<string, unknown>) => Promise<McpToolResult>;
}

/** App-provided bridge that resolves the authenticated caller (API key → user + role). */
export interface AuthAdapter {
  resolve: () => Promise<McpPrincipal>;
}
