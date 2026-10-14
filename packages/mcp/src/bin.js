#!/usr/bin/env node
// `fluxnative-ui-mcp`: strips the TypeScript of this package, @fluxnative/catalog
// and the eval graders it imports (Node refuses to under node_modules), then
// serves over stdio. Needs Node.js 22.15 or newer.

import module from 'node:module';
import { readFileSync } from 'node:fs';

const { registerHooks, stripTypeScriptTypes } = module;
if (typeof registerHooks !== 'function' || typeof stripTypeScriptTypes !== 'function') {
  console.error(`fluxnative-ui-mcp needs Node.js 22.15 or newer; this is ${process.version}.`);
  process.exit(1);
}
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (String(warning).startsWith('stripTypeScriptTypes')) return;
  emitWarning.call(process, warning, ...rest);
};
const ours = (url) => url.includes('/packages/mcp/') || url.includes('/packages/catalog/') || url.includes('/node_modules/@fluxnative/');
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.ts') || !ours(url)) return nextLoad(url, context);
    return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')), shortCircuit: true };
  },
});

await import('./stdio.ts');
