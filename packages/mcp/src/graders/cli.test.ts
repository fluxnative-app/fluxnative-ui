import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import { GRADERS, main, type CliOptions, type Report } from './cli.ts';
import { extract } from './extract.ts';
import { CATALOG_CLI, FIXTURES_DIR } from './paths.ts';

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

/** In process; `typechecker: null` lets `main` build the real one. */
async function run(args: string[], typechecker: CliOptions['typechecker'] | null = passingChecker): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const io = { stdout: (t: string) => (stdout += t), stderr: (t: string) => (stderr += t) };
  const code = await main(args, typechecker === null ? { io } : { typechecker, io });
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

/** A Flux template's files/: the emitted catalog layer (Chip and what it brings) plus fixtures/template. */
function template(name: string): string {
  const files = join(dir, name, 'files');
  execFileSync(process.execPath, [CATALOG_CLI, 'emit', '--to', files, '--only', 'Chip'], { stdio: 'pipe' });
  for (const sub of ['components', 'data', 'theme', 'screens']) cpSync(join(FIXTURES_DIR, 'template', sub), join(files, sub), { recursive: true });
  return files;
}

const reportOf = (stdout: string) => JSON.parse(stdout) as Report;

describe('fluxnative-ui-grade --root (template mode)', () => {
  test('a screen importing local components, data, theme and the host modules passes; screens/ is the default', async () => {
    const files = template('tpl-pass');
    const r = await run(['--json', '--root', files], null);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    const s = reportOf(r.stdout).screens.ShelfScreen;
    assert.ok(s !== undefined);
    for (const grader of GRADERS) assert.notEqual(s[grader].pass, false, `${grader}: ${JSON.stringify(s[grader].details)}`);
    assert.deepEqual((s.typecheck.details as { elsewhere: unknown[] }).elsewhere, []);
    assert.equal(s.metrics.catalogElements, 1, 'the emitted Chip counts as a recipe, the template\'s ShelfCard does not');
  });

  test('without --root the same screen fails: the catalog layer alone has no ShelfCard', async () => {
    const files = template('tpl-plain');
    const r = await run(['--json', join(files, 'screens', 'ShelfScreen.tsx')]);
    assert.equal(r.code, 2);
    assert.equal(reportOf(r.stdout).screens.ShelfScreen?.dialect.pass, false);
  });

  test('a relative import that escapes the root fails dialect, even when the file exists', async () => {
    const files = template('tpl-escape');
    writeFileSync(join(dir, 'tpl-escape', 'outside.ts'), 'export const outside = 1;\n');
    writeFileSync(join(files, 'screens', 'EscapeScreen.tsx'), "import React from 'react';\nimport { outside } from '../../outside';\nexport default function EscapeScreen() {\n  return outside === 1 ? null : null;\n}\n");
    const r = await run(['--json', '--root', files], null);
    assert.equal(r.code, 2);
    const dialect = reportOf(r.stdout).screens.EscapeScreen?.dialect.details as { violations: { rule: string; message: string }[] };
    assert.deepEqual(dialect.violations.map((v) => v.rule), ['relative']);
    assert.match(dialect.violations[0]?.message ?? '', /escapes/);
    assert.equal(reportOf(r.stdout).screens.ShelfScreen?.pass, true);
  });

  test('a missing local file fails dialect and typecheck', async () => {
    const files = template('tpl-missing');
    const screenFile = join(files, 'screens', 'ShelfScreen.tsx');
    writeFileSync(screenFile, readFileSync(screenFile, 'utf8').replace("'../components/ShelfCard'", "'../components/ShelfTile'"));
    const r = await run(['--root', files], null);
    assert.equal(r.code, 2);
    assert.match(r.stdout, /^FAIL ShelfScreen dialect: .*'\.\.\/components\/ShelfTile' resolves to no file/m);
    assert.match(r.stdout, /^FAIL ShelfScreen typecheck: .*TS2307/m);
  });

  test('an error inside a shared component is reported under elsewhere and does not fail the screen', async () => {
    const files = template('tpl-elsewhere');
    appendFileSync(join(files, 'components', 'ShelfCard.tsx'), "\nexport const broken: number = 'x';\n");
    const r = await run(['--json', '--root', files], null);
    assert.equal(r.code, 0, r.stdout);
    const typecheck = reportOf(r.stdout).screens.ShelfScreen?.typecheck;
    assert.equal(typecheck?.pass, true);
    const details = typecheck?.details as { errors: unknown[]; elsewhere: { file: string; code: number }[] };
    assert.deepEqual(details.errors, []);
    assert.deepEqual(details.elsewhere.map((e) => [e.file, e.code]), [['components/ShelfCard.tsx', 2322]]);
  });

  test('coverage in a template follows recipeKind: a missing visual recipe passes, a missing behaviour recipe fails, a local hook under a recipe name is not it', async () => {
    const files = template('tpl-kinds');
    // The template's own countdown hook, under the recipe's name but not in .fluxnative-ui.json.
    writeFileSync(join(files, 'components', 'useCountdown.ts'), 'export default function useCountdown(target: number): number {\n  return target;\n}\n');
    const screenFile = join(files, 'screens', 'ShelfScreen.tsx');
    writeFileSync(
      screenFile,
      readFileSync(screenFile, 'utf8')
        .replace("import Chip from '../components/Chip';", "import Chip from '../components/Chip';\nimport useCountdown from '../components/useCountdown';")
        .replace('  const palette = usePalette();', '  const palette = usePalette();\n  useCountdown(0);'),
    );
    const grade = async (recipes: string[]) => {
      const expectFile = join(dir, `tpl-kinds-${recipes.join('-')}.json`);
      writeFileSync(expectFile, JSON.stringify({ recipes, states: ['live', 'empty'] }));
      const r = await run(['--json', '--root', files, '--expect', expectFile]);
      const coverage = reportOf(r.stdout).screens.ShelfScreen?.coverage;
      return { code: r.code, coverage, details: coverage?.details as { behaviour: { missing: string[] }; visual: { missing: string[] } } };
    };
    const visual = await grade(['Chip', 'ScreenHeader']);
    assert.equal(visual.coverage?.pass, true, JSON.stringify(visual.details));
    assert.equal(visual.code, 0);
    assert.deepEqual(visual.details.visual.missing, ['ScreenHeader'], 'reported, not failed');
    const behaviour = await grade(['Chip', 'StateView']);
    assert.equal(behaviour.coverage?.pass, false);
    assert.equal(behaviour.code, 2);
    assert.deepEqual(behaviour.details.behaviour.missing, ['StateView']);
    const localHook = await grade(['Chip', 'useCountdown']);
    assert.equal(localHook.coverage?.pass, false, 'the template\'s own useCountdown is not the recipe');
    assert.deepEqual(localHook.details.behaviour.missing, ['useCountdown']);
  });

  test('a screen outside the root and a root that is not a folder are usage errors', async () => {
    const files = template('tpl-usage');
    const outside = screen('good', 'Outside', 'tpl-usage-outside');
    assert.equal((await run(['--root', files, outside])).code, 1);
    assert.equal((await run(['--root', join(files, 'nope')])).code, 1);
  });
});
