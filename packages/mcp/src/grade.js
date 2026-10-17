#!/usr/bin/env node
// `fluxnative-ui-grade`: runs every deterministic screen grader on .tsx files,
// without MCP. Needs Node.js 22.15 or newer. Usage and exit codes: src/graders/cli.ts;
// `--version` and `--doctor`: src/lane.ts.

import { registerTypeStripping } from './launch.js';

registerTypeStripping('fluxnative-ui-grade');
const argv = process.argv.slice(2);
// lane.ts imports only Node builtins: --doctor must still answer when the dependencies are missing.
const { enterCallerCwd, laneCommand } = await import('./lane.ts');
const lane = await laneCommand('fluxnative-ui-grade', argv);
if (lane !== null) process.exitCode = lane;
else {
  enterCallerCwd();
  const { main } = await import('./graders/cli.ts');
  process.exitCode = await main(argv);
}
