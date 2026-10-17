// Shared by the package's bins: strips the TypeScript of this package,
// @fluxnative/catalog and the eval graders it imports (Node refuses to under
// node_modules). Needs Node.js 22.15 or newer.

import module from 'node:module';
import { readFileSync } from 'node:fs';

/** Registers the type-stripping loader, or prints why it can't and exits 1. */
export function registerTypeStripping(bin) {
  const { registerHooks, stripTypeScriptTypes } = module;
  if (typeof registerHooks !== 'function' || typeof stripTypeScriptTypes !== 'function') {
    const reason = `${bin} needs Node.js 22.15 or newer; this is ${process.version}.`;
    // `--doctor` reports in its own shape even here, where its module cannot load (lane.ts).
    if (process.argv.includes('--doctor')) {
      const check = { name: 'node', ok: false, detail: `Node ${process.versions.node} is too old: the kit needs 22.15 or newer` };
      if (process.argv.includes('--json')) console.log(JSON.stringify({ ready: false, kit: null, checks: [check] }, null, 2));
      else console.log(`FAIL node: ${check.detail}\nnot ready: node failed`);
    } else console.error(reason);
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
}
