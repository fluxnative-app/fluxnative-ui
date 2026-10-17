#!/usr/bin/env node
// `fluxnative-ui-grade`: runs every deterministic screen grader on .tsx files,
// without MCP. Needs Node.js 22.15 or newer. Usage and exit codes: src/graders/cli.ts.

import { registerTypeStripping } from './launch.js';

registerTypeStripping('fluxnative-ui-grade');
const { main } = await import('./graders/cli.ts');
process.exitCode = await main(process.argv.slice(2));
