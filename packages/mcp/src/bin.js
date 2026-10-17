#!/usr/bin/env node
// `fluxnative-ui-mcp`: serves the MCP tools over stdio. Needs Node.js 22.15 or newer.
// `--version` and `--doctor` answer and exit instead: src/lane.ts.

import { registerTypeStripping } from './launch.js';

registerTypeStripping('fluxnative-ui-mcp');
const { laneCommand } = await import('./lane.ts');
const lane = await laneCommand('fluxnative-ui-mcp', process.argv.slice(2));
if (lane !== null) process.exitCode = lane;
else await import('./stdio.ts');
