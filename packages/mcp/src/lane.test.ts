import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import { doctor, enterCallerCwd, kitInfo, laneCommand, mcpInitialize, PACKAGE_DIR, type DoctorProbes, type LaneIO } from './lane.ts';

const VERSION = (JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as { version: string }).version;
const GRADE_BIN = fileURLToPath(new URL('./grade.js', import.meta.url));
const MCP_BIN = fileURLToPath(new URL('./bin.js', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'fluxnative-lane-'));
after(() => rmSync(dir, { recursive: true, force: true }));

function capture(): LaneIO & { out: string; err: string } {
  const io = { out: '', err: '', stdout: (t: string) => void (io.out += t), stderr: (t: string) => void (io.err += t) };
  return io;
}

/** Probes for a kit where everything is in place, so each test breaks one thing. */
const healthy: DoctorProbes = { nodeVersion: '22.15.0', exists: () => true, mcpInitialize: async () => null, git: () => null };

describe('--version', () => {
  test('inside the kit checkout: the package version and the HEAD commit', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PACKAGE_DIR, encoding: 'utf8' }).trim();
    assert.deepEqual(kitInfo(), { version: VERSION, commit: head });
  });

  test('the bins print one JSON object with exactly version and commit', () => {
    for (const bin of [GRADE_BIN, MCP_BIN]) {
      const parsed = JSON.parse(execFileSync(process.execPath, [bin, '--version', '--json'], { encoding: 'utf8' })) as Record<string, unknown>;
      assert.deepEqual(Object.keys(parsed).sort(), ['commit', 'version']);
      assert.equal(parsed.version, VERSION);
      assert.match(String(parsed.commit), /^[0-9a-f]{40}$/);
      const line = execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' });
      assert.equal(line, `@fluxnative/ui-mcp ${VERSION} ${parsed.commit}\n`);
    }
  });

  test('with no git (missing binary, or not a checkout): commit is null', async () => {
    assert.deepEqual(kitInfo({ git: () => null }), { version: VERSION, commit: null });
    const io = capture();
    assert.equal(await laneCommand('fluxnative-ui-grade', ['--version', '--json'], io, { git: () => null }), 0);
    assert.deepEqual(JSON.parse(io.out), { version: VERSION, commit: null });
    const text = capture();
    await laneCommand('fluxnative-ui-grade', ['--version'], text, { git: () => null });
    assert.match(text.out, /^@fluxnative\/ui-mcp \S+ \(no commit: not a git checkout of the kit\)\n$/);
  });

  test('installed from npm inside someone else\'s repository: their HEAD is not the kit\'s commit', () => {
    const installed = join(dir, 'app', 'node_modules', '@fluxnative', 'ui-mcp');
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    const git = () => 'f'.repeat(40);
    assert.deepEqual(kitInfo({ packageDir: installed, git }), { version: '9.9.9', commit: null });
    // A copy vendored outside node_modules, in a repository whose packages/mcp is not this package.
    const vendored = join(dir, 'vendor', 'ui-mcp');
    mkdirSync(vendored, { recursive: true });
    writeFileSync(join(vendored, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    assert.equal(kitInfo({ packageDir: vendored, git: (args) => (args.includes('--show-toplevel') ? dir : git()) }).commit, null);
  });

  test('takes only --json besides', async () => {
    const io = capture();
    assert.equal(await laneCommand('fluxnative-ui-grade', ['--version', 'screens/'], io), 1);
    assert.match(io.err, /take only --json \(got screens\/\)/);
    assert.equal(await laneCommand('fluxnative-ui-grade', ['--version', '--doctor'], capture()), 1);
    assert.equal(await laneCommand('fluxnative-ui-grade', ['screens/'], capture()), null);
  });
});

describe('--doctor', () => {
  test('ready: every check passes, exit 0', async () => {
    const io = capture();
    assert.equal(await laneCommand('fluxnative-ui-grade', ['--doctor', '--json'], io, healthy), 0);
    const report = JSON.parse(io.out) as { ready: boolean; kit: unknown; checks: { name: string; ok: boolean }[] };
    assert.equal(report.ready, true);
    assert.deepEqual(report.kit, { version: VERSION, commit: null });
    assert.deepEqual(report.checks.map((c) => [c.name, c.ok]), [['node', true], ['deps', true], ['mcp', true]]);
  });

  test('an old Node fails the node check by name, exit 1', async () => {
    for (const nodeVersion of ['22.14.0', 'v20.19.1', '18.0.0']) {
      const report = await doctor({ ...healthy, nodeVersion });
      assert.equal(report.ready, false, nodeVersion);
      const node = report.checks.find((c) => c.name === 'node');
      assert.equal(node?.ok, false);
      assert.match(node?.detail ?? '', /too old: the kit needs 22\.15 or newer/);
    }
    assert.equal((await doctor({ ...healthy, nodeVersion: '23.0.0' })).ready, true);
    const io = capture();
    assert.equal(await laneCommand('fluxnative-ui-grade', ['--doctor'], io, { ...healthy, nodeVersion: '22.14.0' }), 1);
    assert.match(io.out, /^FAIL node: Node 22\.14\.0 is too old/m);
    assert.match(io.out, /^not ready: node failed$/m);
  });

  test('missing dependencies are each named, with the install command', async () => {
    // react-native and the MCP SDK are not installed; everything else is.
    const exists = (path: string) => !path.includes(`${join('node_modules', 'react-native')}`) && !path.includes('@modelcontextprotocol');
    const report = await doctor({ ...healthy, exists, mcpInitialize: async () => 'the MCP server exited (code 1) before answering initialize' });
    assert.equal(report.ready, false);
    const deps = report.checks.find((c) => c.name === 'deps');
    assert.equal(deps?.ok, false);
    assert.match(deps?.detail ?? '', /@modelcontextprotocol\/sdk \(for the MCP server\)/);
    assert.match(deps?.detail ?? '', /react-native \(for the typecheck, under .*node_modules\)/);
    assert.doesNotMatch(deps?.detail ?? '', /\breact \(|zod|typescript/);
    assert.match(deps?.detail ?? '', /pnpm install --frozen-lockfile/);
    assert.deepEqual(report.checks.filter((c) => !c.ok).map((c) => c.name), ['deps', 'mcp']);
  });

  test('no node_modules at all: every dependency is missing, and the catalog\'s own are not guessed', async () => {
    const report = await doctor({ ...healthy, exists: () => false });
    const detail = report.checks.find((c) => c.name === 'deps')?.detail ?? '';
    for (const dep of ['@fluxnative/catalog', '@modelcontextprotocol/sdk', 'typescript', 'zod']) assert.ok(detail.includes(`${dep} (for the MCP server)`), dep);
    assert.doesNotMatch(detail, /for the typecheck/);
  });

  test('the real MCP server answers initialize', async () => {
    assert.equal(await mcpInitialize(), null);
  });

  test('a server that dies or says nothing is reported, not waited on forever', async () => {
    const dies = join(dir, 'dies.js');
    writeFileSync(dies, "process.stderr.write('boom: no catalog\\n'); process.exit(3);\n");
    assert.match((await mcpInitialize(5_000, dies)) ?? '', /exited \(code 3\) before answering initialize: boom: no catalog/);
    const silent = join(dir, 'silent.js');
    writeFileSync(silent, 'setInterval(() => {}, 1000);\n');
    assert.match((await mcpInitialize(300, silent)) ?? '', /did not answer initialize within 300 ms/);
  });
});

describe('the root scripts', () => {
  test('`pnpm --dir <kit> grade` resolves paths against the caller, only from the kit\'s own script', () => {
    const moved: string[] = [];
    enterCallerCwd({ npm_package_name: 'fluxnative-ui-monorepo', INIT_CWD: '/caller' }, (d) => moved.push(d));
    enterCallerCwd({ npm_package_name: 'some-template', INIT_CWD: '/elsewhere' }, (d) => moved.push(d));
    enterCallerCwd({}, (d) => moved.push(d));
    assert.deepEqual(moved, ['/caller']);
  });
});
