// What an agent lane or a template gate asks the kit before it relies on it:
// `--version` (which kit is this, down to the commit, so a gate can prove it
// ran the pinned one) and `--doctor` (can it run here: Node, the installed
// dependencies the typecheck needs, an MCP server that answers `initialize`).
// Both bins take the two flags. Only Node builtins are imported, so the
// doctor still runs, and names what is missing, when `pnpm install` was not.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** packages/mcp, or node_modules/@fluxnative/ui-mcp when installed from npm. */
export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MCP_BIN = join(PACKAGE_DIR, 'src', 'bin.js');
/** `registerHooks` and `stripTypeScriptTypes`, which the bins load the kit's TypeScript with, arrived in 22.15. */
export const NODE_MIN: readonly [number, number] = [22, 15];

export interface KitInfo {
  version: string;
  /** The kit checkout's `HEAD`, or null when the package is not inside a git checkout of this repository (installed from npm). */
  commit: string | null;
}

/** Runs `git <args>` in `cwd` and returns its trimmed stdout, or null when git is missing or fails. */
export type Git = (args: string[], cwd: string) => string | null;

const realGit: Git = (args, cwd) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

export interface KitInfoProbes {
  packageDir?: string;
  git?: Git;
}

export function kitInfo(probes: KitInfoProbes = {}): KitInfo {
  const packageDir = probes.packageDir ?? PACKAGE_DIR;
  const git = probes.git ?? realGit;
  let version = 'unknown';
  try {
    const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as { version?: unknown };
    if (typeof pkg.version === 'string') version = pkg.version;
  } catch {
    // reported as "unknown"
  }
  return { version, commit: kitCommit(packageDir, git) };
}

function kitCommit(packageDir: string, git: Git): string | null {
  // Installed from npm: any git repository around it is the user's, not the kit's.
  if (packageDir.split(sep).includes('node_modules')) return null;
  const top = git(['rev-parse', '--show-toplevel'], packageDir);
  if (top === null || top === '') return null;
  // The package must be this repository's packages/mcp, not a copy vendored into another repository.
  if (!sameFile(join(top, 'packages', 'mcp', 'package.json'), join(packageDir, 'package.json'))) return null;
  const head = git(['rev-parse', 'HEAD'], packageDir);
  return head !== null && /^[0-9a-f]{40,64}$/.test(head) ? head : null;
}

function sameFile(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

export interface Check {
  name: 'node' | 'deps' | 'mcp';
  ok: boolean;
  detail: string;
}

export interface DoctorReport {
  ready: boolean;
  kit: KitInfo;
  checks: Check[];
}

export interface DoctorProbes extends KitInfoProbes {
  /** `process.versions.node` unless a test says otherwise. */
  nodeVersion?: string;
  /** `existsSync` unless a test says otherwise; the dependency check asks it for each `package.json`. */
  exists?: (path: string) => boolean;
  /** Starts the MCP server and sends `initialize`; resolves to null when it answered, or why not. */
  mcpInitialize?: () => Promise<string | null>;
}

/** What the MCP server needs to start, resolved from packages/mcp the way Node resolves it. */
export const MCP_DEPENDENCIES = ['@fluxnative/catalog', '@modelcontextprotocol/sdk', 'typescript', 'zod'] as const;
/** What the typecheck grader links into its scaffold from the catalog's own node_modules (`Typechecker`). */
export const TYPECHECK_DEPENDENCIES = ['react', 'react-native', '@types/react'] as const;

export async function doctor(probes: DoctorProbes = {}): Promise<DoctorReport> {
  const packageDir = probes.packageDir ?? PACKAGE_DIR;
  const exists = probes.exists ?? existsSync;
  const checks: Check[] = [nodeCheck(probes.nodeVersion ?? process.versions.node), depsCheck(packageDir, exists)];
  const initialize = probes.mcpInitialize ?? (() => mcpInitialize());
  const failed = await initialize();
  checks.push({ name: 'mcp', ok: failed === null, detail: failed ?? 'the MCP server started over stdio and answered initialize' });
  return { ready: checks.every((c) => c.ok), kit: kitInfo(probes), checks };
}

function nodeCheck(version: string): Check {
  const [major = NaN, minor = NaN] = version.replace(/^v/, '').split('.').map(Number);
  const [needMajor, needMinor] = NODE_MIN;
  const ok = major > needMajor || (major === needMajor && minor >= needMinor);
  const need = `${needMajor}.${needMinor}`;
  return { name: 'node', ok, detail: ok ? `Node ${version} (needs ${need} or newer)` : `Node ${version} is too old: the kit needs ${need} or newer` };
}

function depsCheck(packageDir: string, exists: (path: string) => boolean): Check {
  const missing: string[] = [];
  for (const dep of MCP_DEPENDENCIES) {
    if (findPackage(dep, packageDir, exists) === null) missing.push(`${dep} (for the MCP server)`);
  }
  const catalog = findPackage('@fluxnative/catalog', packageDir, exists);
  if (catalog !== null) {
    const modules = join(catalog, 'node_modules');
    for (const dep of TYPECHECK_DEPENDENCIES) {
      if (!exists(join(modules, dep, 'package.json'))) missing.push(`${dep} (for the typecheck, under ${modules})`);
    }
  }
  if (missing.length === 0) return { name: 'deps', ok: true, detail: `installed: ${[...MCP_DEPENDENCIES, ...TYPECHECK_DEPENDENCIES].join(', ')}` };
  return { name: 'deps', ok: false, detail: `not installed: ${missing.join('; ')}. Run \`pnpm install --frozen-lockfile\` in the kit checkout` };
}

/** The package folder Node would resolve `name` to from `from`, walking up node_modules folders. */
function findPackage(name: string, from: string, exists: (path: string) => boolean): string | null {
  let dir = from;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (exists(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fluxnative-ui-doctor', version: '1' } },
};

/** Spawns `node src/bin.js`, sends `initialize` and waits for its answer; null when it came. */
export function mcpInitialize(timeoutMs = 20_000, bin = MCP_BIN): Promise<string | null> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [bin], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (reason: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolvePromise(reason);
    };
    const tail = () => {
      const text = stderr.trim().split('\n').slice(-3).join(' ').trim();
      return text === '' ? '' : `: ${text}`;
    };
    const timer = setTimeout(() => finish(`the MCP server did not answer initialize within ${timeoutMs} ms${tail()}`), timeoutMs);
    child.on('error', (error) => finish(`the MCP server could not start: ${error.message}`));
    child.on('exit', (code, signal) => finish(`the MCP server exited (${signal ?? `code ${code}`}) before answering initialize${tail()}`));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      let newline: number;
      while ((newline = stdout.indexOf('\n')) >= 0) {
        const line = stdout.slice(0, newline).trim();
        stdout = stdout.slice(newline + 1);
        if (line === '') continue;
        let message: { id?: unknown; result?: { serverInfo?: unknown }; error?: { message?: unknown } };
        try {
          message = JSON.parse(line) as typeof message;
        } catch {
          finish(`the MCP server wrote something other than JSON-RPC on stdout: ${line.slice(0, 120)}`);
          return;
        }
        if (message.id !== 1) continue;
        if (message.result?.serverInfo !== undefined) finish(null);
        else finish(`the MCP server refused initialize: ${String(message.error?.message ?? line.slice(0, 120))}`);
      }
    });
    child.stdin.on('error', () => {}); // a server that died first is reported by 'exit'
    child.stdin.write(`${JSON.stringify(INITIALIZE)}\n`);
  });
}

export interface LaneIO {
  stdout(text: string): void;
  stderr(text: string): void;
}

const processIO: LaneIO = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

export const LANE_USAGE = (bin: string) => `       ${bin} --version [--json]\n       ${bin} --doctor [--json]`;

/**
 * Handles `--version` and `--doctor` for a bin: the exit code when `argv`
 * asked for one of them, null when it did not (the bin goes on as usual).
 */
export async function laneCommand(bin: string, argv: string[], io: LaneIO = processIO, probes: DoctorProbes = {}): Promise<number | null> {
  const version = argv.includes('--version');
  const doc = argv.includes('--doctor');
  if (!version && !doc) return null;
  const other = argv.filter((arg) => arg !== '--version' && arg !== '--doctor' && arg !== '--json');
  if ((version && doc) || other.length > 0) {
    io.stderr(`${bin}: --version and --doctor take only --json${other.length > 0 ? ` (got ${other.join(' ')})` : ''}\nusage:\n${LANE_USAGE(bin)}\n`);
    return 1;
  }
  const json = argv.includes('--json');
  if (version) {
    const info = kitInfo(probes);
    io.stdout(json ? `${JSON.stringify(info)}\n` : `@fluxnative/ui-mcp ${info.version} ${info.commit ?? '(no commit: not a git checkout of the kit)'}\n`);
    return 0;
  }
  const report = await doctor(probes);
  if (json) io.stdout(`${JSON.stringify(report, null, 2)}\n`);
  else {
    const lines = report.checks.map((c) => `${c.ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}`);
    const failed = report.checks.filter((c) => !c.ok).map((c) => c.name);
    lines.push(report.ready ? `ready: kit ${report.kit.version} ${report.kit.commit ?? '(no commit)'}` : `not ready: ${failed.join(', ')} failed`);
    io.stdout(`${lines.join('\n')}\n`);
  }
  return report.ready ? 0 : 1;
}

/**
 * `pnpm --dir <kit> grade …` runs the root script from the kit, so a relative
 * path the caller gave would resolve against the kit. pnpm passes the caller's
 * folder as INIT_CWD; this moves back there, only when the kit's own root
 * script is what ran.
 */
export function enterCallerCwd(env: NodeJS.ProcessEnv = process.env, chdir: (dir: string) => void = process.chdir): void {
  if (env.npm_package_name === 'fluxnative-ui-monorepo' && env.INIT_CWD !== undefined && env.INIT_CWD !== '') chdir(env.INIT_CWD);
}
