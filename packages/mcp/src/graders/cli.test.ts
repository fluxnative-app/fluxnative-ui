import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import { GRADERS, main, type CliOptions, type Report } from './cli.ts';
import { extract } from './extract.ts';
import { FIXTURES_DIR } from './paths.ts';

const BIN = fileURLToPath(new URL('../grade.js', import.meta.url));
const CATALOG_GRID = {
  recipes: ['Chip', 'IconButton', 'Icon', 'Press', 'Reveal', 'SectionHeader', 'Skeleton', 'StateView'],
  states: ['live', 'loading', 'empty', 'error'],
};

const dir = mkdtempSync(join(tmpdir(), 'fluxnative-grade-cli-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Writes a fixture's tsx block as `<sub>/<name>.tsx` and returns the path. */
function screen(fixture: string, name: string, sub = ''): string {
  const { code } = extract(readFileSync(join(FIXTURES_DIR, 'screens', `${fixture}.md`), 'utf8'));
  assert.ok(code !== null, fixture);
  mkdirSync(join(dir, sub), { recursive: true });
  const file = join(dir, sub, `${name}.tsx`);
  writeFileSync(file, code);
  return file;
}

function bin(args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { code: e.status, stdout: e.stdout, stderr: e.stderr };
  }
}

const passingChecker: NonNullable<CliOptions['typechecker']> = {
  prepare() {},
  check: () => ({ pass: true, score: 1, details: { errors: [], suppressions: [], ms: 0 } }),
  dispose() {},
};

async function run(args: string[], typechecker = passingChecker): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const code = await main(args, { typechecker, io: { stdout: (t) => (stdout += t), stderr: (t) => (stderr += t) } });
  return { code, stdout, stderr };
}

describe('fluxnative-ui-grade (bin)', () => {
  test('a passing screen exits 0 with the versioned JSON report', () => {
    const file = screen('good', 'CatalogGridScreen', 'pass');
    const expectFile = join(dir, 'grid.json');
    writeFileSync(expectFile, JSON.stringify(CATALOG_GRID));
    const r = bin(['--json', '--expect', expectFile, file]);
    assert.equal(r.code, 0, r.stderr);
    const report = JSON.parse(r.stdout) as Report;
    assert.equal(report.version, 1);
    assert.match(report.kit.version, /^\d+\.\d+\.\d+/);
    assert.equal(report.pass, true);
    assert.deepEqual(Object.keys(report.screens), ['CatalogGridScreen']);
    const s = report.screens.CatalogGridScreen;
    assert.ok(s !== undefined);
    assert.equal(s.pass, true);
    for (const grader of GRADERS) {
      assert.deepEqual(Object.keys(s[grader]).sort(), ['details', 'pass', 'score'], grader);
      assert.equal(s[grader].pass, true, `${grader}: ${JSON.stringify(s[grader].details)}`);
    }
    assert.equal(s.metrics.coverage, 1);
    assert.equal(s.metrics.typecheckErrors, 0);
  });

  test('a failing screen exits 2 and names the grader; a directory grades every tsx in it', () => {
    screen('bad-tokens', 'BadTokens', 'fail');
    screen('bad-typecheck', 'BadTypecheck', 'fail');
    writeFileSync(join(dir, 'fail', 'notes.md'), 'not a screen');
    const r = bin([join(dir, 'fail')]);
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stdout, /^FAIL BadTokens tokens: /m);
    assert.match(r.stdout, /^FAIL BadTypecheck typecheck: .*TS\d+/m);
    assert.match(r.stdout, /^fail: 0\/2 screens pass every grader/m);
  });

  test('a bad argument exits 1 with the usage and nothing on stdout', () => {
    for (const args of [['--bogus', 'x.tsx'], [], ['--expect'], [join(dir, 'missing.tsx')], [join(dir, 'grid.json')]]) {
      const r = bin(args);
      assert.equal(r.code, 1, args.join(' '));
      assert.equal(r.stdout, '');
      assert.match(r.stderr, /fluxnative-ui-grade: /);
    }
  });
});

describe('fluxnative-ui-grade (in process)', () => {
  test('--expect applies per-screen entries by name and falls back to default', async () => {
    const good = screen('good', 'Grid', 'expect');
    const other = screen('good', 'Other', 'expect');
    const expectFile = join(dir, 'per-screen.json');
    writeFileSync(expectFile, JSON.stringify({ screens: { Grid: CATALOG_GRID }, default: { recipes: ['Stepper'] } }));
    const r = await run(['--json', '--expect', expectFile, good, other]);
    assert.equal(r.code, 2, r.stderr);
    const report = JSON.parse(r.stdout) as Report;
    assert.equal(report.screens.Grid?.coverage.pass, true);
    assert.equal(report.screens.Other?.coverage.pass, false);
    assert.deepEqual((report.screens.Other?.coverage.details as { missing: string[] }).missing, ['Stepper']);
    assert.equal(report.screens.Other?.pass, false);
  });

  test('no expectation reports coverage as na, which does not gate', async () => {
    const good = screen('good', 'Lone', 'na');
    const r = await run(['--json', good]);
    assert.equal(r.code, 0, r.stderr);
    const s = (JSON.parse(r.stdout) as Report).screens.Lone;
    assert.equal(s?.coverage.pass, null);
    assert.match(String(s?.coverage.details), /^na: /);
    assert.equal(s?.metrics.coverage, null);
  });

  test('--expect with an unknown key or a non-array is a usage error', async () => {
    const good = screen('good', 'Grid', 'expect');
    for (const body of [{ recipe: ['Chip'] }, { recipes: 'Chip' }, { screens: [] }]) {
      const expectFile = join(dir, 'bad-expect.json');
      writeFileSync(expectFile, JSON.stringify(body));
      const r = await run(['--expect', expectFile, good]);
      assert.equal(r.code, 1, JSON.stringify(body));
      assert.equal(r.stdout, '');
    }
  });

  test('a typechecker that cannot run is never a pass: unavailable, exit 1', async () => {
    const good = screen('good', 'Grid', 'expect');
    const broken = { ...passingChecker, prepare: () => { throw new Error('react is not installed'); } };
    const r = await run(['--json', good], broken);
    assert.equal(r.code, 1);
    const report = JSON.parse(r.stdout) as Report;
    assert.equal(report.pass, false);
    assert.deepEqual(report.screens.Grid?.typecheck, { pass: false, score: 0, details: 'unavailable: react is not installed' });
    assert.equal(report.screens.Grid?.dialect.pass, true, 'the other graders still run');
    assert.match(r.stderr, /typecheck unavailable/);

    const throwsOnCheck = { ...passingChecker, check: () => { throw new Error('compiler crashed'); } };
    const t = await run([good], throwsOnCheck);
    assert.equal(t.code, 1);
    assert.match(t.stdout, /^FAIL Grid typecheck: unavailable: compiler crashed/m);
  });
});
