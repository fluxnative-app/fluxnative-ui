#!/usr/bin/env node
// `fluxnative-ui-mcp`: serves the MCP tools over stdio. Needs Node.js 22.15 or newer.

import { registerTypeStripping } from './launch.js';

registerTypeStripping('fluxnative-ui-mcp');
await import('./stdio.ts');
