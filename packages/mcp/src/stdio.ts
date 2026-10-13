// Serve over stdio: what an MCP client (Claude Code, Cursor, Codex) spawns.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.ts';

const server = createServer();
await server.connect(new StdioServerTransport());
